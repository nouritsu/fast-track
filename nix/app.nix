{
  lib,
  assets,
  buildNpmPackage,
  importNpmLock,
}:
buildNpmPackage {
  pname = "fast-track-app";
  inherit (lib.importJSON ../app/package.json) version;
  src = ../app;

  # Fetches each package by its package-lock.json integrity hash: no npmDepsHash to bump.
  npmDeps = importNpmLock {npmRoot = ../app;};
  inherit (importNpmLock) npmConfigHook;

  # The generated fonts join the build; the launcher icons go to the APK's res/ (nix/apk.nix).
  preBuild = ''
    mkdir -p public
    cp -r --no-preserve=mode ${assets} public/generated
    rm -r public/generated/android
  '';

  installPhase = ''
    runHook preInstall
    cp -r dist $out
    runHook postInstall
  '';

  meta.license = lib.licenses.gpl3Plus;
}
