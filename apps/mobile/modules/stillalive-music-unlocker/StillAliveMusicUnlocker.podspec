Pod::Spec.new do |s|
  s.name           = 'StillAliveMusicUnlocker'
  s.version        = '0.1.0'
  s.summary        = 'Local encrypted music container unlocker for StillAlive'
  s.author         = 'StillAlive'
  s.homepage       = 'https://github.com/wh131462/StillAlive'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/wh131462/StillAlive.git', :tag => s.version.to_s }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
  s.frameworks      = 'Foundation'
  s.pod_target_xcconfig = {
    'LIBRARY_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/native/build/$(CONFIGURATION)"',
    'OTHER_LDFLAGS' => '$(inherited) -force_load "$(PODS_TARGET_SRCROOT)/native/build/$(CONFIGURATION)/libstillalive_music_unlocker_core.a"'
  }
  s.user_target_xcconfig = {
    'LIBRARY_SEARCH_PATHS' => '$(inherited) "$(PODS_ROOT)/../../modules/stillalive-music-unlocker/native/build/$(CONFIGURATION)"',
    'OTHER_LDFLAGS' => '$(inherited) -force_load "$(PODS_ROOT)/../../modules/stillalive-music-unlocker/native/build/$(CONFIGURATION)/libstillalive_music_unlocker_core.a"'
  }
  s.script_phase = {
    :name => 'Build StillAlive Rust decoder',
    :execution_position => :before_compile,
    :shell_path => '/bin/sh',
    :script => <<-'SCRIPT'
set -eu

root="${PODS_TARGET_SRCROOT}/native"
if [ "${PLATFORM_NAME}" = "iphoneos" ]; then
  target="aarch64-apple-ios"
else
  simulator_archs="${ARCHS:-${CURRENT_ARCH}}"
  simulator_sdk="$(xcrun --sdk iphonesimulator --show-sdk-path)"
  deployment_target="${IPHONEOS_DEPLOYMENT_TARGET:-16.4}"
  case "${simulator_archs}" in
    *arm64*)
      target="aarch64-apple-ios-sim"
      export CFLAGS_aarch64_apple_ios_sim="-target arm64-apple-ios${deployment_target}-simulator -isysroot ${simulator_sdk}"
      ;;
    *x86_64*)
      target="x86_64-apple-ios"
      export CFLAGS_x86_64_apple_ios="-target x86_64-apple-ios${deployment_target}-simulator -isysroot ${simulator_sdk}"
      ;;
    *)
      echo "error: Unsupported iOS simulator architecture: ${simulator_archs}" >&2
      exit 1
      ;;
  esac
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: Rust cargo is required to build StillAliveMusicUnlocker" >&2
  exit 1
fi

cargo build --manifest-path "${root}/Cargo.toml" --target "${target}" --release
mkdir -p "${root}/build/${CONFIGURATION}"
cp "${root}/target/${target}/release/libstillalive_music_unlocker_core.a" \
  "${root}/build/${CONFIGURATION}/libstillalive_music_unlocker_core.a"
    SCRIPT
  }
  s.swift_version  = '5.9'
end
