Pod::Spec.new do |s|
  s.name           = 'StillAliveSystemFonts'
  s.version        = '1.0.0'
  s.summary        = 'System font family enumeration for Still Alive'
  s.author         = 'Still Alive'
  s.homepage       = 'https://github.com/wh131462/StillAlive'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Foundation', 'UIKit'
  s.swift_version  = '5.9'
end
