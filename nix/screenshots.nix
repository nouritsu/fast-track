# Store screenshots: the web build at a Pixel 9 Pro XL's 1344×2992, with a made-up history
# at a fixed time (screenshots.py). Headless Chromium draws them in the build sandbox, from
# the build served on 127.0.0.1. `nix run .#screenshots` runs `update`, which copies them
# to fastlane, where F-Droid reads them.
{
  lib,
  coreutils,
  git,
  makeFontsConf,
  playwright-driver,
  python3,
  runCommand,
  writers,
  web,
}: let
  python = python3.withPackages (ps: [
    ps.playwright
    ps.pillow
  ]);
  # Headless, Playwright runs Chromium's headless shell; the other browsers stay out.
  browsers = playwright-driver.browsers.override {
    withChromium = false;
    withFirefox = false;
    withWebkit = false;
    withFfmpeg = false;
  };
  shots =
    runCommand "fast-track-screenshots" {
      nativeBuildInputs = [python];
      PLAYWRIGHT_BROWSERS_PATH = browsers;
      # Its check looks for an FHS system's libraries; Nix linked the browser to its own.
      PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";
      # No system fonts: the app brings its own, and no machine's fonts change the shots.
      FONTCONFIG_FILE = makeFontsConf {fontDirectories = [];};

      # Makes fastlane's phone screenshots match these, removing any others.
      passthru.update = writers.writeFishBin "fast-track-screenshots" ''
        set -gx PATH ${lib.makeBinPath [coreutils git]} $PATH

        set -l root (git rev-parse --show-toplevel 2>/dev/null)
        if not test -f "$root/flake.nix"
            echo "screenshots: run this inside the repository" >&2
            exit 1
        end

        set -l dir $root/fastlane/metadata/android/en-US/images/phoneScreenshots
        rm -rf $dir; and mkdir -p $dir; or exit 1
        cp --no-preserve=mode ${shots}/*.png $dir/; or exit 1
        ls $dir
      '';
    } ''
      HOME=$TMPDIR python ${./screenshots.py} ${web} $out
    '';
in
  shots
