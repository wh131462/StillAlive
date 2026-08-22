Pod::Spec.new do |s|
  s.name           = 'StillAliveBookCover'
  s.version        = '1.0.0'
  s.summary        = 'Local PDF cover thumbnail renderer for Still Alive'
  s.author         = 'Still Alive'
  s.homepage       = 'https://github.com/wh131462/StillAlive'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Foundation', 'PDFKit', 'UIKit'
  s.swift_version  = '5.9'
end
