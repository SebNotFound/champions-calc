// Gradle settings for the EXO Calc Android overlay.
//
// A small native Android shell whose only job is to float the (already built)
// web calculator over any other app — the same calc as the website / desktop
// overlay, embedded offline and shown in a system overlay window.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "EXO Calc Overlay"
include(":app")
