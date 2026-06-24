package com.exocalc.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageView
import androidx.webkit.WebViewAssetLoader
import kotlin.math.abs

/**
 * The heart of the Android overlay.
 *
 * A foreground service that owns two system-overlay windows:
 *   - a small draggable EXO **bubble** that's always on top of every app, and
 *   - a **full-screen panel** (a WebView) that the bubble toggles, which loads the
 *     exact same web calculator as the website — bundled in the APK's assets so it
 *     runs fully offline.
 *
 * The bubble and the panel are mutually exclusive: tapping the bubble opens the
 * calc (and hides the bubble); the calc's own header has a "hide" button that
 * calls back through the `AndroidOverlay` JS bridge to close the panel and bring
 * the bubble back. That keeps the phone UI from wasting space on native chrome.
 *
 * Transparency + compact phone layout: on load we tell the web app it's running
 * in the Android overlay (it adds the `tauri-overlay` + `android-overlay` CSS
 * classes), which drops the page background and shrinks the UI.
 */
class OverlayService : Service() {

    private lateinit var wm: WindowManager
    private val main = Handler(Looper.getMainLooper())
    private var bubble: View? = null
    private var panel: WebView? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startAsForeground()
        addBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    // ---- foreground notification -------------------------------------------

    private fun startAsForeground() {
        val channelId = "exo_overlay"
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(channelId) == null) {
            nm.createNotificationChannel(
                NotificationChannel(channelId, "EXO Calc overlay", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val notif: Notification = Notification.Builder(this, channelId)
            .setContentTitle("EXO Calc")
            .setContentText("Overlay actif — touche la bulle pour ouvrir le calc")
            .setSmallIcon(R.drawable.ic_exo)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
        // Android 14+ wants the FGS type passed at start time; older versions take
        // the plain two-argument form.
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    // ---- the floating bubble -----------------------------------------------

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun addBubble() {
        val size = dp(54)
        val img = ImageView(this).apply {
            setImageResource(R.drawable.ic_exo)
            contentDescription = "EXO Calc"
        }
        val lp = WindowManager.LayoutParams(
            size, size,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // Never takes focus; lets touches outside it reach the game; can sit
            // anywhere on screen (including under the system bars).
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(10)
            y = dp(120)
        }
        img.setOnTouchListener(dragger(img, lp) { togglePanel() })
        bubble = img
        wm.addView(img, lp)
    }

    // ---- the calc panel (full screen) --------------------------------------

    private fun togglePanel() {
        if (panel != null) removePanel() else addPanel()
    }

    private fun addPanel() {
        val web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
        }

        // Serve the bundled web build from assets over a virtual https:// origin so
        // absolute "/assets/..." paths and localStorage all work as on the website.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?, request: WebResourceRequest?,
            ): WebResourceResponse? = request?.let { assetLoader.shouldInterceptRequest(it.url) }

            override fun onPageFinished(view: WebView?, url: String?) {
                // Pad the calc below the status bar (the panel is full-screen and
                // sits behind it). The web reads --ov-top for its top padding.
                view?.evaluateJavascript(
                    "document.documentElement.style.setProperty('--ov-top','${statusBarCssPx()}px');",
                    null,
                )
            }
        }
        // A WebChromeClient is required for native UI popups to work — without it
        // <select> dropdowns (Nature / Ability / the active-mon picker) won't open.
        web.webChromeClient = WebChromeClient()
        // The calc calls back here to hide itself (its header "masquer" button).
        web.addJavascriptInterface(JsBridge(), "AndroidOverlay")
        web.loadUrl("https://appassets.androidplatform.net/index.html")

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // Focusable (so typing into the calc + the soft keyboard work). The
            // panel covers the screen; the game is read through the transparent gaps.
            0,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        panel = web
        bubble?.visibility = View.GONE
        wm.addView(web, lp)
    }

    private fun removePanel() {
        panel?.let { runCatching { wm.removeView(it) } }
        panel?.destroy()
        panel = null
        bubble?.visibility = View.VISIBLE
    }

    /** Status-bar height in CSS pixels (device px / density), for the page's top inset. */
    private fun statusBarCssPx(): Int {
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        val px = if (id > 0) resources.getDimensionPixelSize(id) else dp(24)
        return (px / resources.displayMetrics.density).toInt()
    }

    /** JS-callable bridge the web calc uses (exposed as `window.AndroidOverlay`). */
    private inner class JsBridge {
        @JavascriptInterface
        fun hide() {
            // Called on a binder thread — window ops must hop to the main thread.
            main.post { removePanel() }
        }
    }

    /**
     * Drag the given overlay window by touch, and treat a touch that barely moved
     * as a tap (firing [onTap]). Used for the bubble.
     */
    private fun dragger(
        view: View,
        lp: WindowManager.LayoutParams,
        onTap: () -> Unit,
    ): View.OnTouchListener {
        var originX = 0
        var originY = 0
        var downX = 0f
        var downY = 0f
        var moved = false
        val slop = dp(8)
        return View.OnTouchListener { v, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    originX = lp.x; originY = lp.y
                    downX = e.rawX; downY = e.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - downX).toInt()
                    val dy = (e.rawY - downY).toInt()
                    if (abs(dx) > slop || abs(dy) > slop) moved = true
                    lp.x = originX + dx
                    lp.y = originY + dy
                    runCatching { wm.updateViewLayout(view, lp) }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) { v.performClick(); onTap() }
                    true
                }
                else -> false
            }
        }
    }

    override fun onDestroy() {
        removePanel()
        bubble?.let { runCatching { wm.removeView(it) } }
        bubble = null
        super.onDestroy()
    }

    private companion object {
        const val NOTIF_ID = 1
    }
}
