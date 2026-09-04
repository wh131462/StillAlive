pub trait Sniffer {
    fn sniff(&self, header: &[u8]) -> bool;
}

// audio extension detection

pub fn audio_extension(header: &[u8]) -> Option<String> {
    if PrefixSniffer(b"ID3".to_vec()).sniff(header) {
        return Some(".mp3".to_string());
    }
    if header.len() >= 2
        && header[0] == 0xFF
        && (header[1] & 0xF0) == 0xF0
        && (header[1] & 0x06) == 0
    {
        return Some(".aac".to_string());
    }
    if header.len() >= 2
        && header[0] == 0xFF
        && (header[1] & 0xE0) == 0xE0
        && (header[1] & 0x06) != 0
    {
        return Some(".mp3".to_string());
    }
    if PrefixSniffer(b"OggS".to_vec()).sniff(header) {
        return Some(".ogg".to_string());
    }
    if header.len() >= 12
        && PrefixSniffer(b"RIFF".to_vec()).sniff(header)
        && &header[8..12] == b"WAVE"
    {
        return Some(".wav".to_string());
    }
    if PrefixSniffer(vec![
        0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce,
        0x6c,
    ])
    .sniff(header)
    {
        return Some(".wma".to_string()); // wma header
    }
    if M4aSniffer.sniff(header) {
        return Some(".m4a".to_string());
    }
    if Mpeg4Sniffer.sniff(header) {
        return Some(".mp4".to_string());
    }
    if PrefixSniffer(b"fLaC".to_vec()).sniff(header) {
        return Some(".flac".to_string());
    }
    if PrefixSniffer(b"FRM8".to_vec()).sniff(header) {
        return Some(".dff".to_string());
    }
    None
}

pub fn audio_extension_with_fallback(header: &[u8], fallback: String) -> String {
    let ext = audio_extension(header);
    ext.unwrap_or(fallback)
}

#[derive(Clone)]
pub struct PrefixSniffer(Vec<u8>);

impl Sniffer for PrefixSniffer {
    fn sniff(&self, header: &[u8]) -> bool {
        header.starts_with(&self.0)
    }
}

#[derive(Clone)]
pub struct M4aSniffer;

impl Sniffer for M4aSniffer {
    fn sniff(&self, header: &[u8]) -> bool {
        let mpeg4box = read_mpeg4_ftype_box(header);
        if let Some(mpeg4box) = mpeg4box {
            return mpeg4box.major_brand == "M4A "
                || mpeg4box.compatible_brands.contains(&"M4A ".to_string());
        }
        false
    }
}

#[derive(Clone)]
pub struct Mpeg4Sniffer;

impl Sniffer for Mpeg4Sniffer {
    fn sniff(&self, header: &[u8]) -> bool {
        read_mpeg4_ftype_box(header).is_some()
    }
}

#[derive(Clone)]
pub struct Mpeg4FtypeBox {
    pub major_brand: String,
    pub minor_version: u32,
    pub compatible_brands: Vec<String>,
}

pub fn read_mpeg4_ftype_box(header: &[u8]) -> Option<Mpeg4FtypeBox> {
    if (header.len() < 8) || !header[4..8].eq(b"ftyp") {
        return None;
    }

    let size = u32::from_be_bytes(header[0..4].try_into().unwrap());
    if size < 16 || size % 4 != 0 {
        return None;
    }

    let box_end = size as usize;
    if box_end > header.len() {
        return None;
    }
    let mpeg4box = Mpeg4FtypeBox {
        major_brand: String::from_utf8_lossy(&header[8..12]).to_string(),
        minor_version: u32::from_be_bytes(header[12..16].try_into().unwrap()),
        compatible_brands: header[16..box_end]
            .chunks(4)
            .map(|c| String::from_utf8_lossy(c).to_string())
            .collect(),
    };
    Some(mpeg4box)
}

// image extension detection

pub fn image_mime(header: &[u8]) -> Option<String> {
    if PrefixSniffer(vec![0xFF, 0xD8, 0xFF]).sniff(header) {
        return Some("image/jpeg".to_string());
    }
    if PrefixSniffer(vec![0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1A, b'\n']).sniff(header) {
        return Some("image/png".to_string());
    }
    if PrefixSniffer(b"BM".to_vec()).sniff(header) {
        return Some("image/bmp".to_string());
    }
    if header.len() >= 12
        && PrefixSniffer(b"RIFF".to_vec()).sniff(header)
        && &header[8..12] == b"WEBP"
    {
        return Some("image/webp".to_string());
    }
    if PrefixSniffer(b"GIF8".to_vec()).sniff(header) {
        return Some("image/gif".to_string());
    }
    if header.len() >= 4
        && ((&header[0..4] == b"II*\0")
            || (&header[0..4] == b"MM\0*")
            || (&header[0..4] == b"II+\0")
            || (&header[0..4] == b"MM\0+"))
    {
        return Some("image/tiff".to_string());
    }
    if (header.len() >= 12 && &header[0..12] == b"\0\0\0\x0cjP  \r\n\x87\n")
        || (header.len() >= 4 && &header[0..4] == [0xff, 0x4f, 0xff, 0x51])
    {
        return Some("image/jp2".to_string());
    }
    if let Some(mime) = iso_image_mime(header) {
        return Some(mime.to_string());
    }
    None
}

