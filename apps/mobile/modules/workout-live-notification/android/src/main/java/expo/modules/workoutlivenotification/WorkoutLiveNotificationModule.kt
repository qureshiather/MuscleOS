package expo.modules.workoutlivenotification

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class WorkoutNotificationOptions : Record {
  /** Shown while resting, next to the system-rendered countdown. */
  @Field val restTitle: String = "Resting"
  @Field val restBody: String = ""

  /** Shown when not resting, including after the rest alarm fires. */
  @Field val idleTitle: String = "Workout in progress"
  @Field val idleBody: String = ""

  /** Epoch milliseconds, or null when not resting. */
  @Field val restEndTime: Double? = null

  @Field val alertTitle: String = "Rest over"
  @Field val alertBody: String = ""

  /** False while the app is in the foreground, where in-app sound handles it. */
  @Field val alertEnabled: Boolean = true

  /** Mirrors the in-app workout sounds setting. */
  @Field val alertSound: Boolean = true
}

class WorkoutLiveNotificationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WorkoutLiveNotification")

    AsyncFunction("show") { options: WorkoutNotificationOptions ->
      WorkoutNotifications.show(
        context = requireContext(),
        restTitle = options.restTitle,
        restBody = options.restBody,
        idleTitle = options.idleTitle,
        idleBody = options.idleBody,
        restEndTime = options.restEndTime?.toLong(),
        alertTitle = options.alertTitle,
        alertBody = options.alertBody,
        alertEnabled = options.alertEnabled,
        alertSound = options.alertSound
      )
    }

    AsyncFunction("hide") {
      WorkoutNotifications.hide(requireContext())
    }

    AsyncFunction("dismissAlert") {
      WorkoutNotifications.dismissAlert(requireContext())
    }

    AsyncFunction("canScheduleExactAlarms") {
      WorkoutNotifications.canScheduleExactAlarms(requireContext())
    }

    AsyncFunction("openExactAlarmSettings") {
      WorkoutNotifications.openExactAlarmSettings(requireContext())
    }
  }

  private fun requireContext() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
}
