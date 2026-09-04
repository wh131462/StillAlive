use rusty_mp3::{Mp3Encoder, Mp3EncoderConfig};
use std::io::Cursor;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::formats::probe::Hint;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

const MAX_COVER_BYTES: usize = 32 * 1024 * 1024;

/// Decode the first audio track from an MP4 container and encode it as MP3.
///
/// The returned artwork is kept separate so the native bridge can expose it as
/// a sidecar. The caller also embeds it into the generated MP3's ID3 tag so
/// ordinary local imports can discover it through their normal metadata path.
pub fn mp4_to_mp3(input: &[u8]) -> Result<(Vec<u8>, Option<Vec<u8>>), String> {
    let source = MediaSourceStream::new(
        Box::new(Cursor::new(input)),
        Default::default(),
    );
    let mut hint = Hint::new();
    hint.with_extension("mp4");
    let mut format = symphonia::default::get_probe()
        .probe(&hint, source, FormatOptions::default(), MetadataOptions::default())
        .map_err(|error| format!("MP4 容器无法读取: {error}"))?;
    let cover = {
        let metadata = format.metadata();
        metadata.current().and_then(|revision| {
            revision
                .media
                .visuals
                .iter()
                .chain(revision.per_track.iter().flat_map(|track| track.metadata.visuals.iter()))
                .find(|visual| !visual.data.is_empty() && visual.data.len() <= MAX_COVER_BYTES)
                .map(|visual| visual.data.to_vec())
        })
    };
    let (track_id, sample_rate, audio_params) = {
        let track = format
            .default_track(TrackType::Audio)
            .ok_or_else(|| "MP4 中没有音频轨道".to_string())?;
        let params = track
            .codec_params
            .as_ref()
            .and_then(|value| value.audio())
            .ok_or_else(|| "MP4 音频编码不受支持".to_string())?
            .clone();
        (
            track.id,
            params
                .sample_rate
                .ok_or_else(|| "音频轨道缺少采样率".to_string())?,
            params,
        )
    };
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(
            &audio_params,
            &AudioDecoderOptions::default(),
        )
        .map_err(|error| format!("MP4 音频解码器不可用: {error}"))?;
    let mut encoder = Mp3Encoder::new(Mp3EncoderConfig {
        bitrate_kbps: 192,
        vbr_quality: None,
    });
    let mut output = Vec::new();
    while let Some(packet) = format
        .next_packet()
        .map_err(|error| format!("MP4 音频数据读取失败: {error}"))?
    {
        if packet.track_id != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(error) => return Err(format!("MP4 音频解码失败: {error}")),
        };
        let channels = decoded.spec().channels().count() as u16;
        let mut samples = vec![0.0f32; decoded.samples_interleaved()];
        decoded.copy_to_slice_interleaved(&mut samples);
        encoder
            .push_pcm_f32(&samples, channels, sample_rate)
            .map_err(|error| format!("MP3 编码失败: {error}"))?;
        drain_encoder(&mut encoder, &mut output)?;
    }
    encoder.finish();
    drain_encoder(&mut encoder, &mut output)?;
    if output.is_empty() {
        return Err("MP4 音频没有可编码的数据".to_string());
    }
    Ok((output, cover))
}

fn drain_encoder(encoder: &mut Mp3Encoder, output: &mut Vec<u8>) -> Result<(), String> {
    loop {
        match encoder.next_packet() {
            Ok(packet) => output.extend(packet),
            Err(rusty_mp3::Error::Again) | Err(rusty_mp3::Error::Eof) => return Ok(()),
            Err(error) => return Err(format!("MP3 输出失败: {error}")),
        }
    }
}
