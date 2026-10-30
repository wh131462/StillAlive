package com.eternalheart.stillalive.persistentnotification

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PersistentNotificationModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StillAlivePersistentNotification")

    Events(EVENT_CHECK_IN)

    OnStartObserving(EVENT_CHECK_IN) {
      checkInReporter = { dayKey ->
        Handler(Looper.getMainLooper()).post {
          runCatching { sendEvent(EVENT_CHECK_IN, mapOf("dayKey" to dayKey)) }
        }
      }
    }

    OnStopObserving(EVENT_CHECK_IN) {
      checkInReporter = null
    }

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

  companion object {
    private const val EVENT_CHECK_IN = "onCheckIn"

    @Volatile
    private var checkInReporter: ((String) -> Unit)? = null

    fun reportCheckIn(dayKey: String) {
      checkInReporter?.invoke(dayKey)
    }
  }
}
