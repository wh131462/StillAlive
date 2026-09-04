import ExpoModulesCore
import AVFoundation
import Foundation
import UIKit

private struct UnlockMetadata: Decodable {
  let extensionName: String
  let mimeType: String
  let sizeBytes: Int
  let title: String?
  let artist: String?
  let album: String?
  let coverMimeType: String?
  let coverPath: String?

  enum CodingKeys: String, CodingKey {
    case extensionName = "extension"
    case mimeType = "mime_type"
    case sizeBytes = "size_bytes"
    case title
    case artist
    case album
    case coverMimeType = "cover_mime_type"
    case coverPath = "cover_path"
  }
}

private struct UnlockFailure: Decodable {
  let error: String
}

private struct ExtractedCover {
  let mimeType: String
  let path: String
  let sizeBytes: Int
}

@_silgen_name("stillalive_unlock_file")
private func stillalive_unlock_file(_ inputPath: UnsafePointer<CChar>, _ outputPath: UnsafePointer<CChar>, _ metadataPath: UnsafePointer<CChar>) -> Int32

public final class StillAliveMusicUnlockerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StillAliveMusicUnlocker")

    AsyncFunction("unlock") { (inputURI: String, outputURI: String) throws -> [String: Any?] in
      let inputPath = Self.filesystemPath(inputURI)
      let outputPath = Self.filesystemPath(outputURI)
      let metadataPath = outputPath + ".metadata.json"
      // Clear artifacts from an interrupted attempt before invoking Rust.
      Self.cleanupCoverFiles(outputPath)
      let status = inputPath.withCString { input in
        outputPath.withCString { output in
          metadataPath.withCString { metadata in
            stillalive_unlock_file(input, output, metadata)
          }
        }
      }
      guard status == 0 else {
        let failureData = try? Data(contentsOf: URL(fileURLWithPath: metadataPath))
        let reason: String?
        if let failureData, let failure = try? JSONDecoder().decode(UnlockFailure.self, from: failureData) {
          reason = failure.error
        } else {
          reason = nil
        }
        try? FileManager.default.removeItem(atPath: outputPath)
        try? FileManager.default.removeItem(atPath: metadataPath)
        try? FileManager.default.removeItem(atPath: outputPath + ".partial")
        try? FileManager.default.removeItem(atPath: metadataPath + ".partial")
        Self.cleanupCoverFiles(outputPath)
        throw MusicUnlockerException(reason)
      }
      defer { try? FileManager.default.removeItem(atPath: metadataPath) }
      do {
        let metadataData = try Data(contentsOf: URL(fileURLWithPath: metadataPath))
        let metadata = try JSONDecoder().decode(UnlockMetadata.self, from: metadataData)
        let existingCover = metadata.coverPath.flatMap { Self.validCoverPath($0) ? $0 : nil }
        let fallbackCover = existingCover == nil
          ? Self.extractCoverToFile(inputPath: outputPath, outputPath: outputPath + ".cover")
          : nil
        guard FileManager.default.fileExists(atPath: outputPath), metadata.sizeBytes > 0 else {
          throw MusicUnlockerException()
        }
        return [
          "extension": metadata.extensionName,
          "mimeType": metadata.mimeType,
          "sizeBytes": metadata.sizeBytes,
          "title": metadata.title,
          "artist": metadata.artist,
          "album": metadata.album,
          "coverMimeType": metadata.coverMimeType ?? fallbackCover?.mimeType,
          "coverPath": (existingCover ?? fallbackCover?.path).map { URL(fileURLWithPath: $0).absoluteString }
        ]
      } catch {
        Self.cleanupCoverFiles(outputPath)
        throw error
      }
    }

    AsyncFunction("extractCover") { (inputURI: String, outputURI: String) -> [String: Any?]? in
      guard let cover = Self.extractCoverToFile(
        inputPath: Self.filesystemPath(inputURI),
        outputPath: Self.filesystemPath(outputURI),
      ) else { return nil }
      return [
        "coverMimeType": cover.mimeType,
        "coverPath": URL(fileURLWithPath: cover.path).absoluteString,
        "sizeBytes": cover.sizeBytes,
      ]
    }
  }

  private static func filesystemPath(_ value: String) -> String {
    if value.lowercased().hasPrefix("file:"), let url = URL(string: value), url.isFileURL { return url.path }
    return value
  }

  private static func extractCoverToFile(inputPath: String, outputPath: String) -> ExtractedCover? {
    guard !inputPath.isEmpty, !outputPath.isEmpty else { return nil }
    let outputURL = URL(fileURLWithPath: outputPath)
    let partialURL = URL(fileURLWithPath: outputPath + ".partial")
    var committed = false
    defer {
      if !committed {
        try? FileManager.default.removeItem(at: outputURL)
        try? FileManager.default.removeItem(at: partialURL)
      }
    }
    do {
      let inputURL = URL(fileURLWithPath: inputPath)
      let asset = AVURLAsset(url: inputURL)
      let artwork = (asset.commonMetadata + asset.metadata).first { item in
        item.commonKey?.rawValue == "artwork"
          || item.identifier?.rawValue == "com.apple.common-key.artwork"
          || item.identifier?.rawValue == "org.id3/APIC"
      }
      guard var imageData = artwork?.dataValue, !imageData.isEmpty, imageData.count <= 32 * 1024 * 1024 else { return nil }
      var mimeType = imageMimeType(imageData)
      if mimeType == nil, let image = UIImage(data: imageData), let jpeg = image.jpegData(compressionQuality: 0.95) {
        imageData = jpeg
        mimeType = "image/jpeg"
      }
      guard let mimeType else { return nil }
      try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
      try? FileManager.default.removeItem(at: outputURL)
      try? FileManager.default.removeItem(at: partialURL)
      try imageData.write(to: partialURL, options: .atomic)
      guard FileManager.default.fileExists(atPath: partialURL.path),
            (try FileManager.default.attributesOfItem(atPath: partialURL.path)[.size] as? NSNumber)?.intValue == imageData.count else { return nil }
      try FileManager.default.moveItem(at: partialURL, to: outputURL)
      committed = true
      return ExtractedCover(mimeType: mimeType, path: outputURL.path, sizeBytes: imageData.count)
    } catch {
      return nil
    }
  }

  private static func imageMimeType(_ data: Data) -> String? {
    let bytes = [UInt8](data.prefix(12))
    if bytes.count >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF { return "image/jpeg" }
    if bytes.count >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A { return "image/png" }
    if bytes.count >= 12 && Array(bytes[0...3]) == [0x52, 0x49, 0x46, 0x46] && Array(bytes[8...11]) == [0x57, 0x45, 0x42, 0x50] { return "image/webp" }
    if bytes.count >= 6 && (Array(bytes[0...5]) == [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] || Array(bytes[0...5]) == [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) { return "image/gif" }
    if bytes.count >= 2 && bytes[0] == 0x42 && bytes[1] == 0x4D { return "image/bmp" }
    if bytes.count >= 4 && ((Array(bytes[0...3]) == [0x49, 0x49, 0x2A, 0x00]) || Array(bytes[0...3]) == [0x4D, 0x4D, 0x00, 0x2A] || Array(bytes[0...3]) == [0x49, 0x49, 0x2B, 0x00] || Array(bytes[0...3]) == [0x4D, 0x4D, 0x00, 0x2B]) { return "image/tiff" }
    if bytes.count >= 4 && bytes[0] == 0xFF && bytes[1] == 0x4F && bytes[2] == 0xFF && bytes[3] == 0x51 { return "image/jp2" }
    if bytes.count >= 12 && Array(bytes[0...11]) == [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A] { return "image/jp2" }
    if bytes.count >= 12 && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70 {
      let brand = String(bytes: bytes[8..<12], encoding: .ascii) ?? ""
      if ["heic", "heix", "heis", "hevc", "hevx", "hevm", "hevs", "heim", "mif1", "msf1"].contains(brand) { return "image/heic" }
      if brand == "avif" || brand == "avis" { return "image/avif" }
    }
    return nil
  }

  private static func cleanupCoverFiles(_ outputPath: String) {
    for suffix in [".cover", ".cover.jpg", ".cover.png", ".cover.bmp", ".cover.webp", ".cover.gif", ".cover.heic", ".cover.avif", ".cover.tiff", ".cover.jp2", ".cover.partial", ".cover.jpg.partial", ".cover.png.partial", ".cover.bmp.partial", ".cover.webp.partial", ".cover.gif.partial", ".cover.heic.partial", ".cover.avif.partial", ".cover.tiff.partial", ".cover.jp2.partial"] {
      try? FileManager.default.removeItem(atPath: outputPath + suffix)
    }
  }

  private static func validCoverPath(_ path: String) -> Bool {
    guard FileManager.default.fileExists(atPath: path),
          let attributes = try? FileManager.default.attributesOfItem(atPath: path),
          let size = attributes[.size] as? NSNumber,
          size.intValue > 0,
          size.intValue <= 32 * 1024 * 1024,
          let data = try? Data(contentsOf: URL(fileURLWithPath: path), options: [.mappedIfSafe]) else { return false }
    return imageMimeType(data) != nil || UIImage(data: data) != nil
  }
}

private final class MusicUnlockerException: Exception {
  private let detail: String

  init(_ detail: String? = nil) {
    self.detail = detail ?? "音乐容器解锁失败，格式不受支持或文件已损坏"
    super.init()
  }

  override var reason: String { detail }
}
