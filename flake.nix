{
  description = "Fast Track: an offline intermittent-fasting tracker for Android";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };

    # The dev shell is devenv in flake mode, so it keeps this nixpkgs and the packages below.
    devenv.url = "github:cachix/devenv";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    # house style: treefmt, git hooks, claude
    conf-nixos = {
      url = "github:nouritsu/conf-nixos";
      flake = false;
    };
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      # The web app and the dev shell work on each of these; the APK and the tools around
      # it only on x86_64-linux, the one system androidenv's SDK tools run on. nixpkgs
      # unstable has dropped Intel Macs: https://nixos.org/manual/nixpkgs/unstable/release-notes#x86_64-darwin-26.11
      systems = ["x86_64-linux" "aarch64-linux" "aarch64-darwin"];

      # `nix fmt` and the treefmt check run the house formatters and lints, the ones
      # the dev shell's git hook runs.
      imports = [inputs.treefmt-nix.flakeModule];

      perSystem = {
        config,
        lib,
        pkgs,
        system,
        ...
      }: let
        own = config.packages;
        android = system == "x86_64-linux";
        # The Android SDK is unfree, and androidenv asks for its licence to be accepted.
        androidPkgs = import inputs.nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };
      in {
        treefmt = {
          projectRootFile = "flake.nix";
          imports = ["${inputs.conf-nixos}/templates/base/treefmt.nix"];
        };

        packages =
          {
            # Font subset and launcher icons; in development: nix build .#app-assets -o app/public/generated
            app-assets = pkgs.callPackage ./nix/app-assets.nix {};
            app = pkgs.callPackage ./nix/app.nix {assets = own.app-assets;};
            default = own.app;
          }
          // lib.optionalAttrs android {
            # Store screenshots of the web build; `nix run .#screenshots` puts them in fastlane/.
            screenshots = pkgs.callPackage ./nix/screenshots.nix {web = own.app;};
            # Unsigned; `nix run .#apk` signs it and can install it.
            apk = androidPkgs.callPackage ./nix/apk.nix {
              assets = own.app-assets;
              web = own.app;
            };
          };

        apps = lib.optionalAttrs android {
          apk = {
            type = "app";
            program = lib.getExe (pkgs.callPackage ./nix/apk-app.nix {inherit (own) apk;});
            meta.description = "Sign the APK with the debug key or a release keystore, and optionally adb install it";
          };
          screenshots = {
            type = "app";
            program = lib.getExe own.screenshots.update;
            meta.description = "Render the store screenshots and copy them to fastlane/metadata";
          };
          fdroid-repo = {
            type = "app";
            program = lib.getExe (pkgs.callPackage ./nix/fdroid-repo.nix {});
            meta.description = "Build the F-Droid repo site from signed APKs into out/fdroid";
          };
        };

        # Needs impure eval for the project root: `nix develop --no-pure-eval`.
        devShells.default = inputs.devenv.lib.mkShell {
          inherit inputs pkgs;
          modules = [
            "${inputs.conf-nixos}/templates/base/devenv.nix"
            {
              packages = [
                # App; qrencode prints the link app/phone.fish serves
                pkgs.nodejs
                pkgs.qrencode
                # APK: Nix builds it (nix run .#apk); adb installs it
                pkgs.android-tools
              ];
            }
          ];
        };

        checks =
          {
            app = own.app.overrideAttrs {
              pname = "app-check";
              buildPhase = ''
                runHook preBuild
                npm run check
                npm test
                runHook postBuild
              '';
              installPhase = "touch $out";
            };
          }
          // lib.optionalAttrs android {
            # Gradle builds offline from nix/apk-deps.json.
            inherit (own) apk;
          };
      };
    };
}
