package expo.modules.workoutlivenotification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fires when a rest period ends, whether or not the app process is still alive. */
class RestAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    WorkoutNotifications.onRestOver(context, intent)
  }
}
