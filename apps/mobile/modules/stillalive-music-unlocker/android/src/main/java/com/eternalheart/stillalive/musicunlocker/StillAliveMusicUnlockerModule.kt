package com.eternalheart.stillalive.musicunlocker

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.URI

private const val MAX_COVER_BYTES = 32L * 1024L * 1024L

private data class UnlockMetadata(
  val extension: String,
  val mimeType: String,
  val sizeBytes: Long,
  val title: String?,
  val artist: String?,
  val album: String?,
  val coverMimeType: String?,
  val coverPath: String?,
)

private data class ExtractedCover(
  val mimeType: String,
  val path: String,
  val sizeBytes: Long,
)

private data class AudioSourceInfo(
  val id: Long?,
  val albumId: Long?,
  val dataPath: String?,
)

private fun Cursor.longOrNull(column: String): Long? {
  val index = getColumnIndex(column)
  return if (index >= 0 && !isNull(index)) getLong(index) else null
}

private fun Cursor.stringOrNull(column: String): String? {
  val index = getColumnIndex(column)
  return if (index >= 0 && !isNull(index)) getString(index) else null
}

class StillAliveMusicUnlockerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private external fun unlockNative(inputPath: String, outputPath: String, metadataPath: String): Int

  override fun definition() = ModuleDefinition {
    Name("StillAliveMusicUnlocker")

    AsyncFunction("unlock") { inputURI: String, outputURI: String ->
      val inputPath = filesystemPath(inputURI)
      val outputPath = filesystemPath(outputURI)
      val metadataPath = "$outputPath.metadata.json"
      // The JS caller normally uses a unique output path, but remove leftovers
      // when a retry reuses one so an old artwork sidecar cannot be returned.
      cleanupCoverFiles(outputPath)
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
        cleanupCoverFiles(outputPath)
        throw MusicUnlockerException(reason)
      }
      try {
        val metadata = readMetadata(metadataPath)
        // Some decoders preserve artwork in the decoded stream without exposing
        // it through the Rust metadata interface. Ask Android's media stack as
        // a second source before returning to JavaScript.
        val nativeCover = metadata.coverPath
          ?.let { path -> File(path).takeIf { it.isFile && it.length() > 0L } }
        val fallbackCover = if (nativeCover == null) {
          cleanupCoverFiles(outputPath)
          extractCoverToFile(outputPath, "$outputPath.cover")
        } else {
          null
        }
        val coverMimeType = metadata.coverMimeType ?: fallbackCover?.mimeType
        // A decoder can report a stale sidecar path after a retry. Prefer the
        // file that was actually validated, then use the platform fallback.
        val coverPath = nativeCover?.absolutePath ?: fallbackCover?.path
        if (!File(outputPath).isFile || metadata.sizeBytes <= 0) throw MusicUnlockerException()
        mapOf(
          "extension" to metadata.extension,
          "mimeType" to metadata.mimeType,
          "sizeBytes" to metadata.sizeBytes,
          "title" to metadata.title,
          "artist" to metadata.artist,
          "album" to metadata.album,
          "coverMimeType" to coverMimeType,
          "coverPath" to coverPath?.let { File(it).toURI().toString() },
        )
      } catch (cause: Throwable) {
        File(outputPath).delete()
        cleanupCoverFiles(outputPath)
        throw cause
      } finally {
        File(metadataPath).delete()
      }
    }

    AsyncFunction("extractCover") { inputURI: String, outputURI: String ->
      extractCoverToFile(inputURI, filesystemPath(outputURI))?.let { cover ->
        mapOf(
          "coverMimeType" to cover.mimeType,
          "coverPath" to File(cover.path).toURI().toString(),
          "sizeBytes" to cover.sizeBytes,
        )
      }
    }
  }

  companion object {
    init {
      try { System.loadLibrary("stillalive_music_unlocker") } catch (_: UnsatisfiedLinkError) { }
    }
  }

  private fun filesystemPath(value: String): String = if (value.startsWith("file:", ignoreCase = true)) {
    URI(value).path ?: throw IllegalArgumentException("文件地址无效")
  } else {
    value
  }

  private fun extractCoverToFile(input: String, outputPath: String): ExtractedCover? {
    require(outputPath.isNotBlank()) { "封面输出地址为空" }
    val output = File(outputPath)
    val partial = File("$outputPath.partial")
    check(!output.exists() || output.delete()) { "无法覆盖旧封面文件" }
    partial.delete()

    var committed = false
    try {
      val sourceInfo = parseAudioSourceInfo(input)
      val candidates = sequence {
        yield(readEmbeddedPicture(input))
        yield(readMediaStoreAlbumArt(input, sourceInfo))
        yield(readSidecarPicture(input, sourceInfo?.dataPath))
      }
      for (picture in candidates) {
        if (picture == null || picture.isEmpty() || picture.size.toLong() > MAX_COVER_BYTES) continue
        val mimeType = imageMimeType(picture) ?: continue
        val extracted = writeCoverAtomically(picture, mimeType, output, partial)
        if (extracted != null) {
          committed = true
          return extracted
        }
      }
      return null
    } finally {
      if (!committed) {
        output.delete()
        partial.delete()
      }
    }
  }

  /**
   * Read artwork embedded in the selected file. This is deliberately kept as
   * the first probe because it is deterministic and does not need any media
   * provider access.
   */
  private fun readEmbeddedPicture(input: String): ByteArray? {
    val retriever = MediaMetadataRetriever()
    return try {
      setDataSource(retriever, input)
      retriever.embeddedPicture
    } catch (_: IllegalArgumentException) {
      null
    } catch (_: Exception) {
      null
    } finally {
      try { retriever.release() } catch (_: Exception) { }
    }
  }

  private fun writeCoverAtomically(
    bytes: ByteArray,
    mimeType: String,
    output: File,
    partial: File,
  ): ExtractedCover? {
    return try {
      output.parentFile?.mkdirs()
      partial.delete()
      FileOutputStream(partial).use { stream ->
        stream.write(bytes)
        stream.flush()
      }
      if (!partial.isFile || partial.length() != bytes.size.toLong()) return null
      if (!partial.renameTo(output)) return null
      ExtractedCover(mimeType, output.absolutePath, output.length())
    } catch (_: Exception) {
      partial.delete()
      output.delete()
      null
    }
  }

  private fun parseAudioSourceInfo(input: String): AudioSourceInfo? {
    val uri = Uri.parse(input)
    val parsedId = parseMediaId(uri)
    if (uri.scheme?.lowercase() != "content") {
      return parsedId?.let { AudioSourceInfo(it, null, null) }
    }

    val resolver = context.contentResolver
    val projection = arrayOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.DATA,
    )
    val queried = runCatching {
      resolver.query(uri, projection, null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        AudioSourceInfo(
          cursor.longOrNull(MediaStore.Audio.Media._ID) ?: parsedId,
          cursor.longOrNull(MediaStore.Audio.Media.ALBUM_ID),
          cursor.stringOrNull(MediaStore.Audio.Media.DATA),
        )
      }
    }.getOrNull()
    if (queried != null) return queried

    // Some providers reject the deprecated DATA column. Retry with only the
    // stable identifiers so a granted document URI can still reach album art.
    return runCatching {
      resolver.query(
        uri,
        arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.ALBUM_ID),
        null,
        null,
        null,
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        AudioSourceInfo(
          cursor.longOrNull(MediaStore.Audio.Media._ID) ?: parsedId,
          cursor.longOrNull(MediaStore.Audio.Media.ALBUM_ID),
          null,
        )
      }
    }.getOrNull() ?: parsedId?.let { AudioSourceInfo(it, null, null) }
  }

  private fun parseMediaId(uri: Uri): Long? {
    val authority = uri.authority.orEmpty()
    val mediaProvider = authority == MediaStore.AUTHORITY || authority.contains("media.documents", ignoreCase = true)
    if (mediaProvider) uri.lastPathSegment?.toLongOrNull()?.let { return it }
    if (!mediaProvider && !runCatching { DocumentsContract.isDocumentUri(context, uri) }.getOrDefault(false)) return null
    return runCatching {
      DocumentsContract.getDocumentId(uri).substringAfterLast(':').toLongOrNull()
    }.getOrNull()
  }

  private fun readMediaStoreAlbumArt(input: String, info: AudioSourceInfo?): ByteArray? {
    val uri = Uri.parse(input)
    if (uri.scheme?.lowercase() != "content") return null
    val candidates = linkedSetOf<Uri>()
    if (uri.authority == MediaStore.AUTHORITY && uri.path.orEmpty().contains("/audio/media/")) {
      candidates += uri.buildUpon().appendPath("albumart").build()
    }
    val mediaId = info?.id ?: parseMediaId(uri)
    if (mediaId != null && mediaId > 0) {
      candidates += MediaStore.Audio.Media.getContentUri("external", mediaId)
        .buildUpon().appendPath("albumart").build()
    }
    val albumId = info?.albumId
    if (albumId != null && albumId > 0) {
      candidates += ContentUris.withAppendedId(
        Uri.parse("content://${MediaStore.AUTHORITY}/external/audio/albumart"),
        albumId,
      )
    }
    for (candidate in candidates) {
      val bytes = readContentBytes(candidate)
      if (bytes != null && bytes.isNotEmpty()) return bytes
    }
    return null
  }

  private fun readSidecarPicture(input: String, dataPath: String?): ByteArray? {
    val candidatePaths = linkedSetOf<String>()
    dataPath?.takeIf { it.isNotBlank() }?.let { addSidecarPaths(candidatePaths, File(it).parentFile) }
    val uri = Uri.parse(input)
    val localPath = when (uri.scheme?.lowercase()) {
      "file" -> runCatching { filesystemPath(input) }.getOrNull()
      null, "" -> input
      else -> null
    }
    localPath?.let { addSidecarPaths(candidatePaths, File(it).parentFile) }
    for (path in candidatePaths) {
      val bytes = readLocalBytes(File(path))
      if (bytes != null && bytes.isNotEmpty()) return bytes
    }
    return null
  }

  private fun addSidecarPaths(paths: MutableSet<String>, parent: File?) {
    if (parent == null || !parent.isDirectory) return
    val expected = setOf(
      "cover.jpg", "cover.jpeg", "cover.png", "cover.webp",
      "folder.jpg", "folder.jpeg", "folder.png", "folder.webp",
      "albumart.jpg", "albumart.jpeg", "albumart.png", "albumart.webp",
      "front.jpg", "front.jpeg", "front.png", "front.webp",
      "artwork.jpg", "artwork.jpeg", "artwork.png", "artwork.webp",
      "albumartsmall.jpg", "albumartsmall.jpeg", "albumartsmall.png",
    )
    runCatching {
      parent.listFiles()?.forEach { file ->
        if (file.isFile && expected.contains(file.name.lowercase())) paths += file.absolutePath
      }
    }
  }

  private fun readLocalBytes(file: File): ByteArray? {
    if (!file.isFile || file.length() <= 0L || file.length() > MAX_COVER_BYTES) return null
    return runCatching { file.inputStream().use { it.readBytes() } }.getOrNull()
  }

  private fun readContentBytes(uri: Uri): ByteArray? {
    return runCatching {
      context.contentResolver.openInputStream(uri)?.use { stream ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0L
        while (true) {
          val count = stream.read(buffer)
          if (count < 0) break
          total += count
          if (total > MAX_COVER_BYTES) return@use null
          output.write(buffer, 0, count)
        }
        output.toByteArray()
      }
    }.getOrNull()
  }

  private fun setDataSource(retriever: MediaMetadataRetriever, input: String) {
    val uri = Uri.parse(input)
    when (uri.scheme?.lowercase()) {
      "content", "android.resource" -> retriever.setDataSource(context, uri)
      "file" -> retriever.setDataSource(filesystemPath(input))
      null, "" -> retriever.setDataSource(input)
      else -> throw IllegalArgumentException("仅支持本地音频地址")
    }
  }

  private fun imageMimeType(bytes: ByteArray): String? {
    if (bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()) {
      return "image/jpeg"
    }
    if (bytes.size >= 8 && bytes[0] == 0x89.toByte() && bytes[1] == 'P'.code.toByte() && bytes[2] == 'N'.code.toByte() && bytes[3] == 'G'.code.toByte()) {
      return "image/png"
    }
    if (bytes.size >= 12 && bytes.copyOfRange(0, 4).contentEquals(byteArrayOf('R'.code.toByte(), 'I'.code.toByte(), 'F'.code.toByte(), 'F'.code.toByte())) && bytes.copyOfRange(8, 12).contentEquals(byteArrayOf('W'.code.toByte(), 'E'.code.toByte(), 'B'.code.toByte(), 'P'.code.toByte()))) {
      return "image/webp"
    }
    if (bytes.size >= 6 && ((bytes[0] == 'G'.code.toByte() && bytes[1] == 'I'.code.toByte() && bytes[2] == 'F'.code.toByte() && bytes[3] == '8'.code.toByte() && (bytes[4] == '7'.code.toByte() || bytes[4] == '9'.code.toByte()) && bytes[5] == 'a'.code.toByte()))) {
      return "image/gif"
    }
    if (bytes.size >= 2 && bytes[0] == 'B'.code.toByte() && bytes[1] == 'M'.code.toByte()) {
      return "image/bmp"
    }
    if (bytes.size >= 4 && ((bytes[0] == 'I'.code.toByte() && bytes[1] == 'I'.code.toByte() && bytes[2] == '*'.code.toByte() && bytes[3] == 0.toByte()) || (bytes[0] == 'M'.code.toByte() && bytes[1] == 'M'.code.toByte() && bytes[2] == 0.toByte() && bytes[3] == '*'.code.toByte()) || (bytes[0] == 'I'.code.toByte() && bytes[1] == 'I'.code.toByte() && bytes[2] == '+'.code.toByte() && bytes[3] == 0.toByte()) || (bytes[0] == 'M'.code.toByte() && bytes[1] == 'M'.code.toByte() && bytes[2] == 0.toByte() && bytes[3] == '+'.code.toByte()))) {
      return "image/tiff"
    }
    if (bytes.size >= 4 && bytes[0] == 0xFF.toByte() && bytes[1] == 0x4F.toByte() && bytes[2] == 0xFF.toByte() && bytes[3] == 0x51.toByte()) {
      return "image/jp2"
    }
    if (bytes.size >= 12 && bytes[4] == 'f'.code.toByte() && bytes[5] == 't'.code.toByte() && bytes[6] == 'y'.code.toByte() && bytes[7] == 'p'.code.toByte()) {
      val brand = String(bytes, 8, 4, Charsets.US_ASCII)
      if (brand in arrayOf("heic", "heix", "heis", "hevc", "hevx", "hevm", "hevs", "heim", "mif1", "msf1")) return "image/heic"
      if (brand == "avif" || brand == "avis") return "image/avif"
    }

    // Let Android identify a valid image when its signature is not one of the
    // common formats above, while keeping only formats the JS layer can store.
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    return when (options.outMimeType?.lowercase()) {
      "image/jpeg", "image/jpg" -> "image/jpeg"
      "image/png" -> "image/png"
      "image/webp" -> "image/webp"
      "image/gif" -> "image/gif"
      "image/bmp", "image/x-ms-bmp" -> "image/bmp"
      "image/heic", "image/heif" -> "image/heic"
      "image/avif" -> "image/avif"
      "image/tiff", "image/x-tiff" -> "image/tiff"
      "image/jp2", "image/jpx", "image/jpm" -> "image/jp2"
      else -> null
    }
  }

  private fun cleanupCoverFiles(outputPath: String) {
    File("$outputPath.cover").delete()
    for (extension in arrayOf(".jpg", ".png", ".bmp", ".webp", ".gif", ".heic", ".avif", ".tiff", ".jp2")) {
      File("$outputPath.cover$extension").delete()
      File("$outputPath.cover$extension.partial").delete()
    }
    File("$outputPath.cover.partial").delete()
  }
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
    coverMimeType = value("cover_mime_type"),
    coverPath = value("cover_path"),
  )
}

private fun readFailure(path: String): String? {
  val file = File(path)
  if (!file.isFile) return null
  return Regex("\\\"error\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").find(file.readText())?.groupValues?.get(1)
}

private class MusicUnlockerException(reason: String? = null) :
  Exception(reason ?: "音乐容器解锁失败，格式不受支持或文件已损坏")
