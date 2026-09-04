use bytes::Bytes;
use serde::Serialize;
use std::ffi::CStr;
use std::fs;
use std::os::raw::c_char;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

use crate::algo::AudioMeta;
use crate::internal::sniff::Sniffer;

const MAX_INPUT_BYTES: usize = 512 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct UnlockMetadata {
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub cover_mime_type: Option<String>,
    pub cover_path: Option<String>,
}

#[derive(Debug)]
pub struct UnlockOutput {
    pub bytes: Vec<u8>,
    pub metadata: UnlockMetadata,
    pub cover: Option<Vec<u8>>,
}

pub fn unlock(
    input: &[u8],
    extension: &str,
    filename: Option<&str>,
) -> Result<UnlockOutput, String> {
    if input.is_empty() {
        return Err("输入文件为空".to_string());
    }
    if input.len() > MAX_INPUT_BYTES {
        return Err("输入文件超过 512 MB 限制".to_string());
    }

    let ext = extension.trim_start_matches('.').to_ascii_lowercase();
    if ext == "kgg" {
        return Err("酷狗 KGG 需要外部密钥数据库，当前版本不支持".to_string());
    }

    let result = catch_unwind(AssertUnwindSafe(|| {
        if ext == "mp3" && crate::internal::sniff::Mpeg4Sniffer.sniff(input) {
            let (bytes, cover) = crate::transcode::mp4_to_mp3(input)?;
            // MP4 `covr` artwork is otherwise only returned as a sidecar. The
            // regular local-import path carries just the converted Media
            // record, so embed the image in the MP3 ID3 tag as well; this lets
            // the normal JS metadata parser persist it after the conversion.
            let bytes = match cover.as_ref() {
                Some(image) => crate::internal::helpers::write_id3_tags(
                    Bytes::from(bytes),
                    None,
                    Some(Bytes::copy_from_slice(image)),
                )?
                .to_vec(),
                None => bytes,
            };
            return Ok::<_, Box<dyn std::error::Error>>((bytes, None, cover));
        }
        let decoder =
            crate::internal::helpers::dec_init(Bytes::copy_from_slice(input), true, &ext)?;
        let metadata = decoder.get_audio_meta().transpose()?.map(|meta| {
            (
                meta.get_title(),
                meta.get_artists().join(", "),
                meta.get_album(),
            )
        });
        // Keep the decoder-provided cover when the decoded output is rewritten.
        // `get_result` embeds artwork into MP3 ID3 tags before the file is
        // returned; WAV artwork remains available through the sidecar path.
        let (bytes, cover) = crate::internal::helpers::get_result_with_cover(decoder, filename)?;
        Ok::<_, Box<dyn std::error::Error>>((bytes.to_vec(), metadata, cover.map(|value| value.to_vec())))
    }))
    .map_err(|_| "解码器拒绝了损坏或越界的容器".to_string())?
    .map_err(|error| error.to_string())?;

    let extension = crate::internal::sniff::audio_extension(&result.0)
        .ok_or_else(|| "解码结果不是受支持的音频格式".to_string())?;
    let mime_type = match extension.as_str() {
        ".mp3" => "audio/mpeg",
        ".flac" => "audio/flac",
        ".ogg" => "audio/ogg",
        ".m4a" => "audio/mp4",
        ".wav" => "audio/wav",
        ".aac" => "audio/aac",
        _ => return Err("解码结果格式不受支持".to_string()),
    };
    let fallback = filename.map(crate::algo::common::meta::parse_filename_meta);
    let metadata = result.1.or_else(|| {
        fallback.map(|meta| {
            (
                meta.get_title(),
                meta.get_artists().join(", "),
                meta.get_album(),
            )
        })
    });
    let cover = result.2;
    let cover_mime_type = cover.as_deref().and_then(crate::internal::sniff::image_mime);
    let size_bytes = result.0.len();
    Ok(UnlockOutput {
        bytes: result.0,
        metadata: UnlockMetadata {
            extension,
            mime_type: mime_type.to_string(),
            size_bytes,
            title: metadata
                .as_ref()
                .map(|value| value.0.clone())
                .filter(|v| !v.is_empty()),
            artist: metadata
                .as_ref()
                .map(|value| value.1.clone())
                .filter(|v| !v.is_empty()),
            album: metadata
                .as_ref()
                .map(|value| value.2.clone())
                .filter(|v| !v.is_empty()),
            cover_mime_type,
            cover_path: None,
        },
        cover,
    })
}

