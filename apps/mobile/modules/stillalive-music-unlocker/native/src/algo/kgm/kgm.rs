use super::super::super::internal::utils::bytes::*;

use super::super::DecoderResult;
use bytes::*;
use thiserror::Error;

pub struct Decoder {
    pub rd: EasyBytesWithCursor,
    pub cipher: Box<dyn super::super::Decrypter>,
    pub header: super::kgm_header::Header,
}

#[derive(Debug, Error)]
pub enum KgmDecoderError {
    #[error("KgmDecoder validate error: Unsupported crypto version")]
    UnsupportedCryptoVersion,
}

impl Default for Decoder {
    fn default() -> Self {
        Self::new()
    }
}

impl Decoder {
    pub fn new() -> Self {
        Self {
            rd: EasyBytesWithCursor::new(),
            cipher: Box::new(super::kgm_v3::KgmCryptoV3::default()),
            header: super::kgm_header::Header::default(),
        }
    }
}

impl BytesCursorHelper for Decoder {
    fn inner_buffer(&self) -> Bytes {
        self.rd.inner_buffer()
    }
    fn inner_cursor(&self) -> usize {
        self.rd.inner_cursor()
    }
    fn set_inner_cursor(&mut self, cursor: usize) {
        self.rd.set_inner_cursor(cursor);
    }
}

impl super::super::Decoder for Decoder {
    // Validate checks if the file is a valid Kugou (.kgm, .vpr, .kgma) file.
    // rd will be seeked to the beginning of the encrypted audio.
    fn validate(&mut self) -> DecoderResult<()> {
        self.seek_start();
        let header_buf: [u8; 0x3c] = self.read_sized();
        let header = super::kgm_header::Header::from_bytes(&header_buf)?;
        if header.audio_offset as usize > self.rd.inner_buffer().len() {
            return Err("KGM 音频偏移越界".into());
        }
        // read start pos
        // prepare for read
        self.seek_start_next(header.audio_offset as usize);

        self.header = header.clone();
        match header.crypto_version {
            3 => {
                self.cipher = Box::new(super::kgm_v3::KgmCryptoV3::new(&header)?);
            }
            _ => {
                return Err(KgmDecoderError::UnsupportedCryptoVersion.into());
            }
        }

        Ok(())
    }
    fn decode_bytes(&mut self) -> DecoderResult<BytesMut> {
        let input_bytes = self.read_to_end();

        self.cipher.decrypt(input_bytes)
    }
}

#[derive(Clone)]
pub struct KgmDecoderBuilder;

impl super::super::DecoderBuilder for KgmDecoderBuilder {
    fn new_decoder(
        &self,
        p: &super::super::dispatch::DecoderParams,
    ) -> Box<dyn super::super::Decoder> {
        Box::new(Decoder {
            rd: EasyBytesWithCursor::create(p.buffer.clone()),
            cipher: Box::new(super::kgm_v3::KgmCryptoV3::default()),
            header: super::kgm_header::Header::default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::{DecoderBuilder, DecoderParams};
    use super::*;

    const KGM_HEADER: [u8; 16] = [
        0x7C, 0xD5, 0x32, 0xEB, 0x86, 0x02, 0x7F, 0x4B, 0xA8, 0xAF, 0xA6, 0x8E, 0x0F, 0xFF, 0x99,
        0x14,
    ];

    fn encrypted_fixture() -> (Bytes, Vec<u8>) {
        let crypto_key = [
            0x10, 0x32, 0x54, 0x76, 0x98, 0xBA, 0xDC, 0xFE, 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB,
            0xCD, 0xEF,
        ];
        let mut audio = b"ID3\x04\x00\x00\x00\x00\x00\x00fixture-audio".to_vec();
        audio.resize(256, 0);
        let slot_box = super::super::kgm_v3::kugo_md5(&[0x6C, 0x2C, 0x2F, 0x27]);
        let mut file_box = super::super::kgm_v3::kugo_md5(&crypto_key).to_vec();
        file_box.push(0x6b);
        let mut encrypted = audio.clone();
        for (index, byte) in encrypted.iter_mut().enumerate() {
            *byte ^= super::super::kgm_v3::xor_collapse_u32(index as u32);
            *byte ^= slot_box[index % slot_box.len()];
            *byte ^= *byte << 4;
            *byte ^= file_box[index % file_box.len()];
        }

        let mut input = Vec::with_capacity(0x3c + encrypted.len());
        input.extend_from_slice(&KGM_HEADER);
        input.extend_from_slice(&(0x3cu32).to_le_bytes());
        input.extend_from_slice(&3u32.to_le_bytes());
        input.extend_from_slice(&1u32.to_le_bytes());
        input.extend_from_slice(&[0u8; 16]);
        input.extend_from_slice(&crypto_key);
        input.extend_from_slice(&encrypted);
        (Bytes::from(input), audio)
    }

    #[test]
    fn decodes_kgm_and_kgma_v3_fixture() {
        let (input, expected) = encrypted_fixture();
        for extension in ["kgm", "kgma"] {
            let mut decoder = KgmDecoderBuilder.new_decoder(&DecoderParams {
                buffer: input.clone(),
                extension: extension.to_string(),
            });
            decoder.validate().unwrap();
            assert_eq!(decoder.decode_bytes().unwrap().to_vec(), expected);
        }
    }
}
