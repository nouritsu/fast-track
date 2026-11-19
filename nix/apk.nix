# The Android APK: the web build in Capacitor's WebView shell, built by Gradle offline.
# The output is unsigned; `nix run .#apk` signs it with a release key or the machine's
# debug key, so no key ever enters the store.
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
  # A build that installs beside the release one, as "Fast Track (debug)" with its own id
  # and storage (app/android/app/build.gradle): `nix run .#apk-debug -- --install`.
  debugApp ? false,
}: let
  name = "fast-track${lib.optionalString debugApp "-debug"}";
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

  inherit (lib.importJSON ../app/package.json) version;
  # versionCode = MAJOR*10000 + MINOR*100 + PATCH, so 0.1.0 is 100. Android installs an
  # update only over a lower code, so bumping the version in package.json is all a
  # release needs; build.gradle's fallbacks cover Android Studio builds.
  versionParts = builtins.match "(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)" version;
  versionCode = let
    part = n: lib.toInt (builtins.elemAt versionParts n);
    minor = part 1;
    patch = part 2;
  in
    assert lib.assertMsg (versionParts != null) "app/package.json: version must be plain X.Y.Z, got \"${version}\"";
    assert lib.assertMsg (minor < 100 && patch < 100) "app/package.json: MINOR and PATCH must stay below 100 to fit the versionCode, got ${version}";
      part 0 * 10000 + minor * 100 + patch;
in
  stdenv.mkDerivation (finalAttrs: {
    pname = "${name}-apk";
    inherit version;
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
    gradleFlags =
      [
        "-Dorg.gradle.java.home=${jdk21}"
        # The aapt2 AGP fetches from Maven is linked for FHS systems and fails on NixOS.
        "-Pandroid.aapt2FromMavenOverride=${sdk}/build-tools/${buildToolsVersion}/aapt2"
        "-PversionCode=${toString versionCode}"
        "-PversionName=${finalAttrs.version}"
        # Release lint looks up newer library versions in Google's Maven indexes, which
        # change upstream every few days; pinning them broke the build within a week.
        "-x"
        "lintVitalRelease"
      ]
      # Only when wanted: Gradle reads any value, "false" too, as set.
      ++ lib.optional debugApp "-PdebugApp=true";
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
        $out/${name}-${finalAttrs.version}-unsigned.apk
      runHook postInstall
    '';

    # The signed APK's name in out/apk/ (nix/apk-app.nix).
    passthru = {
      inherit sdk buildToolsVersion versionCode;
      signedName = "${name}-${finalAttrs.version}.apk";
    };

    meta.license = lib.licenses.gpl3Plus;
    meta.sourceProvenance = with lib.sourceTypes; [
      fromSource
      binaryBytecode # Maven artefacts from the mitm cache
    ];
  })
