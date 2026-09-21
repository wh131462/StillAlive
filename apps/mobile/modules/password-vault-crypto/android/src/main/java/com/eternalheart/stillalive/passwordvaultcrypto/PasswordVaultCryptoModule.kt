package com.eternalheart.stillalive.passwordvaultcrypto

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.nio.charset.StandardCharsets

private const val SALT_BYTES = 16
private const val KEY_BYTES = 32

class PasswordVaultCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StillAlivePasswordVaultCrypto")

    AsyncFunction("deriveArgon2idAsync") { password: String, saltBase64: String, memoryCostKiB: Int, timeCost: Int, parallelism: Int, keyLength: Int ->
      require(memoryCostKiB in 16_384..262_144) { "Argon2 memory cost is invalid" }
      require(timeCost in 1..10) { "Argon2 time cost is invalid" }
      require(parallelism in 1..4) { "Argon2 parallelism is invalid" }
      require(keyLength == KEY_BYTES) { "Argon2 key length is invalid" }

      val salt = Base64.decode(saltBase64, Base64.DEFAULT)
      require(salt.size == SALT_BYTES) { "Argon2 salt is invalid" }
      val passwordBytes = password.toByteArray(StandardCharsets.UTF_8)
      val output = ByteArray(keyLength)
      try {
        val parameters = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
          .withVersion(Argon2Parameters.ARGON2_VERSION_13)
          .withSalt(salt)
          .withMemoryAsKB(memoryCostKiB)
          .withIterations(timeCost)
          .withParallelism(parallelism)
          .build()
        Argon2BytesGenerator().apply {
          init(parameters)
          generateBytes(passwordBytes, output)
        }
        Base64.encodeToString(output, Base64.NO_WRAP)
      } finally {
        passwordBytes.fill(0)
        salt.fill(0)
        output.fill(0)
      }
    }
  }
}
