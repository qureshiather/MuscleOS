package expo.modules.workoutlivenotification

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Android-side owner of the active-workout tray notification.
 *
 * Two things here cannot be done from JS via expo-notifications:
 *
 * 1. The rest countdown is rendered by the platform as a chronometer, so it keeps
 *    ticking every second while the JS runtime is frozen in the background.
 * 2. The rest-over alert is posted from our own alarm, on a channel whose sound plays
 *    on the alarm stream, so it is audible with the ringer silenced and fires on time
 *    once the user has granted "Alarms & reminders".
 */
internal object WorkoutNotifications {
  const val ONGOING_NOTIFICATION_ID = 8801
  const val ALERT_NOTIFICATION_ID = 8802

  /**
   * Channel settings (sound, importance, vibration) are immutable once a channel has
   * been created on a device. Any change to those needs a new id, and the previous
   * ids have to be deleted so users are not left with stale duplicates in settings.
   */
  private const val ONGOING_CHANNEL_ID = "workout_live_v1"
  private const val ALERT_CHANNEL_ID = "rest_alert_v1"
  private const val ALERT_SILENT_CHANNEL_ID = "rest_alert_silent_v1"
  private val RETIRED_CHANNEL_IDS = listOf("workout", "rest-complete")

  private const val ALERT_SOUND_RESOURCE = "rest_end_alert"
  // Three slashes: with two, expo-router reads "active-workout" as the host and the
  // route never matches, so tapping the notification dumps you on the home tab.
  private const val DEEP_LINK = "muscleos:///active-workout"

  private const val ACTION_REST_OVER = "expo.modules.workoutlivenotification.REST_OVER"
  private const val REQUEST_CODE_ALARM = 8811
  private const val REQUEST_CODE_CONTENT = 8812

  private const val EXTRA_IDLE_TITLE = "idleTitle"
  private const val EXTRA_IDLE_BODY = "idleBody"
  private const val EXTRA_ALERT_TITLE = "alertTitle"
  private const val EXTRA_ALERT_BODY = "alertBody"
  private const val EXTRA_ALERT_ENABLED = "alertEnabled"
  private const val EXTRA_ALERT_SOUND = "alertSound"

  fun show(
    context: Context,
    restTitle: String,
    restBody: String,
    idleTitle: String,
    idleBody: String,
    restEndTime: Long?,
    alertTitle: String,
    alertBody: String,
    alertEnabled: Boolean,
    alertSound: Boolean
  ) {
    ensureChannels(context)

    val resting = restEndTime != null && restEndTime > System.currentTimeMillis()
    if (resting) {
      postOngoing(context, restTitle, restBody, restEndTime)
    } else {
      postOngoing(context, idleTitle, idleBody, null)
    }

    val alarm = alarmPendingIntent(
      context, idleTitle, idleBody, alertTitle, alertBody, alertEnabled, alertSound
    )
    if (resting) {
      scheduleRestOverAlarm(context, restEndTime!!, alarm)
    } else {
      cancelAlarm(context, alarm)
    }
  }

  fun hide(context: Context) {
    cancelAlarm(context, alarmPendingIntent(context, "", "", "", "", false, false))
    NotificationManagerCompat.from(context).apply {
      cancel(ONGOING_NOTIFICATION_ID)
      cancel(ALERT_NOTIFICATION_ID)
    }
  }

  fun dismissAlert(context: Context) {
    NotificationManagerCompat.from(context).cancel(ALERT_NOTIFICATION_ID)
  }

