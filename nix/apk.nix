# The Android APK: the web build in Capacitor's WebView shell, built by Gradle offline.
# The output is unsigned; `nix run .#apk` signs it with the machine's debug key, so no
# key ever enters the store.
# First build, and after changing Capacitor, AGP or Gradle:
#   nix build .#apk.mitmCache.updateScript && ./result
{
  lib,
  stdenv,
  androidenv,
  assets,
  gradle,
  importNpmLock,
  jdk21,
  nodejs,
  web,
  versionCode ? 1,
}: let
  buildToolsVersion = "35.0.0"; # AGP 8.13's default; any other makes it reach for the network
  android = androidenv.composeAndroidPackages {
    platformVersions = ["36"];
    buildToolsVersions = [buildToolsVersion];
    includeEmulator = false;
    includeSources = false;
    includeSystemImages = false;
    includeNDK = false;
  };
  sdk = "${android.androidsdk}/libexec/android-sdk";
in
  stdenv.mkDerivation (finalAttrs: {
    pname = "fast-track-apk";
    inherit (lib.importJSON ../app/package.json) version;
    src = ../app;

    npmDeps = importNpmLock {npmRoot = ../app;};
    nativeBuildInputs = [
      gradle
      importNpmLock.npmConfigHook
      nodejs
    ];

    mitmCache = gradle.fetchDeps {
      pkg = finalAttrs.finalPackage;
      data = ./apk-deps.json;
      # The Capacitor CLI reads the user's passwd entry, which the update sandbox lacks.
      bwrapFlags = ''--ro-bind "$PWD" "$PWD" --ro-bind /etc/passwd /etc/passwd'';
    };

    ANDROID_HOME = sdk;
    gradleFlags = [
      "-Dorg.gradle.java.home=${jdk21}"
      # The aapt2 AGP fetches from Maven is linked for FHS systems and fails on NixOS.
      "-Pandroid.aapt2FromMavenOverride=${sdk}/build-tools/${buildToolsVersion}/aapt2"
      "-PversionCode=${toString versionCode}"
      "-PversionName=${finalAttrs.version}"
      # Release lint looks up newer library versions in Google's Maven indexes, which
      # change upstream every few days; pinning them broke the build within a week.
      "-x"
      "lintVitalRelease"
    ];
    gradleBuildTask = "assembleRelease";
    # Android variants make the default nixDownloadDeps ambiguous; record a real build.
    gradleUpdateTask = finalAttrs.gradleBuildTask;

    # Runs before the Gradle update script too, so it sees the same project.
    preBuild = ''
      cp -r --no-preserve=mode ${web} dist
      cp -r --no-preserve=mode ${assets}/android/. android/app/src/main/res/
      npx cap sync android
      cd android
    '';

    installPhase = ''
      runHook preInstall
      install -Dm644 app/build/outputs/apk/release/app-release-unsigned.apk \
        $out/fast-track-${finalAttrs.version}-unsigned.apk
      runHook postInstall
    '';

    passthru = {inherit sdk;};

    meta.sourceProvenance = with lib.sourceTypes; [
      fromSource
      binaryBytecode # Maven artefacts from the mitm cache
    ];
  })