pub fn image_extension(header: &[u8]) -> Option<String> {
    if PrefixSniffer(vec![0xFF, 0xD8, 0xFF]).sniff(header) {
        return Some(".jpg".to_string());
    }
    if PrefixSniffer(vec![0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1A, b'\n']).sniff(header) {
        return Some(".png".to_string());
    }
    if PrefixSniffer(b"BM".to_vec()).sniff(header) {
        return Some(".bmp".to_string());
    }
    if header.len() >= 12
        && PrefixSniffer(b"RIFF".to_vec()).sniff(header)
        && &header[8..12] == b"WEBP"
    {
        return Some(".webp".to_string());
    }
    if PrefixSniffer(b"GIF8".to_vec()).sniff(header) {
        return Some(".gif".to_string());
    }
    if header.len() >= 4
        && ((&header[0..4] == b"II*\0")
            || (&header[0..4] == b"MM\0*")
            || (&header[0..4] == b"II+\0")
            || (&header[0..4] == b"MM\0+"))
    {
        return Some(".tiff".to_string());
    }
    if (header.len() >= 12 && &header[0..12] == b"\0\0\0\x0cjP  \r\n\x87\n")
        || (header.len() >= 4 && &header[0..4] == [0xff, 0x4f, 0xff, 0x51])
    {
        return Some(".jp2".to_string());
    }
    if let Some(mime) = iso_image_mime(header) {
        return Some(if mime == "image/avif" {
            ".avif".to_string()
        } else {
            ".heic".to_string()
        });
    }
    None
}

fn iso_image_mime(header: &[u8]) -> Option<&'static str> {
    if header.len() < 12 || &header[4..8] != b"ftyp" {
        return None;
    }
    let declared_size = u32::from_be_bytes(header[0..4].try_into().ok()?) as usize;
    let end = if declared_size >= 16 && declared_size <= header.len() {
        declared_size
    } else {
        header.len()
    };
    for brand in header[8..end].chunks_exact(4) {
        if matches!(
            brand,
            b"heic" | b"heix" | b"heis" | b"hevc" | b"hevx" | b"hevm" | b"hevs" | b"heim"
                | b"mif1" | b"msf1"
        ) {
            return Some("image/heic");
        }
        if matches!(brand, b"avif" | b"avis") {
            return Some("image/avif");
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_supported_audio_headers_without_extension_fallback() {
        assert_eq!(
            audio_extension(b"ID3\x04\x00\x00"),
            Some(".mp3".to_string())
        );
        assert_eq!(
            audio_extension(&[0xFF, 0xFB, 0x90, 0x64]),
            Some(".mp3".to_string())
        );
        assert_eq!(
            audio_extension(&[0xFF, 0xF1, 0x50, 0x80]),
            Some(".aac".to_string())
        );
        assert_eq!(audio_extension(b"fLaC\x00\x00"), Some(".flac".to_string()));
        assert_eq!(audio_extension(b"OggS\x00\x02"), Some(".ogg".to_string()));
        assert_eq!(
            audio_extension(b"RIFF\x00\x00\x00\x00WAVE"),
            Some(".wav".to_string())
        );
        assert_eq!(audio_extension(b"RIFF\x00\x00\x00\x00AVI "), None);
    }

    #[test]
    fn only_treats_webp_riff_containers_as_webp() {
        assert_eq!(image_mime(b"RIFF\x00\x00\x00\x00WEBPVP8 "), Some("image/webp".to_string()));
        assert_eq!(image_extension(b"RIFF\x00\x00\x00\x00WAVEfmt "), None);
    }

    #[test]
    fn recognizes_png_signature() {
        let png = b"\x89PNG\r\n\x1a\n";
        assert_eq!(image_mime(png), Some("image/png".to_string()));
        assert_eq!(image_extension(png), Some(".png".to_string()));
    }

    #[test]
    fn recognizes_extended_image_signatures() {
        assert_eq!(image_mime(b"II*\0"), Some("image/tiff".to_string()));
        assert_eq!(image_extension(b"MM\0*"), Some(".tiff".to_string()));
        assert_eq!(
            image_mime(b"\0\0\0\x0cjP  \r\n\x87\n"),
            Some("image/jp2".to_string())
        );
        assert_eq!(
            image_extension(b"\0\0\0\x18ftypavif\0\0\0\0avif"),
            Some(".avif".to_string())
        );
        assert_eq!(
            image_mime(b"\0\0\0\x18ftypmif1\0\0\0\0heic"),
            Some("image/heic".to_string())
        );
    }
}