  /** False means rest alerts get deferred by up to about a minute. */
  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val manager = context.getSystemService(AlarmManager::class.java) ?: return false
    return manager.canScheduleExactAlarms()
  }

  fun openExactAlarmSettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
      data = Uri.fromParts("package", context.packageName, null)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try {
      context.startActivity(intent)
    } catch (_: Exception) {
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.fromParts("package", context.packageName, null)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      )
    }
  }

  /** Runs from [RestAlarmReceiver], i.e. possibly with no JS runtime alive. */
  fun onRestOver(context: Context, intent: Intent) {
    if (intent.action != ACTION_REST_OVER) return
    ensureChannels(context)

    val idleTitle = intent.getStringExtra(EXTRA_IDLE_TITLE) ?: return
    val idleBody = intent.getStringExtra(EXTRA_IDLE_BODY).orEmpty()

    // Swap the ticking countdown for the "next set" state, otherwise the
    // chronometer would keep counting past zero into negative time.
    postOngoing(context, idleTitle, idleBody, null)

    if (!intent.getBooleanExtra(EXTRA_ALERT_ENABLED, true)) return

    val withSound = intent.getBooleanExtra(EXTRA_ALERT_SOUND, true)
    val builder = NotificationCompat.Builder(
      context,
      if (withSound) ALERT_CHANNEL_ID else ALERT_SILENT_CHANNEL_ID
    )
      .setSmallIcon(smallIconRes(context))
      .setColor(accentColor(context))
      .setContentTitle(intent.getStringExtra(EXTRA_ALERT_TITLE) ?: "Rest over")
      .setContentText(intent.getStringExtra(EXTRA_ALERT_BODY).orEmpty())
      .setContentIntent(contentPendingIntent(context))
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)

    // Pre-O devices ignore channels, so sound and vibration are set here too.
    if (withSound) {
      builder.setSound(alertSoundUri(context)).setVibrate(VIBRATION_PATTERN)
    } else {
      builder.setSilent(true)
    }

    notify(context, ALERT_NOTIFICATION_ID, builder.build())
  }

  private fun postOngoing(context: Context, title: String, body: String, restEndTime: Long?) {
    val builder = NotificationCompat.Builder(context, ONGOING_CHANNEL_ID)
      .setSmallIcon(smallIconRes(context))
      .setColor(accentColor(context))
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(contentPendingIntent(context))
      .setOngoing(true)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

    if (restEndTime != null) {
      // The platform renders and ticks this countdown, so it stays live with no JS running.
      builder
        .setWhen(restEndTime)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        builder.setChronometerCountDown(true)
      }
    } else {
      builder
        .setShowWhen(false)
        .setUsesChronometer(false)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
    }

    notify(context, ONGOING_NOTIFICATION_ID, builder.build())
  }

  private fun notify(context: Context, id: Int, notification: Notification) {
    try {
      NotificationManagerCompat.from(context).notify(id, notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS not granted.
    }
  }

  private fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return

    RETIRED_CHANNEL_IDS.forEach { manager.deleteNotificationChannel(it) }

    val ongoing = NotificationChannel(
      ONGOING_CHANNEL_ID,
      "Active workout",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Shows your workout and rest countdown while a session is running"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    val alert = NotificationChannel(
      ALERT_CHANNEL_ID,
      "Rest timer",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Alerts you when a rest period is over"
      setShowBadge(false)
      enableVibration(true)
      vibrationPattern = VIBRATION_PATTERN
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      // USAGE_ALARM routes to the alarm stream so the alert is still audible when the
      // ringer is silenced — a rest timer going off is what the user is waiting for.
      setSound(
        alertSoundUri(context),
        AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setUsage(AudioAttributes.USAGE_ALARM)
          .build()
      )
    }

    // Used when the user has turned workout sounds off but should still see the alert.
    val silentAlert = NotificationChannel(
      ALERT_SILENT_CHANNEL_ID,
      "Rest timer (silent)",
      NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
      description = "Rest period alerts without sound or vibration"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    manager.createNotificationChannel(ongoing)
    manager.createNotificationChannel(alert)
    manager.createNotificationChannel(silentAlert)
  }

  private fun scheduleRestOverAlarm(context: Context, triggerAtMs: Long, operation: PendingIntent) {
    val manager = context.getSystemService(AlarmManager::class.java) ?: return
    // Android 12+ gates every exact alarm API, setAlarmClock included, behind
    // SCHEDULE_EXACT_ALARM. Without it the best we can do is an inexact alarm, which
    // the system may defer by around a minute.
    if (!canScheduleExactAlarms(context)) {
      manager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, operation)
      return
    }
    try {
      manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, operation)
    } catch (_: SecurityException) {
      manager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, operation)
    }
  }

  private fun cancelAlarm(context: Context, operation: PendingIntent) {
    context.getSystemService(AlarmManager::class.java)?.cancel(operation)
  }

  private fun alarmPendingIntent(
    context: Context,
    idleTitle: String,
    idleBody: String,
    alertTitle: String,
    alertBody: String,
    alertEnabled: Boolean,
    alertSound: Boolean
  ): PendingIntent {
    val intent = Intent(context, RestAlarmReceiver::class.java).apply {
      action = ACTION_REST_OVER
      putExtra(EXTRA_IDLE_TITLE, idleTitle)
      putExtra(EXTRA_IDLE_BODY, idleBody)
      putExtra(EXTRA_ALERT_TITLE, alertTitle)
      putExtra(EXTRA_ALERT_BODY, alertBody)
      putExtra(EXTRA_ALERT_ENABLED, alertEnabled)
      putExtra(EXTRA_ALERT_SOUND, alertSound)
    }
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE_ALARM,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun contentPendingIntent(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(
      context,
      REQUEST_CODE_CONTENT,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun smallIconRes(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  private fun accentColor(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon_color", "color", context.packageName)
    return if (id != 0) ContextCompat.getColor(context, id) else Color.TRANSPARENT
  }

  private fun alertSoundUri(context: Context): Uri {
    val id = context.resources.getIdentifier(ALERT_SOUND_RESOURCE, "raw", context.packageName)
    return if (id != 0) {
      Uri.parse("android.resource://${context.packageName}/raw/$ALERT_SOUND_RESOURCE")
    } else {
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    }
  }

  private val VIBRATION_PATTERN = longArrayOf(0, 250, 150, 250, 150, 400)
}
