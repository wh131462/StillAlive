package com.eternalheart.stillalive.systemfonts

import android.util.Xml
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import org.xmlpull.v1.XmlPullParser

class StillAliveSystemFontsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StillAliveSystemFonts")

    AsyncFunction("getFontFamiliesAsync") {
      systemFontFamilies()
    }
  }

  private fun systemFontFamilies(): List<String> {
    val families = sortedSetOf(String.CASE_INSENSITIVE_ORDER)
    families.addAll(listOf("sans-serif", "serif", "monospace"))
    listOf(
      "/system/etc/fonts.xml",
      "/product/etc/fonts.xml",
      "/product/etc/fonts_customization.xml",
      "/system_ext/etc/fonts.xml",
      "/vendor/etc/fonts.xml",
    ).forEach { path -> readFontConfig(File(path), families) }
    return families.toList()
  }

  private fun readFontConfig(file: File, families: MutableSet<String>) {
    if (!file.isFile) return
    runCatching {
      FileInputStream(file).use { input ->
        val parser = Xml.newPullParser()
        parser.setInput(input, null)
        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
          if (event == XmlPullParser.START_TAG && (parser.name == "family" || parser.name == "alias")) {
            parser.getAttributeValue(null, "name")?.trim()?.takeIf(String::isNotEmpty)?.let(families::add)
          }
          event = parser.next()
        }
      }
    }
  }
}
