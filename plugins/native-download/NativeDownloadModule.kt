package com.shahid310.reelvault

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class NativeDownloadModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativeDownload"

    private val downloadManager by lazy {
        reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    }

    // Track active downloads for progress polling
    private val activeDownloads = mutableMapOf<Long, String>() // downloadId -> callbackTag
    private var progressHandler: Handler? = null
    private var progressRunnable: Runnable? = null

    /**
     * Start a background download via Android DownloadManager.
     * Returns the download ID as a string so JS can track it.
     *
     * @param url       Direct download URL
     * @param fileName  Target filename (e.g. "youtube_1234567890.mp4")
     * @param title     Notification title
     * @param mimeType  MIME type (e.g. "video/mp4", "audio/mp4")
     * @param subDir    Subdirectory inside Downloads (e.g. "SaveX")
     * @param promise   JS Promise
     */
    @ReactMethod
    fun startDownload(url: String, fileName: String, title: String, mimeType: String?, subDir: String?, promise: Promise) {
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setTitle(title)
                setDescription("Downloading via SaveX...")
                setMimeType(mimeType ?: "video/mp4")

                // Show progress in notification bar (like Chrome)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)

                // Allow download over both WiFi and mobile data
                setAllowedNetworkTypes(
                    DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
                )

                // Save to public Downloads folder under a subdirectory
                val targetDir = subDir ?: "SaveX"
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "$targetDir/$fileName")
            }

            val downloadId = downloadManager.enqueue(request)
            activeDownloads[downloadId] = fileName

            // Register completion listener for this download
            registerCompletionReceiver(downloadId)

            // Start polling progress
            startProgressPolling()

            promise.resolve(downloadId.toString())
        } catch (e: Exception) {
            promise.reject("DOWNLOAD_ERROR", "Failed to start download: ${e.message}", e)
        }
    }

    /**
     * Legacy overload — keeps backward compatibility with existing calls
     * that only pass (url, fileName, title) without mimeType/subDir/promise.
     */
    @ReactMethod
    fun startDownload(url: String, fileName: String, title: String) {
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setTitle(title)
                setDescription("Downloading via SaveX...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setAllowedNetworkTypes(
                    DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
                )
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "SaveX/$fileName")
            }
            val downloadId = downloadManager.enqueue(request)
            activeDownloads[downloadId] = fileName
            registerCompletionReceiver(downloadId)
            startProgressPolling()
        } catch (e: Exception) {
            // Fire-and-forget mode — log error silently
            e.printStackTrace()
        }
    }

    /**
     * Query the current status/progress of a download by its ID.
     */
    @ReactMethod
    fun queryDownload(downloadIdStr: String, promise: Promise) {
        try {
            val downloadId = downloadIdStr.toLong()
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor: Cursor? = downloadManager.query(query)

            if (cursor != null && cursor.moveToFirst()) {
                val bytesDownloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                val bytesTotal = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)) ?: ""

                val statusStr = when (status) {
                    DownloadManager.STATUS_PENDING -> "pending"
                    DownloadManager.STATUS_RUNNING -> "running"
                    DownloadManager.STATUS_PAUSED -> "paused"
                    DownloadManager.STATUS_SUCCESSFUL -> "success"
                    DownloadManager.STATUS_FAILED -> "failed"
                    else -> "unknown"
                }

                val progress = if (bytesTotal > 0) bytesDownloaded.toDouble() / bytesTotal.toDouble() else 0.0

                val result = Arguments.createMap().apply {
                    putString("status", statusStr)
                    putDouble("progress", progress)
                    putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                    putDouble("bytesTotal", bytesTotal.toDouble())
                    putString("localUri", localUri)
                }
                cursor.close()
                promise.resolve(result)
            } else {
                cursor?.close()
                promise.reject("NOT_FOUND", "Download not found")
            }
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", e.message, e)
        }
    }

    /**
     * Cancel an active download.
     */
    @ReactMethod
    fun cancelDownload(downloadIdStr: String, promise: Promise) {
        try {
            val downloadId = downloadIdStr.toLong()
            val removed = downloadManager.remove(downloadId)
            activeDownloads.remove(downloadId)
            promise.resolve(removed > 0)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    /**
     * Emit download progress events to JS every ~800ms.
     */
    private fun startProgressPolling() {
        if (progressHandler != null) return // Already polling

        progressHandler = Handler(Looper.getMainLooper())
        progressRunnable = object : Runnable {
            override fun run() {
                if (activeDownloads.isEmpty()) {
                    stopProgressPolling()
                    return
                }

                val completedIds = mutableListOf<Long>()

                for ((downloadId, tag) in activeDownloads) {
                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor = downloadManager.query(query)

                    if (cursor != null && cursor.moveToFirst()) {
                        val bytesDownloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                        val bytesTotal = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))

                        val progress = if (bytesTotal > 0) bytesDownloaded.toDouble() / bytesTotal.toDouble() else 0.0

                        // Emit progress event
                        val params = Arguments.createMap().apply {
                            putString("downloadId", downloadId.toString())
                            putString("fileName", tag)
                            putDouble("progress", progress)
                            putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                            putDouble("bytesTotal", bytesTotal.toDouble())
                        }

                        try {
                            reactContext
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                .emit("downloadProgress", params)
                        } catch (_: Exception) { /* JS not ready yet */ }

                        if (status == DownloadManager.STATUS_SUCCESSFUL || status == DownloadManager.STATUS_FAILED) {
                            completedIds.add(downloadId)
                        }
                    }
                    cursor?.close()
                }

                completedIds.forEach { activeDownloads.remove(it) }

                progressHandler?.postDelayed(this, 800)
            }
        }
        progressHandler?.post(progressRunnable!!)
    }

    private fun stopProgressPolling() {
        progressRunnable?.let { progressHandler?.removeCallbacks(it) }
        progressHandler = null
        progressRunnable = null
    }

    /**
     * Listen for download completion broadcast.
     */
    private fun registerCompletionReceiver(downloadId: Long) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (id != downloadId) return

                val query = DownloadManager.Query().setFilterById(id)
                val cursor = downloadManager.query(query)

                if (cursor != null && cursor.moveToFirst()) {
                    val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)) ?: ""
                    val bytesTotal = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))

                    val params = Arguments.createMap().apply {
                        putString("downloadId", id.toString())
                        putString("fileName", activeDownloads[id] ?: "")
                        putString("localUri", localUri)
                        putDouble("bytesTotal", bytesTotal.toDouble())
                        putBoolean("success", status == DownloadManager.STATUS_SUCCESSFUL)
                        putString("status", if (status == DownloadManager.STATUS_SUCCESSFUL) "success" else "failed")
                    }

                    try {
                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("downloadComplete", params)
                    } catch (_: Exception) { /* JS not ready */ }

                    activeDownloads.remove(id)
                }
                cursor?.close()

                try {
                    reactContext.unregisterReceiver(this)
                } catch (_: Exception) { /* Already unregistered */ }
            }
        }

        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
    }

    /**
     * Required for NativeEventEmitter on the JS side.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
