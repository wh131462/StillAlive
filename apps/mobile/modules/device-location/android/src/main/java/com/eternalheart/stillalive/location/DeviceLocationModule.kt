package com.eternalheart.stillalive.location

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceLocationModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private val pending = mutableMapOf<Int, () -> Unit>()

  override fun definition() = ModuleDefinition {
    Name("StillAliveDeviceLocation")

    AsyncFunction("getPositionAsync") { id: Int, maxAge: Double, maxAccuracy: Double, highAccuracy: Boolean, promise: Promise ->
      val manager = appContext.reactContext?.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      if (manager == null) {
        promise.reject("LOCATION_UNAVAILABLE", "系统定位服务不可用", null)
      } else {
        requestPosition(manager, id, maxAge, maxAccuracy, highAccuracy, promise)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelAsync") { id: Int -> pending[id]?.invoke() }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground { handler.post { pending.values.toList().forEach { it() } } }
    OnDestroy { handler.post { pending.values.toList().forEach { it() } } }
  }

  private fun requestPosition(manager: LocationManager, id: Int, maxAge: Double, maxAccuracy: Double, highAccuracy: Boolean, promise: Promise) {
    fun usable(location: Location): Boolean {
      val age = (SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos) / 1_000_000.0
      return age in 0.0..maxAge && location.hasAccuracy() && location.accuracy in 0.0..maxAccuracy &&
        location.latitude.isFinite() && location.latitude in -90.0..90.0 &&
        location.longitude.isFinite() && location.longitude in -180.0..180.0 &&
        !(location.latitude == 0.0 && location.longitude == 0.0)
    }

    try {
      val providers = manager.getProviders(true)
      val cached = providers.mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .filter { location ->
          val age = (SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos) / 1_000_000.0
          val maxCacheAge = if (highAccuracy) 60_000.0 else 86_400_000.0
          age in 0.0..maxCacheAge && location.hasAccuracy() && location.accuracy in 0.0..maxAccuracy &&
            location.latitude.isFinite() && location.latitude in -90.0..90.0 &&
            location.longitude.isFinite() && location.longitude in -180.0..180.0 &&
            !(location.latitude == 0.0 && location.longitude == 0.0)
        }.maxByOrNull { it.elapsedRealtimeNanos }
      if (cached != null) {
        promise.resolve(exportLocation(cached))
        return
      }

      var finished = false
      lateinit var listener: LocationListener
      lateinit var timeout: Runnable
      fun finish(location: Location?) {
        if (finished) return
        finished = true
        handler.removeCallbacks(timeout)
        pending.remove(id)
        runCatching { manager.removeUpdates(listener) }
        if (location != null) promise.resolve(exportLocation(location))
        else promise.reject("LOCATION_UNAVAILABLE", "暂未获取到位置，可手动填写", null)
      }
      timeout = Runnable { finish(null) }
      listener = object : LocationListener {
        override fun onLocationChanged(location: Location) { if (usable(location)) finish(location) }
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        @Deprecated("Deprecated in Android")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
      }
      pending[id] = { finish(null) }
      handler.postDelayed(timeout, 3_000)
      val sources = providers.filter { highAccuracy || it != LocationManager.GPS_PROVIDER }
      var registered = false
      sources.forEach { provider ->
        runCatching { manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper()) }
          .onSuccess { registered = true }
      }
      if (!registered) finish(null)
    } catch (cause: SecurityException) {
      promise.reject("LOCATION_PERMISSION", "定位权限未开启", cause)
    }
  }

  private fun exportLocation(location: Location): Map<String, Any?> = mapOf(
    "timestamp" to location.time.toDouble(),
    "provider" to location.provider,
    "coords" to mapOf(
      "latitude" to location.latitude,
      "longitude" to location.longitude,
      "accuracy" to location.accuracy.toDouble(),
      "altitude" to null,
      "altitudeAccuracy" to null,
      "heading" to null,
      "speed" to null,
    ),
  )
}
