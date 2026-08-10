package com.wh131462.stillalive.persistentnotification

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PersistentNotificationModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StillAlivePersistentNotification")

    AsyncFunction("setEnabledAsync") { enabled: Boolean ->
      PersistentNotificationService.setEnabled(context, enabled)
    }

    AsyncFunction("refreshAsync") {
      PersistentNotificationService.refresh(context)
    }

    AsyncFunction("getStatusAsync") {
      mapOf(
        "enabled" to PersistentNotificationService.isEnabled(context),
        "running" to PersistentNotificationService.isRunning,
      )
    }
  }
}
