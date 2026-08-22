import ExpoModulesCore
import Foundation
import PDFKit
import UIKit

public final class StillAliveBookCoverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StillAliveBookCover")

    AsyncFunction("renderFirstPageAsync") { (inputURI: String, outputURI: String, targetWidth: Int) throws -> [String: Int] in
      guard (240...1440).contains(targetWidth) else { throw BookCoverException("封面宽度无效") }
      let input = Self.fileURL(inputURI)
      let output = Self.fileURL(outputURI)
      guard let document = PDFDocument(url: input), let page = document.page(at: 0) else {
        throw BookCoverException("PDF 没有可渲染页面")
      }

      let bounds = page.bounds(for: .mediaBox)
      guard bounds.width > 0, bounds.height > 0 else { throw BookCoverException("PDF 页面尺寸无效") }
      let height = max(1, Int((CGFloat(targetWidth) * bounds.height / bounds.width).rounded()))
      let size = CGSize(width: targetWidth, height: height)
      let renderer = UIGraphicsImageRenderer(size: size)
      let image = renderer.image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        context.cgContext.saveGState()
        context.cgContext.translateBy(x: 0, y: size.height)
        context.cgContext.scaleBy(x: size.width / bounds.width, y: -size.height / bounds.height)
        page.draw(with: .mediaBox, to: context.cgContext)
        context.cgContext.restoreGState()
      }

      guard let data = image.pngData() else { throw BookCoverException("PDF 封面编码失败") }
      do {
        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: output, options: .atomic)
        return ["width": targetWidth, "height": height]
      } catch {
        try? FileManager.default.removeItem(at: output)
        throw error
      }
    }
  }

  private static func fileURL(_ value: String) -> URL {
    if value.hasPrefix("file://"), let url = URL(string: value) { return url }
    return URL(fileURLWithPath: value)
  }
}

private final class BookCoverException: Exception {
  private let detail: String

  init(_ detail: String) {
    self.detail = detail
    super.init()
  }

  override var reason: String { detail }
}
