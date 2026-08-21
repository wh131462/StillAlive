use crypto::buffer::*;

pub fn pkcs7_unpadding(data: &[u8]) -> &[u8] {
    let length = data.len();
    let unpadding = data[length - 1] as usize;
    &data[..length - unpadding]
}

pub fn try_pkcs7_unpadding(data: &[u8]) -> Result<&[u8], String> {
    let Some(&padding) = data.last() else {
        return Err("PKCS#7 数据为空".to_string());
    };
    let padding = padding as usize;
    if padding == 0 || padding > 16 || padding > data.len() {
        return Err("PKCS#7 填充长度无效".to_string());
    }
    if !data[data.len() - padding..]
        .iter()
        .all(|&byte| byte as usize == padding)
    {
        return Err("PKCS#7 填充内容无效".to_string());
    }
    Ok(&data[..data.len() - padding])
}

pub fn decrypt_aes128ecb(data: &[u8], key: &[u8; 16]) -> Result<Vec<u8>, String> {
    use crypto::aes::*;
    let mut de = ecb_decryptor(KeySize::KeySize128, key, crypto::blockmodes::NoPadding);
    let mut final_result = Vec::<u8>::new();
    let mut read_buffer = RefReadBuffer::new(data);
    let mut buffer = [0; 4096];
    let mut write_buffer = RefWriteBuffer::new(&mut buffer);
    loop {
        let result = de
            .decrypt(&mut read_buffer, &mut write_buffer, true)
            .map_err(|e| format!("decrypt_aes128ecb failed: {:?}", e))?;
        final_result.extend(
            write_buffer
                .take_read_buffer()
                .take_remaining()
                .iter()
                .copied(),
        );
        match result {
            crypto::buffer::BufferResult::BufferUnderflow => break,
            crypto::buffer::BufferResult::BufferOverflow => {}
        }
    }
    Ok(final_result)
}
