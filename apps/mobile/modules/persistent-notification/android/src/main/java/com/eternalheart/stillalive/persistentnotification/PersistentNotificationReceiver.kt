package com.eternalheart.stillalive.persistentnotification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PersistentNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (PersistentNotificationService.isEnabled(context)) {
      runCatching { PersistentNotificationService.refresh(context) }
    }
  }
}
