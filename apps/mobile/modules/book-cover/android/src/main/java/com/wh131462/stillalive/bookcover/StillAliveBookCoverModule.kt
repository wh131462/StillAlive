package com.wh131462.stillalive.bookcover

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import kotlin.math.max

class StillAliveBookCoverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StillAliveBookCover")

    AsyncFunction("renderFirstPageAsync") { inputURI: String, outputURI: String, targetWidth: Int ->
      val input = File(filesystemPath(inputURI))
      val output = File(filesystemPath(outputURI))
      require(input.isFile) { "PDF 文件不存在" }
      require(targetWidth in 240..1440) { "封面宽度无效" }

      try {
        output.parentFile?.mkdirs()
        ParcelFileDescriptor.open(input, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          PdfRenderer(descriptor).use { renderer ->
            require(renderer.pageCount > 0) { "PDF 没有可渲染页面" }
            renderer.openPage(0).use { page ->
              val height = max(1, (targetWidth.toDouble() * page.height / page.width).toInt())
              val bitmap = Bitmap.createBitmap(targetWidth, height, Bitmap.Config.ARGB_8888)
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              FileOutputStream(output).use { stream ->
                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) { "PDF 封面写入失败" }
              }
              bitmap.recycle()
              mapOf("width" to targetWidth, "height" to height)
            }
          }
        }
      } catch (cause: Throwable) {
        output.delete()
        throw cause
      }
    }
  }

  private fun filesystemPath(value: String): String = if (value.startsWith("file:")) URI(value).path else value
}