#[no_mangle]
pub unsafe extern "C" fn stillalive_unlock_file(
    input_path: *const c_char,
    output_path: *const c_char,
    metadata_path: *const c_char,
) -> i32 {
    if input_path.is_null() || output_path.is_null() || metadata_path.is_null() {
        return 1;
    }
    let output_hint = CStr::from_ptr(output_path).to_string_lossy().into_owned();
    let metadata_hint = CStr::from_ptr(metadata_path).to_string_lossy().into_owned();
    let operation = catch_unwind(AssertUnwindSafe(|| {
        let input_path = CStr::from_ptr(input_path).to_string_lossy().into_owned();
        let output_path = CStr::from_ptr(output_path).to_string_lossy().into_owned();
        let metadata_path = CStr::from_ptr(metadata_path).to_string_lossy().into_owned();
        if input_path.is_empty() || output_path.is_empty() || metadata_path.is_empty() {
            return Err("文件路径为空".to_string());
        }
        // A retry may reuse an output name after a process interruption. Remove
        // every artifact before decoding so a failed attempt cannot expose an
        // older audio file or cover through the metadata response.
        let _ = fs::remove_file(format!("{output_path}.partial"));
        let _ = fs::remove_file(format!("{metadata_path}.partial"));
        let _ = fs::remove_file(&output_path);
        let _ = fs::remove_file(&metadata_path);
        for extension in [
            ".jpg", ".png", ".bmp", ".webp", ".gif", ".heic", ".avif", ".tiff", ".jp2",
        ] {
            let _ = fs::remove_file(format!("{output_path}.cover{extension}"));
            let _ = fs::remove_file(format!("{output_path}.cover{extension}.partial"));
        }
        let _ = fs::remove_file(format!("{output_path}.cover"));
        let _ = fs::remove_file(format!("{output_path}.cover.partial"));
        let input_size = fs::metadata(&input_path)
            .map_err(|error| error.to_string())?
            .len();
        if input_size == 0 || input_size > MAX_INPUT_BYTES as u64 {
            return Err("输入文件为空或超过 512 MB 限制".to_string());
        }
        let input = fs::read(&input_path).map_err(|error| error.to_string())?;
        let path = Path::new(&input_path);
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        let filename = path.file_name().and_then(|value| value.to_str());
        let mut unlocked = unlock(&input, extension, filename)?;
        let output_partial = format!("{output_path}.partial");
        let metadata_partial = format!("{metadata_path}.partial");
        fs::write(&output_partial, &unlocked.bytes).map_err(|error| error.to_string())?;
        if let Some(cover) = &unlocked.cover {
            if let Some(extension) = crate::internal::sniff::image_extension(cover) {
                let cover_path = format!("{output_path}.cover{extension}");
                let cover_partial = format!("{cover_path}.partial");
                fs::write(&cover_partial, cover).map_err(|error| error.to_string())?;
                fs::rename(&cover_partial, &cover_path).map_err(|error| error.to_string())?;
                unlocked.metadata.cover_path = Some(cover_path);
            }
        }
        let metadata = serde_json::to_vec(&unlocked.metadata).map_err(|error| error.to_string())?;
        fs::write(&metadata_partial, metadata).map_err(|error| error.to_string())?;
        fs::rename(&output_partial, &output_path).map_err(|error| error.to_string())?;
        fs::rename(&metadata_partial, &metadata_path).map_err(|error| error.to_string())?;
        Ok::<(), String>(())
    }));
    match operation {
        Ok(Ok(())) => 0,
        failed => {
            let _ = fs::remove_file(format!("{output_hint}.partial"));
            let _ = fs::remove_file(format!("{metadata_hint}.partial"));
            for extension in [
                ".jpg", ".png", ".bmp", ".webp", ".gif", ".heic", ".avif", ".tiff", ".jp2",
            ] {
                let _ = fs::remove_file(format!("{output_hint}.cover{extension}"));
                let _ = fs::remove_file(format!("{output_hint}.cover{extension}.partial"));
            }
            let message = match failed {
                Ok(Err(error)) => error,
                Err(_) => "解码器拒绝了损坏或越界的容器".to_string(),
                Ok(Ok(())) => unreachable!(),
            };
            let failure = serde_json::json!({ "error": message });
            if let Ok(encoded) = serde_json::to_vec(&failure) {
                let _ = fs::write(&metadata_hint, encoded);
            }
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_external_key_and_malformed_containers() {
        assert!(unlock(b"not-audio", "kgg", Some("unsupported.kgg"))
            .unwrap_err()
            .contains("外部密钥"));
        assert!(unlock(b"not-audiomusicex\0", "mflac", None)
            .unwrap_err()
            .contains("原下载设备"));
        for extension in ["ncm", "qmc0", "mgg", "mflac", "kgm", "kgma"] {
            assert!(
                unlock(b"not-audio", extension, None).is_err(),
                "{extension}"
            );
        }
    }

    #[test]
    fn unlocks_qmc_fixture_and_reports_real_format() {
        let input = [
            include_bytes!("algo/qmc/testdata/qmc0_static_raw.bin").as_slice(),
            include_bytes!("algo/qmc/testdata/qmc0_static_suffix.bin").as_slice(),
        ]
        .concat();
        let output = unlock(&input, "qmc0", Some("artist - title.qmc0")).unwrap();
        assert_eq!(output.metadata.extension, ".mp3");
        assert_eq!(output.metadata.mime_type, "audio/mpeg");
        assert!(output.bytes.starts_with(b"ID3"));
    }

    #[test]
    fn detects_mp4_container_disguised_as_mp3() {
        let header = [
            0, 0, 0, 24, b'f', b't', b'y', b'p', b'm', b'p', b'4', b'2',
            0, 0, 0, 0, b'i', b's', b'o', b'm', b'm', b'p', b'4', b'2',
        ];
        assert!(crate::internal::sniff::Mpeg4Sniffer.sniff(&header));
        assert!(!crate::internal::sniff::M4aSniffer.sniff(&header));
    }

}
