use bytes::*;
use std::collections::HashMap;

#[derive(Clone)]
pub struct DecoderParams {
    pub buffer: Bytes,
    pub extension: String,
}

#[derive(Clone)]
pub enum DecoderType {
    Raw,
    Ncm,
    Kgm,
    Qmc,
}

impl DecoderType {
    pub fn get_decoder(&self) -> Box<dyn super::DecoderBuilder> {
        match self {
            DecoderType::Raw => Box::new(super::raw::RawDecoderBuilder),
            DecoderType::Ncm => Box::new(super::super::ncm::NcmDecoderBuilder),
            DecoderType::Kgm => Box::new(super::super::kgm::KgmDecoderBuilder),
            DecoderType::Qmc => Box::new(super::super::qmc::QmcDecoderBuilder),
        }
    }
}

pub struct DecoderMap(pub HashMap<String, Vec<(DecoderType, bool)>>);

impl DecoderMap {
    pub fn register(&mut self, ext: &str, noop: bool, decoder_type: DecoderType) {
        match self.0.get_mut(ext) {
            Some(v) => v.push((decoder_type, noop)),
            None => {
                self.0.insert(ext.to_string(), vec![(decoder_type, noop)]);
            }
        }
    }
    pub fn get(&self, ext: &str, skip_noop: bool) -> Vec<DecoderType> {
        if let Some(decoders) = self.0.get(ext) {
            if skip_noop {
                decoders
                    .iter()
                    .filter(|(_, noop)| !*noop)
                    .map(|(decoder_type, _)| decoder_type.clone())
                    .collect()
            } else {
                decoders
                    .iter()
                    .map(|(decoder_type, _)| decoder_type.clone())
                    .collect()
            }
        } else {
            Vec::new()
        }
    }
}

pub static DECODER_MAP: std::sync::OnceLock<DecoderMap> = std::sync::OnceLock::new();
pub fn get_static_decoder_map() -> &'static DecoderMap {
    DECODER_MAP.get_or_init(|| {
        use DecoderType::*;
        let mut map = DecoderMap(HashMap::new());
        map.register("mp3", true, Raw);
        map.register("flac", true, Raw);
        map.register("ogg", true, Raw);
        map.register("m4a", true, Raw);
        map.register("wav", true, Raw);
        map.register("wma", true, Raw);
        map.register("aac", true, Raw);
        // StillAlive first release: only the declared local music containers are routed.
        map.register("kgm", false, Kgm);
        map.register("kgma", false, Kgm);
        map.register("ncm", false, Ncm);
        map.register("qmc0", false, Qmc);
        map.register("qmc3", false, Qmc);
        map.register("qmc2", false, Qmc);
        map.register("qmc4", false, Qmc);
        map.register("qmc6", false, Qmc);
        map.register("qmc8", false, Qmc);
        map.register("qmcflac", false, Qmc);
        map.register("qmcogg", false, Qmc);
        map.register("mgg", false, Qmc);
        map.register("mgg1", false, Qmc);
        map.register("mggl", false, Qmc);
        map.register("mflac", false, Qmc);
        map.register("mflac0", false, Qmc);
        map.register("mflach", false, Qmc);
        map
    })
}
