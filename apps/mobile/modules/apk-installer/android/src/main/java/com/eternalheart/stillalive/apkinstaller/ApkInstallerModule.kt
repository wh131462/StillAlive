package com.eternalheart.stillalive.apkinstaller

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ApkInstallerModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StillAliveApkInstaller")

    Constant("nativeVersion") {
      val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
      packageInfo.versionName ?: ""
    }

    Constant("nativeBuildVersion") {
      val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode.toInt()
      } else {
        @Suppress("DEPRECATION")
        packageInfo.versionCode
      }
    }

    AsyncFunction("installApkAsync") { contentUri: String ->
      require(contentUri.startsWith("content://")) { "APK 地址必须是 content URI" }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
        val permissionIntent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(permissionIntent)
        return@AsyncFunction "permission-required"
      }

      val installIntent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(Uri.parse(contentUri), "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      check(installIntent.resolveActivity(context.packageManager) != null) { "系统中没有可用的 APK 安装器" }
      context.startActivity(installIntent)
      "started"
    }
  }
}
