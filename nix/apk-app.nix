# `nix run .#apk -- [--version-code N] [--install]`: builds the APK with the commit
# count as its versionCode, signs it with this machine's Android debug key, writes it
# to out/apk/, and optionally adb installs it.
{
  lib,
  stdenv,
  writers,
  android-tools,
  coreutils,
  git,
  jdk21,
  apk,
  flake,
}:
writers.writeFishBin "fast-track-apk" ''
  argparse 'version-code=' install -- $argv; or exit 2
  set -gx PATH ${lib.makeBinPath [android-tools coreutils git jdk21]} ${apk.sdk}/build-tools/35.0.0 $PATH

  set -l root (git rev-parse --show-toplevel 2>/dev/null)
  if not test -f "$root/flake.nix"
      echo "apk: run this inside the repository" >&2
      exit 1
  end

  # Android installs an update only over a lower versionCode: the commit count rises
  # with every commit, and --version-code covers a rebuild without one.
  set -l code $_flag_version_code
  if test -z "$code"
      set code (git -C $root rev-list --count HEAD); or exit 1
  end

  set -l built (nix build --no-link --print-out-paths --impure --expr "
    (builtins.getFlake \"path:${flake}\").packages.${stdenv.hostPlatform.system}.apk.override {
      versionCode = $code;
    }"); or exit 1

  # The SDK's debug key, the same on every build from this machine; keep the file,
  # or phones refuse the next update.
  set -l keystore ~/.android/debug.keystore
  if not test -f $keystore
      mkdir -p (path dirname $keystore)
      keytool -genkeypair -keystore $keystore -storepass android -alias androiddebugkey \
          -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
          -dname 'CN=Android Debug,O=Android,C=US'; or exit 1
  end

  set -l unsigned $built/*.apk
  set -l signed $root/out/apk/(path basename $unsigned | string replace -- -unsigned.apk .apk)
  mkdir -p (path dirname $signed)
  apksigner sign --ks $keystore --ks-pass pass:android --ks-key-alias androiddebugkey \
      --key-pass pass:android --v4-signing-enabled false --out $signed $unsigned; or exit 1
  echo "$signed (versionCode $code)"

  if set -q _flag_install
      adb install -r $signed; or exit 1
  end
''
