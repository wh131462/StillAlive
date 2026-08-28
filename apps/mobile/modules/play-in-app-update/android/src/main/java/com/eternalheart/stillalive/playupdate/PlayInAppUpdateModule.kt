package com.eternalheart.stillalive.playupdate

import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.gms.tasks.Tasks
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayInAppUpdateModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StillAlivePlayInAppUpdate")

    AsyncFunction("checkAsync") {
      val manager = AppUpdateManagerFactory.create(context)
      val info = Tasks.await(manager.appUpdateInfo)
      mapOf(
        "available" to (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE),
        "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()),
        "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()),
      )
    }

    AsyncFunction("startAsync") { immediate: Boolean ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val manager = AppUpdateManagerFactory.create(context)
      val info = Tasks.await(manager.appUpdateInfo)
      val type = if (immediate) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
      if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE || !info.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(type).build())) return@AsyncFunction false
      manager.startUpdateFlowForResult(info, activity, AppUpdateOptions.newBuilder(type).build(), 4101)
      true
    }
  }
}
