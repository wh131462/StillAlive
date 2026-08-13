Pod::Spec.new do |s|
  s.name           = 'StillAliveProfileCollectionCrypto'
  s.version        = '1.0.0'
  s.summary        = 'Native profile collection cryptography for Still Alive'
  s.description    = 'Uses CryptoKit for the encrypted profile collection protocol.'
  s.author         = 'Still Alive'
  s.homepage       = 'https://still-alive.me'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.9'
end
