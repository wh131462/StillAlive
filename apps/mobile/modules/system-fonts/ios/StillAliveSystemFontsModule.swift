import ExpoModulesCore
import UIKit

public final class StillAliveSystemFontsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StillAliveSystemFonts")

    AsyncFunction("getFontFamiliesAsync") { () -> [String] in
      UIFont.familyNames
        .filter { !$0.isEmpty && !$0.hasPrefix(".") }
        .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }
  }
}
