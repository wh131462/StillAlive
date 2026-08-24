package com.eternalheart.stillalive.musicunlocker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URI

private data class UnlockMetadata(
  val extension: String,
  val mimeType: String,
  val sizeBytes: Long,
  val title: String?,
  val artist: String?,
  val album: String?,
)

class StillAliveMusicUnlockerModule : Module() {
  private external fun unlockNative(inputPath: String, outputPath: String, metadataPath: String): Int

  override fun definition() = ModuleDefinition {
    Name("StillAliveMusicUnlocker")

    AsyncFunction("unlock") { inputURI: String, outputURI: String ->
      val inputPath = filesystemPath(inputURI)
      val outputPath = filesystemPath(outputURI)
      val metadataPath = "$outputPath.metadata.json"
      val status = try {
        unlockNative(inputPath, outputPath, metadataPath)
      } catch (_: UnsatisfiedLinkError) {
        -2
      }
      if (status != 0) {
        val reason = readFailure(metadataPath)
        File(outputPath).delete()
        File(metadataPath).delete()
        File("$outputPath.partial").delete()
        File("$metadataPath.partial").delete()
        throw MusicUnlockerException(reason)
      }
      try {
        val metadata = readMetadata(metadataPath)
        if (!File(outputPath).isFile || metadata.sizeBytes <= 0) throw MusicUnlockerException()
        mapOf(
          "extension" to metadata.extension,
          "mimeType" to metadata.mimeType,
          "sizeBytes" to metadata.sizeBytes,
          "title" to metadata.title,
          "artist" to metadata.artist,
          "album" to metadata.album,
        )
      } catch (cause: Throwable) {
        File(outputPath).delete()
        throw cause
      } finally {
        File(metadataPath).delete()
      }
    }
  }

  companion object {
    init {
      try { System.loadLibrary("stillalive_music_unlocker") } catch (_: UnsatisfiedLinkError) { }
    }
  }

  private fun filesystemPath(value: String): String = if (value.startsWith("file:")) URI(value).path else value
}

private fun readMetadata(path: String): UnlockMetadata {
  val json = File(path).readText()
  fun value(key: String): String? = Regex("\\\"$key\\\"\\s*:\\s*(?:\\\"([^\\\"]*)\\\"|null)").find(json)?.groupValues?.get(1)?.ifEmpty { null }
  return UnlockMetadata(
    extension = value("extension") ?: throw MusicUnlockerException(),
    mimeType = value("mime_type") ?: throw MusicUnlockerException(),
    sizeBytes = Regex("\\\"size_bytes\\\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toLongOrNull() ?: throw MusicUnlockerException(),
    title = value("title"),
    artist = value("artist"),
    album = value("album"),
  )
}

private fun readFailure(path: String): String? {
  val file = File(path)
  if (!file.isFile) return null
  return Regex("\\\"error\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").find(file.readText())?.groupValues?.get(1)
}

private class MusicUnlockerException(reason: String? = null) :
  Exception(reason ?: "音乐容器解锁失败，格式不受支持或文件已损坏")
