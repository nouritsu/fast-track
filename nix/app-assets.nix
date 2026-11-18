# Generated app assets, so no binaries live in git:
# - Iosevka (SIL OFL 1.1) subset to the text and the icons the app draws;
# - the icons Iosevka lacks or draws too small, from Noto Sans Symbols 2 (SIL OFL 1.1);
# - the Android launcher icons rendered from app/icon.svg: 48 dp legacy icons and the
#   108 dp adaptive foreground, whose motif sits in the central safe zone;
# - the 24 dp status-bar icon for stage alerts and the status notification
#   (FastStatus.java), from app/notification.svg.
# In development: nix build .#app-assets -o app/public/generated
{
  fetchurl,
  iosevka-bin,
  lib,
  noto-fonts,
  python3,
  runCommand,
  vips,
}: let
  license = fetchurl {
    url = "https://raw.githubusercontent.com/be5invis/Iosevka/v${iosevka-bin.version}/LICENSE.md";
    # For v34.9.0; when nixpkgs moves iosevka-bin on, the build fails and prints the new hash.
    hash = "sha256-S6U8fByzknmq5fjX0iBUxIXHEWmSDlo27QmLEV4uPF0=";
  };
  # Text: Basic Latin to Latin Extended-A, General Punctuation (– … ‘ ’), Box Drawing
  # and Block Elements (bars). Then every icon the app draws from Iosevka; keep this
  # list equal to the icons in the code.
  text = ["U+0000-017F" "U+2000-206F" "U+2500-259F"];
  icons = [
    "U+25F7" # ◷ Start time
    "U+29D7" # ⧗ Goal
    "U+2715" # ✕ cancel, close
    "U+2302" # ⌂ today (the calendar's month and year panes)
    "U+25B7" # ▷ start
    "U+2713" # ✓ save
    "U+271A" # ✚ add
    "U+21BA" # ↺ undo
    "U+26AF" # ⚯ link
    "U+2913" # ⤓ export
    "U+2912" # ⤒ import
    "U+25A0" # ■ a stage's colour
    "U+2192" # → from start to end
  ];
  # From Noto Sans Symbols 2; keep equal to unicode-range in app/src/app.css.
  noto = [
    "U+23FE" # ⏾ Mocha (the theme button)
    "U+263C" # ☼ Latte
  ];
  # Android density buckets and their scale over mdpi.
  densities = {
    mdpi = 1;
    hdpi = 1.5;
    xhdpi = 2;
    xxhdpi = 3;
    xxxhdpi = 4;
  };
  launcherIcons = lib.concatStrings (lib.mapAttrsToList (density: scale: let
      dir = "$out/android/mipmap-${density}";
      px = dp: toString (builtins.ceil (dp * scale));
    in ''
      mkdir -p ${dir}
      vips thumbnail ${../app/icon.svg} "${dir}/ic_launcher.png[strip]" ${px 48}
      cp ${dir}/ic_launcher.png ${dir}/ic_launcher_round.png
      vips thumbnail ${../app/icon.svg} "${dir}/ic_launcher_foreground.png[strip]" ${px 108}
      mkdir -p $out/android/drawable-${density}
      vips thumbnail ${../app/notification.svg} "$out/android/drawable-${density}/ic_stat_fast.png[strip]" ${px 24}
    '')
    densities);
  subset = weight: ''
    pyftsubset ${iosevka-bin}/share/fonts/truetype/Iosevka-${weight}.ttc \
      --font-number=0 --unicodes=${lib.concatStringsSep "," (text ++ icons)} --flavor=woff2 \
      --name-IDs='*' --name-languages='*' \
      --output-file=$out/fonts/iosevka-${lib.toLower weight}.woff2
  '';
in
  runCommand "app-assets" {
    nativeBuildInputs = [
      (python3.withPackages (ps: [
        ps.fonttools
        ps.brotli
      ]))
      vips
    ];
  } ''
    mkdir -p $out/fonts
    ${subset "Regular"}
    ${subset "Bold"}
    cp ${license} $out/fonts/LICENSE.md
    pyftsubset ${noto-fonts}/share/fonts/noto/NotoSansSymbols2-Regular.otf \
      --unicodes=${lib.concatStringsSep "," noto} --flavor=woff2 --output-file=$out/fonts/symbols.woff2
    cp ${noto-fonts.src}/fonts/LICENSE $out/fonts/LICENSE-noto.txt
    ${launcherIcons}
  ''
