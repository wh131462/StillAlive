import ExpoModulesCore
import Foundation

private struct UnlockMetadata: Decodable {
  let extensionName: String
  let mimeType: String
  let sizeBytes: Int
  let title: String?
  let artist: String?
  let album: String?

  enum CodingKeys: String, CodingKey {
    case extensionName = "extension"
    case mimeType = "mime_type"
    case sizeBytes = "size_bytes"
    case title
    case artist
    case album
  }
}

private struct UnlockFailure: Decodable {
  let error: String
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
        throw MusicUnlockerException(reason)
      }
      defer { try? FileManager.default.removeItem(atPath: metadataPath) }
      let metadataData = try Data(contentsOf: URL(fileURLWithPath: metadataPath))
      let metadata = try JSONDecoder().decode(UnlockMetadata.self, from: metadataData)
      guard FileManager.default.fileExists(atPath: outputPath), metadata.sizeBytes > 0 else {
        throw MusicUnlockerException()
      }
      return [
        "extension": metadata.extensionName,
        "mimeType": metadata.mimeType,
        "sizeBytes": metadata.sizeBytes,
        "title": metadata.title,
        "artist": metadata.artist,
        "album": metadata.album
      ]
    }
  }

  private static func filesystemPath(_ value: String) -> String {
    if value.hasPrefix("file://"), let url = URL(string: value) { return url.path }
    return value
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
