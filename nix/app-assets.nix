# Generated app assets, so no binaries live in git:
# - Iosevka (SIL OFL 1.1) subset to the text and the symbols the app draws;
# - the Android launcher icons rendered from app/icon.svg: 48 dp legacy icons and the
#   108 dp adaptive foreground, whose motif sits in the central safe zone, and its one-colour
#   twin for themed icons from app/icon-monochrome.svg;
# - the 24 dp status-bar icon for stage alerts and the status notification
#   (FastStatus.java), from app/notification.svg.
# In development: nix build .#app-assets -o app/public/generated
{
  fetchurl,
  iosevka-bin,
  lib,
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
  # and Block Elements (bars). Then every other symbol the app draws; keep this list
  # equal to the symbols in the code. Icons are Material Icons, drawn as SVG.
  text = ["U+0000-017F" "U+2000-206F" "U+2500-259F"];
  icons = [
    "U+25A0" # ■ a stage's colour
    "U+25B2" # ▲ up on the span before (Stats)
    "U+25BC" # ▼ down on it
    "U+2192" # → in a path to an Android setting
    "U+25C6" # ◆ BMI
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
      vips thumbnail ${../app/icon-monochrome.svg} "${dir}/ic_launcher_monochrome.png[strip]" ${px 108}
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
    ${launcherIcons}
  ''
