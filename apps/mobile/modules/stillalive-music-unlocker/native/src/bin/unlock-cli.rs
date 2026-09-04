use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let mut args = env::args_os().skip(1);
    let Some(input) = args.next() else {
        eprintln!("usage: unlock-cli <input> [output]");
        std::process::exit(2);
    };
    let input_path = Path::new(&input);
    let bytes = fs::read(input_path).expect("read input");
    let extension = input_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let filename = input_path.file_name().and_then(|value| value.to_str());
    let unlocked = match stillalive_music_unlocker_core::unlock(&bytes, extension, filename) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("unlock failed: {error}");
            std::process::exit(1);
        }
    };
    let output = args
        .next()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| {
            let mut value = input_path.to_path_buf();
            value.set_extension(unlocked.metadata.extension.trim_start_matches('.'));
            value.to_string_lossy().into_owned()
        });
    fs::write(&output, &unlocked.bytes).expect("write output");
    eprintln!("cover={} mime={:?}", unlocked.cover.as_ref().map(|v| v.len()).unwrap_or(0), unlocked.metadata.cover_mime_type);
    if let Some(cover) = unlocked.cover.as_ref() {
        fs::write(format!("{output}.cover.bin"), cover).expect("write cover");
    }
    println!(
        "{} {} {}",
        unlocked.metadata.extension, unlocked.metadata.size_bytes, output
    );
}
