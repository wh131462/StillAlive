import CryptoKit
import ExpoModulesCore
import Foundation

public final class ProfileCollectionCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StillAliveProfileCollectionCrypto")

    AsyncFunction("generateKeyPair") { () -> [String: String] in
      let privateKey = P256.KeyAgreement.PrivateKey()
      return [
        "publicKey": Self.base64URL(privateKey.publicKey.x963Representation),
        "privateKey": Self.base64URL(privateKey.rawRepresentation)
      ]
    }

    AsyncFunction("decrypt") { (privateKey: String, publicKey: String, salt: String, iv: String, ciphertext: String, requestId: String) -> String in
      let privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: Self.decodeBase64URL(privateKey))
      let publicKey = try P256.KeyAgreement.PublicKey(x963Representation: Self.decodeBase64URL(publicKey))
      let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: publicKey)
      let key = sharedSecret.hkdfDerivedSymmetricKey(
        using: SHA256.self,
        salt: try Self.decodeBase64URL(salt),
        sharedInfo: Self.aad(requestId),
        outputByteCount: 32
      )
      let nonce = try AES.GCM.Nonce(data: Self.decodeBase64URL(iv))
      let encrypted = try Self.decodeBase64URL(ciphertext)
      guard encrypted.count > 16 else { throw ProfileCollectionCryptoException() }
      let sealedBox = try AES.GCM.SealedBox(
        nonce: nonce,
        ciphertext: encrypted.dropLast(16),
        tag: encrypted.suffix(16)
      )
      let plaintext = try AES.GCM.open(sealedBox, using: key, authenticating: Self.aad(requestId))
      guard let value = String(data: plaintext, encoding: .utf8) else { throw ProfileCollectionCryptoException() }
      return value
    }
  }

  private static func aad(_ requestId: String) -> Data {
    Data("stillalive-profile-response:v1:\(requestId)".utf8)
  }

  private static func base64URL(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  private static func decodeBase64URL(_ value: String) throws -> Data {
    guard !value.isEmpty, value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
      throw ProfileCollectionCryptoException()
    }
    let base64 = value
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
      .padding(toLength: value.count + (4 - value.count % 4) % 4, withPad: "=", startingAt: 0)
    guard let data = Data(base64Encoded: base64) else { throw ProfileCollectionCryptoException() }
    return data
  }
}

private final class ProfileCollectionCryptoException: Exception {
  override var reason: String { "Profile collection cryptography failed" }
}
