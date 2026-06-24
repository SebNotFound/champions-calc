// Top-level build file. Versions are declared here and applied per-module.
// AGP 8.7 + Kotlin 1.9 are known-good with the Gradle 8.14 wrapper this project
// ships, and only need JDK 17 (which is what we build with).
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
