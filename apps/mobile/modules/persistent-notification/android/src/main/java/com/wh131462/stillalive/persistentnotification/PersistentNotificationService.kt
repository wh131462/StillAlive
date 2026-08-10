package com.wh131462.stillalive.persistentnotification

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

class PersistentNotificationService : Service() {
  override fun onCreate() {
    super.onCreate()
    isRunning = true
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!isEnabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIFICATION_ID, buildNotification())
    if (intent?.action == ACTION_CHECK_IN) {
      quickCheckIn()
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun quickCheckIn() {
    val database = openDatabase() ?: return
    database.use { db ->
      val now = Date()
      val values = ContentValues().apply {
        put("id", "checkin_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(8)}")
        put("day_key", dayKey(now))
        putNull("city")
        put("created_at", isoTimestamp(now))
      }
      db.insertWithOnConflict("checkins", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }
  }

  private fun buildNotification(): Notification {
    val state = readNotificationState()
    val contentIntent = openAppIntent("/")
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(notificationIcon())
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
        .addAction(0, "今天也在", serviceAction(ACTION_CHECK_IN, REQUEST_CHECK_IN))
        .addAction(0, "打开空间", contentIntent)
    } else {
      val actionLabel = if (state.todayPosts > 0) "再写一条" else "写一条"
      builder
        .setContentText("${displayTime(state.checkedInAt)} 已打卡  今日 ${state.todayPosts} 条  累计 ${state.recordedDays} 天")
        .addAction(0, actionLabel, openAppIntent("/editor"))
        .addAction(0, "打开空间", contentIntent)
    }

    return builder.build()
  }

  private fun readNotificationState(): NotificationState {
    val database = openDatabase() ?: return NotificationState(null, 0, 0)
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

  private fun openDatabase(): SQLiteDatabase? {
    val path = File(filesDir, "SQLite/$DATABASE_NAME")
    if (!path.exists()) return null
    return runCatching {
      SQLiteDatabase.openDatabase(path.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
    }.getOrNull()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "常驻快捷栏", NotificationManager.IMPORTANCE_LOW).apply {
      description = "显示每日打卡状态和快捷入口"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun notificationIcon(): Int {
    val identifier = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (identifier != 0) identifier else applicationInfo.icon
  }

  private fun serviceAction(action: String, requestCode: Int): PendingIntent {
    val intent = Intent(this, PersistentNotificationService::class.java).setAction(action)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      PendingIntent.getForegroundService(this, requestCode, intent, pendingIntentFlags())
    } else {
      PendingIntent.getService(this, requestCode, intent, pendingIntentFlags())
    }
  }

  private fun openAppIntent(path: String): PendingIntent {
    val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("stillalive://$path")
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    } ?: Intent(Intent.ACTION_VIEW, Uri.parse("stillalive://$path"))
    return PendingIntent.getActivity(this, path.hashCode(), intent, pendingIntentFlags())
  }

  private fun pendingIntentFlags(): Int = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  companion object {
    private const val CHANNEL_ID = "persistent-check-in"
    private const val NOTIFICATION_ID = 41001
    private const val DATABASE_NAME = "still-alive.db"
    private const val PREFERENCES_NAME = "still_alive_persistent_notification"
    private const val ENABLED_KEY = "enabled"
    private const val ACTION_REFRESH = "com.wh131462.stillalive.persistentnotification.REFRESH"
    private const val ACTION_CHECK_IN = "com.wh131462.stillalive.persistentnotification.CHECK_IN"
    private const val REQUEST_CHECK_IN = 41002

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
