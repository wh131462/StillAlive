package com.eternalheart.stillalive.persistentnotification

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

class PersistentNotificationService : Service() {
  override fun onCreate() {
    super.onCreate()
    isRunning = true
    createChannel(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!isEnabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIFICATION_ID, buildNotification(this))
    scheduleNextDayRefresh(this)
    if (intent?.action == ACTION_CHECK_IN) {
      io.execute {
        val checkedInDayKey = quickCheckIn(this)
        updateNotification(this)
        if (checkedInDayKey != null) PersistentNotificationModule.reportCheckIn(checkedInDayKey)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL_ID = "persistent-check-in"
    private const val NOTIFICATION_ID = 41001
    private const val DATABASE_NAME = "still-alive.db"
    private const val DATABASE_BUSY_TIMEOUT_MS = 5000
    private const val PREFERENCES_NAME = "still_alive_persistent_notification"
    private const val ENABLED_KEY = "enabled"
    private const val ACTION_REFRESH = "com.eternalheart.stillalive.persistentnotification.REFRESH"
    private const val ACTION_CHECK_IN = "com.eternalheart.stillalive.persistentnotification.CHECK_IN"
    private const val REQUEST_CHECK_IN = 41002
    private const val REQUEST_DAY_REFRESH = 41003

    private val io = Executors.newSingleThreadExecutor()

    @Volatile
    var isRunning = false
      private set

    fun isEnabled(context: Context): Boolean =
      context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE).getBoolean(ENABLED_KEY, false)

    fun setEnabled(context: Context, enabled: Boolean) {
      context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(ENABLED_KEY, enabled)
        .apply()
      if (enabled) {
        refresh(context)
      } else {
        cancelNextDayRefresh(context)
        context.stopService(Intent(context, PersistentNotificationService::class.java))
        context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
        isRunning = false
      }
    }

    fun refresh(context: Context) {
      val intent = Intent(context, PersistentNotificationService::class.java).setAction(ACTION_REFRESH)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
      isRunning = true
    }

    // 日期变化广播与 0 点闹钟共用入口：服务存活时直接替换通知，否则尝试重新启动前台服务。
    fun onDayChanged(context: Context) {
      if (!isEnabled(context)) {
        cancelNextDayRefresh(context)
        return
      }
      scheduleNextDayRefresh(context)
      if (isRunning) {
        io.execute { updateNotification(context) }
      } else {
        runCatching { refresh(context) }
      }
    }

    fun updateNotification(context: Context) {
      context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(context))
    }

    fun scheduleNextDayRefresh(context: Context) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      val pendingIntent = dayRefreshPendingIntent(context, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextDayStartMillis(), pendingIntent)
    }

