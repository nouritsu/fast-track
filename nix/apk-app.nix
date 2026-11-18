# `nix run .#apk -- [--install]`: signs the APK with this machine's Android debug key,
# writes it to out/apk/, and optionally adb installs it.
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
  argparse install -- $argv; or exit 2
  set -gx PATH ${lib.makeBinPath [android-tools coreutils git jdk21]} ${apk.sdk}/build-tools/${apk.buildToolsVersion} $PATH

  set -l root (git rev-parse --show-toplevel 2>/dev/null)
  if not test -f "$root/flake.nix"
      echo "apk: run this inside the repository" >&2
      exit 1
  end

  # The SDK's debug key, the same on every build from this machine; keep the file,
  # or phones refuse the next update.
  set -l keystore ~/.android/debug.keystore
  if not test -f $keystore
      mkdir -p (path dirname $keystore)
      keytool -genkeypair -keystore $keystore -storepass android -alias androiddebugkey \
          -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
          -dname 'CN=Android Debug,O=Android,C=US'; or exit 1
  end

  set -l unsigned ${apk}/*.apk
  set -l signed $root/out/apk/(path basename $unsigned | string replace -- -unsigned.apk .apk)
  mkdir -p (path dirname $signed)
  apksigner sign --ks $keystore --ks-pass pass:android --ks-key-alias androiddebugkey \
      --key-pass pass:android --v4-signing-enabled false --out $signed $unsigned; or exit 1
  echo "$signed (versionCode ${toString apk.versionCode})"

  if set -q _flag_install
      adb install -r $signed; or exit 1
  end
''
