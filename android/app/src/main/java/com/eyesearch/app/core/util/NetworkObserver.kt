package com.eyesearch.app.core.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.core.content.getSystemService
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Connectivity state as a Flow, so screens can say "you're offline" instead of
 * showing a generic failure.
 *
 * Uses the default network's validated capability rather than the deprecated
 * `activeNetworkInfo`; the callback API is the only way to react to changes
 * without polling.
 */
class NetworkObserver(context: Context) {

    private val manager: ConnectivityManager? =
        context.applicationContext.getSystemService()

    /** True when there is a validated internet-capable network. */
    fun isOnline(): Boolean {
        val connectivity = manager ?: return true
        val network = connectivity.activeNetwork ?: return false
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** Emits the current state immediately, then every change. */
    fun observe(): Flow<Boolean> = callbackFlow {
        val connectivity = manager
        if (connectivity == null) {
            trySend(true)
            awaitClose { }
            return@callbackFlow
        }

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }

            override fun onLost(network: Network) {
                trySend(isOnline())
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                trySend(capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
            }
        }

        trySend(isOnline())
        connectivity.registerDefaultNetworkCallback(callback)
        awaitClose { connectivity.unregisterNetworkCallback(callback) }
    }.distinctUntilChanged()
}
