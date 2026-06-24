package com.exocalc.overlay

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The only real screen: a small launcher that grants the "draw over other apps"
 * permission and starts/stops the floating overlay. Once the overlay is running
 * the user never needs to come back here — they live in the game with the EXO
 * bubble floating on top.
 *
 * The UI is built in code (no XML layout) because it's just a few controls.
 */
class MainActivity : Activity() {

    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The foreground service shows an ongoing notification; on Android 13+ that
        // needs a runtime grant (the service still runs without it, just silently).
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        setContentView(buildUi())
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun buildUi(): LinearLayout {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#080b12"))
            setPadding(dp(24), dp(48), dp(24), dp(24))
        }

        root.addView(TextView(this).apply {
            text = "EXO Calc · Overlay"
            setTextColor(Color.parseColor("#25d2ff"))
            textSize = 22f
        })

        status = TextView(this).apply {
            setTextColor(Color.parseColor("#8493ab"))
            textSize = 14f
            setPadding(0, dp(12), 0, dp(20))
        }
        root.addView(status)

        root.addView(Button(this).apply {
            text = "Activer l'overlay"
            setOnClickListener { onActivate() }
        }, rowParams())

        root.addView(Button(this).apply {
            text = "Arrêter l'overlay"
            setOnClickListener {
                stopService(Intent(this@MainActivity, OverlayService::class.java))
                refreshStatus()
            }
        }, rowParams())

        root.addView(TextView(this).apply {
            text = "1) Autorise « Affichage par-dessus les autres applis ».\n" +
                "2) Lance le jeu : la bulle EXO flotte par-dessus.\n" +
                "3) Touche la bulle pour ouvrir / fermer le calc."
            setTextColor(Color.parseColor("#5b6982"))
            textSize = 13f
            setPadding(0, dp(24), 0, 0)
        })

        return root
    }

    private fun rowParams() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(10) }

    private fun canOverlay() = Settings.canDrawOverlays(this)

    private fun refreshStatus() {
        status.text = if (canOverlay())
            "Autorisation overlay : accordée ✓"
        else
            "Autorisation overlay : requise ✗ (appuie sur Activer)"
    }

    private fun onActivate() {
        // First run: bounce the user to the system page that grants overlay access.
        if (!canOverlay()) {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName"),
                )
            )
            return
        }
        startForegroundService(Intent(this, OverlayService::class.java))
        // Drop back to whatever was on screen (the game) so the bubble is usable.
        moveTaskToBack(true)
    }
}
