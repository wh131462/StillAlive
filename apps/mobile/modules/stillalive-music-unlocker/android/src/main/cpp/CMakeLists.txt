cmake_minimum_required(VERSION 3.22.1)
project(stillalive_music_unlocker)

set(RUST_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../../../native")
set(RUST_MANIFEST "${RUST_ROOT}/Cargo.toml")

if(ANDROID_ABI STREQUAL "arm64-v8a")
  set(RUST_TARGET "aarch64-linux-android")
  set(ANDROID_CLANG_TARGET "aarch64-linux-android")
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
  set(RUST_TARGET "armv7-linux-androideabi")
  set(ANDROID_CLANG_TARGET "armv7a-linux-androideabi")
elseif(ANDROID_ABI STREQUAL "x86_64")
  set(RUST_TARGET "x86_64-linux-android")
  set(ANDROID_CLANG_TARGET "x86_64-linux-android")
elseif(ANDROID_ABI STREQUAL "x86")
  set(RUST_TARGET "i686-linux-android")
  set(ANDROID_CLANG_TARGET "i686-linux-android")
else()
  message(FATAL_ERROR "Unsupported Android ABI: ${ANDROID_ABI}")
endif()

find_program(CARGO_EXECUTABLE cargo)
if(NOT CARGO_EXECUTABLE)
  message(FATAL_ERROR "Rust cargo is required to build StillAliveMusicUnlocker")
endif()

set(NDK_PREBUILT "${ANDROID_NDK}/toolchains/llvm/prebuilt")
foreach(NDK_HOST_TAG darwin-arm64 darwin-x86_64 linux-x86_64 windows-x86_64)
  if(EXISTS "${NDK_PREBUILT}/${NDK_HOST_TAG}/bin")
    set(NDK_CLANG "${NDK_PREBUILT}/${NDK_HOST_TAG}/bin")
    break()
  endif()
endforeach()
if(NOT NDK_CLANG)
  message(FATAL_ERROR "Android NDK compiler directory not found under ${NDK_PREBUILT}")
endif()
set(RUST_LINKER "${NDK_CLANG}/${ANDROID_CLANG_TARGET}21-clang")
set(RUST_AR "${NDK_CLANG}/llvm-ar")
if(NOT EXISTS "${RUST_LINKER}")
  message(FATAL_ERROR "Android NDK linker not found: ${RUST_LINKER}")
endif()

string(TOUPPER "${RUST_TARGET}" RUST_TARGET_ENV)
string(REPLACE "-" "_" RUST_TARGET_ENV "${RUST_TARGET_ENV}")
set(RUST_LIBRARY "${RUST_ROOT}/target/${RUST_TARGET}/release/libstillalive_music_unlocker_core.a")
file(GLOB_RECURSE RUST_SOURCES CONFIGURE_DEPENDS "${RUST_ROOT}/src/*.rs")
add_custom_command(
  OUTPUT "${RUST_LIBRARY}"
  COMMAND "${CMAKE_COMMAND}" -E env
    "CARGO_TARGET_${RUST_TARGET_ENV}_LINKER=${RUST_LINKER}"
    "TARGET_CC=${RUST_LINKER}"
    "TARGET_AR=${RUST_AR}"
    "${CARGO_EXECUTABLE}" build --manifest-path "${RUST_MANIFEST}" --target "${RUST_TARGET}" --release
  DEPENDS "${RUST_MANIFEST}" ${RUST_SOURCES}
  WORKING_DIRECTORY "${RUST_ROOT}"
  COMMENT "Building Rust decoder for ${RUST_TARGET}"
  VERBATIM
)
add_custom_target(build_stillalive_rust_decoder DEPENDS "${RUST_LIBRARY}")

add_library(stillalive_music_unlocker_core STATIC IMPORTED GLOBAL)
set_target_properties(stillalive_music_unlocker_core PROPERTIES IMPORTED_LOCATION "${RUST_LIBRARY}")

add_library(stillalive_music_unlocker SHARED unlocker_jni.cpp)
add_dependencies(stillalive_music_unlocker build_stillalive_rust_decoder)
target_link_libraries(stillalive_music_unlocker
  stillalive_music_unlocker_core
  log
  android
  dl
  m
)
