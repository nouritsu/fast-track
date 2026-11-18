# `nix run .#apk -- [--keystore PATH --alias NAME] [--install]`: signs the APK with a
# release key, or with this machine's Android debug key when no keystore is given,
# writes it to out/apk/, and optionally adb installs it. Release passwords come from
# FAST_TRACK_KEYSTORE_PASS and FAST_TRACK_KEY_PASS.
{
  lib,
  writers,
  android-tools,
  coreutils,
  git,
  jdk21,
  apk,
}:
writers.writeFishBin "fast-track-apk" ''
  argparse 'keystore=' 'alias=' install -- $argv; or exit 2
  set -gx PATH ${lib.makeBinPath [android-tools coreutils git jdk21]} ${apk.sdk}/build-tools/${apk.buildToolsVersion} $PATH

  set -l root (git rev-parse --show-toplevel 2>/dev/null)
  if not test -f "$root/flake.nix"
      echo "apk: run this inside the repository" >&2
      exit 1
  end

  # Passwords reach apksigner and keytool only as environment variables (their env:
  # syntax), so they never show up in a process list or in this script's output.
  set -l keystore
  set -l key_alias
  if set -q _flag_keystore
      if not set -q _flag_alias
          echo "apk: --keystore needs --alias" >&2
          exit 2
      end
      if not test -f $_flag_keystore
          echo "apk: no keystore at $_flag_keystore" >&2
          exit 1
      end
      for var in FAST_TRACK_KEYSTORE_PASS FAST_TRACK_KEY_PASS
          if test -z "$$var"
              echo "apk: set $var to sign with $_flag_keystore" >&2
              exit 1
          end
      end
      set keystore $_flag_keystore
      set key_alias $_flag_alias
  else
      if set -q _flag_alias
          echo "apk: --alias needs --keystore" >&2
          exit 2
      end
      # The SDK's debug key, the same on every build from this machine; keep the file,
      # or phones refuse the next update. Its passwords are the public "android".
      set keystore ~/.android/debug.keystore
      set key_alias androiddebugkey
      set -gx FAST_TRACK_KEYSTORE_PASS android
      set -gx FAST_TRACK_KEY_PASS android
      if not test -f $keystore
          mkdir -p (path dirname $keystore)
          keytool -genkeypair -keystore $keystore -storepass:env FAST_TRACK_KEYSTORE_PASS \
              -alias $key_alias -keypass:env FAST_TRACK_KEY_PASS -keyalg RSA -keysize 2048 \
              -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'; or exit 1
      end
  end

  set -l unsigned ${apk}/*.apk
  set -l signed $root/out/apk/fast-track-${apk.version}.apk
  mkdir -p (path dirname $signed)
  apksigner sign --ks $keystore --ks-key-alias $key_alias \
      --ks-pass env:FAST_TRACK_KEYSTORE_PASS --key-pass env:FAST_TRACK_KEY_PASS \
      --v4-signing-enabled false --out $signed $unsigned; or exit 1
  apksigner verify --print-certs $signed; or exit 1
  echo "$signed (versionCode ${toString apk.versionCode})"

  # A phone refuses an update signed with a different key: uninstall first when
  # switching between the debug key and a release key.
  if set -q _flag_install
      adb install -r $signed; or exit 1
  end
''
