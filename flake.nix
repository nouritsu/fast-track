{
  description = "Fast Track: a Svelte TUI Mocha app for Android";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

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

  outputs = inputs @ {
    self,
    nixpkgs,
    devenv,
    ...
  }: let
    inherit (nixpkgs) lib;

    # androidenv's SDK tools only run on x86_64. `own` is this flake's packages.
    forAllSystems = f:
      lib.genAttrs ["x86_64-linux"] (system:
        f {
          inherit system;
          pkgs = nixpkgs.legacyPackages.${system};
          own = self.packages.${system};
        });
  in {
    packages = forAllSystems ({
      system,
      pkgs,
      ...
    }: let
      # The Android SDK is unfree, and androidenv asks for its licence to be accepted.
      androidPkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          android_sdk.accept_license = true;
        };
      };
    in rec {
      # Font subset and launcher icons; in development: nix build .#app-assets -o app/public/generated
      app-assets = pkgs.callPackage ./nix/app-assets.nix {};
      app = pkgs.callPackage ./nix/app.nix {assets = app-assets;};
      # Unsigned; `nix run .#apk` signs it and can install it.
      apk = androidPkgs.callPackage ./nix/apk.nix {
        assets = app-assets;
        web = app;
      };
      default = app;
    });

    apps = forAllSystems ({
      pkgs,
      own,
      ...
    }: {
      apk = {
        type = "app";
        program = lib.getExe (pkgs.callPackage ./nix/apk-app.nix {inherit (own) apk;});
        meta.description = "Sign the APK with the debug key or a release keystore, and optionally adb install it";
      };
    });

    devShells = forAllSystems ({
      pkgs,
      own,
      ...
    }: {
      # Needs impure eval for the project root: `nix develop --no-pure-eval`.
      default = devenv.lib.mkShell {
        inherit inputs pkgs;
        modules = [
          "${inputs.conf-nixos}/templates/base/devenv.nix"
          {
            packages = [
              # App; qrencode prints the link app/phone.fish serves
              pkgs.nodejs
              pkgs.qrencode
              # APK: Gradle and a JDK to build app/android by hand, adb to install
              pkgs.gradle
              pkgs.jdk21
              pkgs.android-tools
              # Nix
              pkgs.alejandra
            ];
            env.ANDROID_HOME = "${own.apk.sdk}";
          }
        ];
      };
    });

    # alejandra over every .nix file. treefmt supplies the paths: `nix fmt` passes
    # none, which bare alejandra would read as "format stdin".
    formatter = forAllSystems ({pkgs, ...}:
      pkgs.treefmt.withConfig {
        name = "alejandra-tree";
        runtimeInputs = [pkgs.alejandra];
        settings = {
          tree-root-file = "flake.nix";
          on-unmatched = "info";
          formatter.alejandra = {
            command = "alejandra";
            options = ["--quiet"];
            includes = ["*.nix"];
          };
        };
      });

    checks = forAllSystems ({
      system,
      own,
      ...
    }: {
      # Formats a copy of the .nix files and fails on any diff.
      formatting = self.formatter.${system}.check (lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.fileFilter (file: file.hasExt "nix") ./.;
      });

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

      # Gradle builds offline from nix/apk-deps.json.
      inherit (own) apk;
    });
  };
}
