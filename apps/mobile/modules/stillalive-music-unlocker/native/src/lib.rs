pub mod algo;
pub mod internal;
mod transcode;
pub mod unlocker;

pub use internal::helpers::*;

pub use unlocker::{unlock, UnlockMetadata, UnlockOutput};

#[cfg(target_arch = "aarch64")]
#[no_mangle]
pub unsafe extern "C" fn rust_crypto_util_fixed_time_eq_asm(
    lhs: *const u8,
    rhs: *const u8,
    count: usize,
) -> u32 {
    if count == 0 {
        return 1;
    }

    let mut difference = 0u8;
    for index in 0..count {
        difference |=
            std::ptr::read_volatile(lhs.add(index)) ^ std::ptr::read_volatile(rhs.add(index));
    }
    u32::from(difference)
}