    private fun cancelNextDayRefresh(context: Context) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      val pendingIntent = dayRefreshPendingIntent(context, PendingIntent.FLAG_NO_CREATE) ?: return
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
    }

    private fun dayRefreshPendingIntent(context: Context, flags: Int): PendingIntent? {
      val intent = Intent(context, PersistentNotificationReceiver::class.java).setAction(ACTION_REFRESH)
      return PendingIntent.getBroadcast(context, REQUEST_DAY_REFRESH, intent, flags or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun nextDayStartMillis(): Long {
      val nextDay = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 5)
        set(Calendar.MILLISECOND, 0)
      }
      return nextDay.timeInMillis
    }

    private fun quickCheckIn(context: Context): String? {
      val database = openDatabase(context, writable = true) ?: return null
      val now = Date()
      val today = dayKey(now)
      runCatching {
        database.use { db ->
          val values = ContentValues().apply {
            put("id", "checkin_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(8)}")
            put("day_key", today)
            putNull("city")
            put("created_at", isoTimestamp(now))
          }
          db.insertWithOnConflict("checkins", null, values, SQLiteDatabase.CONFLICT_IGNORE)
        }
      }.getOrElse { return null }
      return today
    }

    private fun buildNotification(context: Context): Notification {
      val state = readNotificationState(context)
      val contentIntent = openAppIntent(context, "/")
      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(notificationIcon(context))
        .setColor(Color.rgb(29, 107, 73))
        .setContentIntent(contentIntent)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setShowWhen(false)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)

      builder.setContentTitle("仍在 ${displayDate(Date())}")

      if (state.checkedInAt == null) {
        builder
          .setContentText("未打卡  今日 ${state.todayPosts} 条  累计 ${state.recordedDays} 天")
          .addAction(0, "今天也在", serviceAction(context, ACTION_CHECK_IN, REQUEST_CHECK_IN))
          .addAction(0, "打开空间", contentIntent)
      } else {
        val actionLabel = if (state.todayPosts > 0) "再写一条" else "写一条"
        builder
          .setContentText("${displayTime(state.checkedInAt)} 已打卡  今日 ${state.todayPosts} 条  累计 ${state.recordedDays} 天")
          .addAction(0, actionLabel, openAppIntent(context, "/editor"))
          .addAction(0, "打开空间", contentIntent)
      }

      return builder.build()
    }

    private fun readNotificationState(context: Context): NotificationState {
      val database = openDatabase(context) ?: return NotificationState(null, 0, 0)
      return database.use { db ->
        val today = dayKey(Date())
        val checkedInAt = db.rawQuery(
          "SELECT created_at FROM checkins WHERE day_key = ? LIMIT 1",
          arrayOf(today),
        ).use { cursor -> if (cursor.moveToFirst()) parseTimestamp(cursor.getString(0)) else null }
        val todayPosts = db.rawQuery(
          "SELECT COUNT(*) FROM posts WHERE day_key = ?",
          arrayOf(today),
        ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) else 0 }
        val recordedDays = db.rawQuery(
          "SELECT COUNT(*) FROM (SELECT day_key FROM checkins UNION SELECT day_key FROM posts)",
          null,
        ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) else 0 }
        NotificationState(checkedInAt, todayPosts, recordedDays)
      }
    }

    private fun openDatabase(context: Context, writable: Boolean = false): SQLiteDatabase? {
      val path = File(context.filesDir, "SQLite/$DATABASE_NAME")
      if (!path.exists()) return null
      return runCatching {
        val flags = if (writable) {
          SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING
        } else {
          SQLiteDatabase.OPEN_READONLY
        }
        SQLiteDatabase.openDatabase(path.absolutePath, null, flags).apply {
          rawQuery("PRAGMA busy_timeout = $DATABASE_BUSY_TIMEOUT_MS", null).use { it.moveToFirst() }
        }
      }.getOrNull()
    }

    private fun createChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val channel = NotificationChannel(CHANNEL_ID, "常驻快捷栏", NotificationManager.IMPORTANCE_LOW).apply {
        description = "显示每日打卡状态和快捷入口"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun notificationIcon(context: Context): Int {
      val identifier = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      return if (identifier != 0) identifier else context.applicationInfo.icon
    }

    private fun serviceAction(context: Context, action: String, requestCode: Int): PendingIntent {
      val intent = Intent(context, PersistentNotificationService::class.java).setAction(action)
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        PendingIntent.getForegroundService(context, requestCode, intent, pendingIntentFlags())
      } else {
        PendingIntent.getService(context, requestCode, intent, pendingIntentFlags())
      }
    }

    private fun openAppIntent(context: Context, path: String): PendingIntent {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("stillalive://$path")
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      } ?: Intent(Intent.ACTION_VIEW, Uri.parse("stillalive://$path"))
      return PendingIntent.getActivity(context, path.hashCode(), intent, pendingIntentFlags())
    }

    private fun pendingIntentFlags(): Int = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    private fun dayKey(date: Date): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

    private fun isoTimestamp(date: Date): String =
      SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(date)

    private fun parseTimestamp(value: String): Date? {
      val formats = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      )
      for (pattern in formats) {
        runCatching { SimpleDateFormat(pattern, Locale.US).parse(value) }.getOrNull()?.let { return it }
      }
      return null
    }

    private fun displayDate(date: Date): String = SimpleDateFormat("M月d日", Locale.CHINA).format(date)

    private fun displayTime(date: Date): String {
      val calendar = Calendar.getInstance().apply { time = date }
      return String.format(Locale.CHINA, "%02d:%02d", calendar.get(Calendar.HOUR_OF_DAY), calendar.get(Calendar.MINUTE))
    }
  }
}

private data class NotificationState(
  val checkedInAt: Date?,
  val todayPosts: Int,
  val recordedDays: Int,
)
