# Developer workflow

This page is about working on the headset as a developer: which tools are installed, where changes survive a reboot or an update, how packages and containers work, how to run your own Steam client or SteamVR, how to start and inspect programs from SSH, and how to debug and profile them. Where another page already covers something, this one links to it.

Nothing on this page was installed, built, deployed or launched. Tool presence comes from `which` and `pacman -Q`, and behavior from reading scripts, unit files and configs. Running other people's software (FEX, Proton, Lepton, Flatpak) is on [Running other software](compatibility.md).

## What matters

- **The image already has a toolchain.** `gcc` 15, `clang` 21, `cmake`, `gdb`, `perf`, `valgrind` and RenderDoc are installed. `lldb`, `ltrace`, `rustc`, `cargo`, `go`, `perfetto`, `bpftrace`, `gpuvis`, `sysprof` and `heaptrack` aren't. ([What's installed](#whats-installed))
- **Only some places survive an OS update.** `/home` and the offload mounts on it are kept. `/etc` keeps only the paths on the update keep list. `/usr` and the rest of the root image are replaced. ([The read-only root and where changes persist](#the-read-only-root-and-where-changes-persist))
- **SSH shells have no `DISPLAY`.** The session's display variables are in the user's systemd manager; `systemctl --user show-environment` lists them. ([Starting and inspecting programs from SSH](#starting-and-inspecting-programs-from-ssh))
- **A sideloaded Steam client goes in `~/devkit-game`.** `select_steam.sh` runs `~/devkit-game/steam/RUNSTEAM.sh` when `~/devkit-game/devkit-steam` and a client under `~/devkit-game/steam/` exist. `select_steam.sh --print` shows which client it would run. ([Running your own Steam client](#running-your-own-steam-client))
- **Per-game graphics variables are in `gfx.txt`.** `steam.service` copies Steam's defaults to `$XDG_RUNTIME_DIR/steam/env/gfx.txt`, which `steam-launch-wrapper` reads at game start; `~/.config/steam/env/gfx.txt` is read after it. ([The graphics environment file](#the-graphics-environment-file))

## What's installed

**Tag: Public (upstream).** These come from the OS image (`which <tool>`, then `pacman -Qo` and `pacman -Q`):

| Area | Installed | Not found |
|---|---|---|
| Compilers and build | `gcc`/`g++` 15.2.1, `clang`/`clang++` 21.1.8, `lld` 21.1.8, `binutils` 2.46, `make` 4.4.1, `cmake` 4.2.3, `ninja` 1.13.2, `meson` 1.10.1, `pkgconf`, `base-devel` | `rustc`, `cargo`, `go` |
| Headers | `/usr/include/stdio.h` (`glibc` 2.43), `/usr/include/vulkan/vulkan.h`, `linux-api-headers` 7.2.0 | `/usr/include/openxr/openxr.h`, OpenVR headers, `/usr/lib/modules/$(uname -r)/build` (no kernel build tree) |
| Debuggers | `gdb` and `gdbserver` 17.1, `valgrind` 3.25.1, `strace` 6.19 | `lldb`, `lldb-server`, `ltrace` |
| Profiling and tracing | `perf` 7.2.0 (same version string as the kernel), `trace-cmd` 3.3.3, `bpftool` (package `bpf` 7.2.0), `gpu-trace`, `mangohud` | `perfetto`, `bpftrace`, `gpuvis`, `sysprof`, `heaptrack` |
| Graphics | `renderdoc` 1.45 (`renderdoccmd`, `qrenderdoc`), `gfxreconstruct` 1.4.363.0 (`gfxrecon-replay`), `vulkan-tools` (`vulkaninfo`, `vkcube`), `mesa-utils` (`glxinfo`, `eglinfo`), Fossilize tools (`fossilize-replay` and others, from `deckard-vulkan-layers-linux-aarch64`) | `vulkan-validation-layers` package |
| Other | `python` 3.14.3 with `pip`, `git` 2.53.0, `jq`, `socat`, `tcpdump`, `htop`, `debuginfod` client | `adb` on `PATH` (the `android-platform-tools` package provides the on-device `adbd`, see [network services](network-services.md#usb-networking-and-adb)) |

**Debug symbols.** `/etc/profile.d/debuginfod.sh` sets `DEBUGINFOD_URLS` from the `*.urls` files in `/etc/debuginfod/` when it isn't already set. Those files include:

- `archlinux.urls` (package `libelf`): `https://debuginfod.archlinux.org`
- `steamos.urls` (package `steamos-customizations-deckard`): `https://debuginfod.steamos.cloud`

`pacman.conf` also lists `core-debug` and `extra-debug` repositories ([below](#package-management)). No `*-debug` package was installed, and `/usr/lib/debug` didn't exist.

**SteamVR samples.** `/opt/steamvr/bin/linuxarm64/` contains `helloxr` and `hellovr_sdl` (aarch64 ELF files). They weren't run.

## Getting a shell

Turn on developer mode, then use SSH: the [README quick start](../README.md#quick-start) covers finding the headset and pairing a key through the [devkit service](network-services.md#post-register). Over a USB-C cable the headset is `10.86.200.233`: `/usr/share/deckard/usb-ncm-dnsmasq.sh` gives the headset `10.86.$((IF_IDX+200)).233/29`, where `IF_IDX` is the number after `usb` in the interface name, so the address on `usb0` is fixed ([USB networking](network-services.md#usb-networking-and-adb)). An RDP login on port 3389 gets a KDE Plasma X11 session ([network services](network-services.md#remote-desktop-3389)). The `steamos` user's groups and what `sudo` needs are on [permissions](permissions.md#the-steamos-user).

## The read-only root and where changes persist

**Tag: Internal.**

The root filesystem is a btrfs subvolume with the read-only property set (`btrfs property get / ro` prints `ro=true`). Use that command, not `steamos-readonly status`, which remounts `/` read-write ([Boot sequence and bootloader → Root filesystem, read-only flag and dm-verity](boot.md#root-filesystem-read-only-flag-and-dm-verity), [safety](safety.md#things-that-change-state-when-they-look-read-only)).

Writable places, and what happens to them on an OS update:

| Path | Backing | Across an OS update |
|---|---|---|
| `/home` (including `~/devkit-game`, `~/.local/share/Steam`, `~/.config`) | Shared `home` partition | Kept (shared by both slots) |
| `/var/cache/pacman`, `/var/lib/flatpak`, `/var/lib/containers`, `/var/lib/systemd/coredump`, `/var/log`, `/var/tmp`, `/root`, `/srv` | Offload mounts on the `home` partition ([Services catalog → Filesystem mounts](services.md#filesystem-mounts)) | Kept |
| `/etc` | Overlay: the image's `/etc` below, `/var/lib/overlays/etc/upper` above | Only paths on the keep list are carried to the new slot (below) |
| The rest of `/var` | Per-slot `var` partition | `post-install.sh` formats the new slot's `var` and runs `holo-sync-var` ([Boot sequence and bootloader → Updates: RAUC, atomupd and the slot switch](boot.md#updates-rauc-atomupd-and-the-slot-switch)) |
| `/usr` and the rest of `/` | The read-only root image | Replaced. `steamos-devmode`'s own warning says "Changes to the root filesystem will be overwritten by the next SteamOS update." |

### Where changes persist

`/usr/lib/rauc/atomic-update-keep.conf` (from `steamos-customizations-deckard`) lists the `/etc` paths kept across an update. They include:

- `/etc/systemd/system/*.service`, `*.service.d/**`, `*.socket`, `*.socket.d/**`, `*.mount`, `*.mount.d/**`, `*.wants/**` and `*.requires/**`
- `/etc/ssh/*_key` and `*_key.pub`, `/etc/NetworkManager/system-connections/*`, `/etc/wireguard/*.conf`
- `/etc/passwd`, `/etc/group`, `/etc/shadow`, `/etc/gshadow`, `/etc/subuid`, `/etc/subgid`
- `/etc/environment`, `/etc/hostname`, `/etc/machine-id`, `/etc/localtime`, `/etc/resolv.conf`, `/etc/sddm.conf.d/*`, `/etc/dconf/**`
- `/etc/steamos-atomupd/preferences.conf`, `/etc/.devkit-service-on-os-update`
- `/etc/atomic-update.conf.d/*.conf`, where you can add your own entries

`/etc/pacman.conf`, `/etc/pacman.d/**` and `/etc/systemd/user/**` aren't on the list. `/etc/atomic-update.conf.d/example-additional-keep-list.conf` has commented examples (`/etc/systemd/*.conf`, `/etc/mkinitcpio.conf.d/*.conf`, and `/etc/**`, which it labels "DANGEROUS! Any files you (or pacman) touch in /etc will forever shadow all upstream changes from future atomic updates"). It also warns that "`pacman -Syu` may touch these files and thus prevent atomic updates from adjusting them in the future." `atomupd-manager simulate-update <build-id>` is described as showing "which /etc files would not be preserved after an update" ([services](services.md#filesystem-mounts)).

User-level changes in your home directory, like `~/.config/systemd/user/` units and drop-ins, are on the shared `home` partition.

## Package management

**Tag: Public (upstream)** for pacman; **Internal** for the SteamOS helpers.

`/etc/pacman.conf` (package `pacman` 7.1.0):

| Setting | Value |
|---|---|
| `DBPath` | `/usr/lib/holo/pacmandb/`, on the read-only root |
| `SigLevel` | `Optional DatabaseOptional` |
| Repositories, in order | `deckard-arch-hotfixes-release-0.5`, `core`, `extra`, `core-debug`, `extra-debug` |

There's no `multilib` section. `/etc/pacman.d/` holds `gnupg/` and a one-line `mirrorlist`.

Two helper scripts from `steamos-customizations-deckard` handle making the root writable for packages. Neither was run; this is what the scripts contain.

- **`steamos-devmode enable|status [--no-prompt]`** (must be run as root). `enable` prints a warning, runs `steamos-readonly disable`, deletes `/etc/pacman.d/gnupg/`, runs `pacman-key --init` and `pacman-key --populate`, and touches `/usr/share/steamos/devmode-enabled` (on the root image, so it goes away when the image changes). That file didn't exist on the headset surveyed. The warning text recommends packaging apps with Flatpak and building "in the Holo container images with distrobox/toolbox". `status` calls `steamos-readonly status`, which remounts `/` read-write ([safety](safety.md#things-that-change-state-when-they-look-read-only)).
- **`steamos-unminimize [--dev] [--noconfirm] [directory …]`** reinstalls packages with missing files ("largely a wrapper around `pacman -Qk`"). Its usage text says it "can be used to undo the minimization that occurs at SteamOS image building time, installing missing files such as man pages and includes." `--dev` also installs `base-devel` and `multilib-devel`. On this image, `pacman -Qk` reported 0 missing files for `gcc` and 1 for `glibc`, and `base-devel` was already installed.

`steamos-readonly enable` turns the read-only flag back on; the `steamos-devmode` usage text notes that this "does not undo changes performed while in dev mode".

## Containers

**Tag: Public (upstream).** podman 5.8.0 is installed with `crun`, `conmon`, `catatonit`, `netavark`, `aardvark-dns` and `passt`. `distrobox` and `toolbox` aren't installed. `/etc/subuid` and `/etc/subgid` each give `steamos` the range `100000:65536`, and both files are on the update keep list. System container storage is on the `home` partition. Details, including Valve's podman drop-in for Lepton, are on [Running other software → Containers (podman)](compatibility.md#containers-podman).

`/dev/kvm` is mode 666 ([kernel](kernel.md#build-options-worth-knowing)), and `/dev/fuse` is mode 666.

## Running your own Steam client

**Tag: Internal.** `steam.service` runs `select_steam.sh RUNSTEAM.sh`. The selection logic is on [Services catalog → Which Steam and which SteamVR?](services.md#which-steam-and-which-steamvr). In short: if `~/devkit-game/devkit-steam` exists (the script calls it a "trampoline file") and `~/devkit-game/steam/steamrtarm64/steam` (or the legacy `linuxarm64/steam`) exists, it runs `~/devkit-game/steam/RUNSTEAM.sh`. Otherwise it runs `~/.local/share/Steam/RUNSTEAM.sh`. `select_steam.sh --print` prints the choice without running anything, and `--verbose` explains it.

`~/devkit-game` didn't exist on the headset surveyed.

What else the files say about a sideloaded client:

- `steam.service` copies `/usr/share/deckard/RUNSTEAM.sh` into `~/.local/share/Steam/` (`cp -u`) before each start. It doesn't copy it into `~/devkit-game/steam/`, so a sideloaded client needs its own `RUNSTEAM.sh` there.
- `RUNSTEAM.sh` treats `~/devkit-game/steam` as a sideload. Its comment cites a Deckard task tracker issue for "custom handling of sideloaded steam client on deckard". In that case it:
  - sets `SUPPRESS_STEAM_OVERLAY=1` (the comment describes a crash with the overlay injected into the sideloaded client's game launches)
  - points `~/.steam/steam` at `~/.local/share/Steam` ("The sideloaded client uses the OS client's steam library installation")
  - reads the client's arguments from `~/devkit-game/steamdeckard-argv.json` (`jq -r '.[0]'`) instead of the built-in `-cef-enable-debugging -deckard -gamepadui -steamdeck -steamos3 -vrgamepadui`
  - if `~/devkit-game/steamdeckard-settings.json` has `"gdbserver": "1"`, starts the client under `gdbserver 127.0.0.1:2345`
- Either way, the client's output goes to `~/.local/share/Steam/logs/steam_output.log`.
- For the OS client, `steam.service` passes `STEAM_EXTRA_ARGS` through to the command line. The unit's comment says to set it in a drop-in named `extra_args.conf` under `~/.config/systemd/user/steam.service.d/`, `/usr/lib/systemd/user/steam.service.d/` or `/etc/systemd/user/steam.service.d/`, and gives `-inhibitbootstrap -nobootstrapperupdate` as the example.

`/usr/share/steamos-devkit/hooks/` (package `steamos-devkit-service`) contains only `approve-ssh-key`, `install-ssh-key`, `devkit-1-identify` and the `devkit_utils/` helper. No hook there writes to `~/devkit-game`, and what's meant to fill that directory wasn't determined.

Restart the session with `steamvr restart`, not by stopping `steam.service` directly ([Services catalog → Working with these units](services.md#working-with-these-units)). `steamvr restart` stops the running session and starts it again: it runs `steamvr stop` (which stops `sddm`, `steam.service` and `steamvr.service`), then `steamvr start` ([SteamVR on the Frame → The `steamvr` command](steamvr.md#the-steamvr-command)).

## Running a different SteamVR build

See [SteamVR on the Frame → Running a different SteamVR build](steamvr.md#running-a-different-steamvr-build) for `steamvr setpath`, `apply-setpath` and the `~/work` overlay mounts. RAUC's `post-install.sh` resets the path with `steamvr setpathdefault` after an OS update unless it's `/opt/steamvr` or `/home/steamos/work/MainSteamVR` ([Boot sequence and bootloader → Updates: RAUC, atomupd and the slot switch](boot.md#updates-rauc-atomupd-and-the-slot-switch)).

## Starting and inspecting programs from SSH

**Tag: Internal.**

An SSH shell doesn't have the session's display environment. Variable names only, as observed:

| Where | Display and session variables present |
|---|---|
| SSH login shell (`env`) | `XDG_RUNTIME_DIR`, `DBUS_SESSION_BUS_ADDRESS`, `XDG_SESSION_ID`, `XDG_SESSION_TYPE`, `XDG_SESSION_CLASS`. No `DISPLAY`, `WAYLAND_DISPLAY` or `GAMESCOPE_WAYLAND_DISPLAY`. |
| The user's systemd manager (`systemctl --user show-environment`) | `DISPLAY`, `GAMESCOPE_WAYLAND_DISPLAY`, `LIBEI_SOCKET`, `STEAM_GAME_DISPLAY_0`, `ENABLE_GAMESCOPE_WSI`, `XDG_CURRENT_DESKTOP`, `XDG_SESSION_TYPE`, `XDG_SESSION_DESKTOP`, `XDG_DATA_DIRS`, `XCURSOR_THEME`, `XCURSOR_SIZE`, `SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS` and the `STEAM_GAMESCOPE_*` and `STEAM_MANGOAPP_*` flags |
| `steam` process (`/proc/<pid>/environ`) | The manager's set, plus `LD_LIBRARY_PATH`, `STEAM_RUNTIME`, `STEAM_RUNTIME_LIBRARY_PATH`, `STEAM_COMPAT_TOOL_MAPPINGS`, `STEAM_LAUNCH_WRAPPER_*`, `STEAM_EXTRA_ARGS`, `MESA_GL_VERSION_OVERRIDE`, `MESA_GLSL_VERSION_OVERRIDE`, `VRCOMPOSITOR_TU_DEBUG` and others |
| `vrcompositor` process | The manager's set, plus `STEAMVR_APPKEY`, `SteamAppId`, `SteamGameId`, `TU_DEBUG`, `VRCOMPOSITOR_TU_DEBUG`, the two `MESA_*` overrides |

Neither `steam` nor `vrcompositor` had `WAYLAND_DISPLAY`, or any `XR_*` or `VR_*` variable. The runtime is registered in files: `openvrpaths.vrpath` and `active_runtime.json` ([SteamVR on the Frame → Finding the runtime](steamvr.md#finding-the-runtime)).

Where the session variables come from:

- `/usr/lib/steamos/gamescope-onready` runs `dbus-update-activation-environment` and `systemctl --user import-environment` for the names listed in `/usr/lib/steamos/gamescope-env-list` (`gamescope_inherit_vars`: `DISPLAY`, `WAYLAND_DISPLAY`, `GAMESCOPE_WAYLAND_DISPLAY`, `LIBEI_SOCKET`, `STEAM_GAME_DISPLAY_0`, `STEAM_GAME_DISPLAY_1` and others). That's how they reach the user manager.
- Five user units load `/usr/share/deckard/mesavars.sh` as an `EnvironmentFile`: `gamescope-session.service`, `steam.service`, `steamvr.service`, `steamvr-plasma.service` and `steamvr-v4l2cam.service`. It sets `MESA_GL_VERSION_OVERRIDE=4.3`, `MESA_GLSL_VERSION_OVERRIDE=430` and `VRCOMPOSITOR_TU_DEBUG=sysmem,preempt`.
- The session's sockets: `/run/user/1000/gamescope-0` and `gamescope-0-ei`, `/run/user/1000/pipewire-0`, `/run/user/1000/pulse`, and `/tmp/.X11-unix/X0` and `X1`.

### The graphics environment file

`steam.service` copies `/usr/share/deckard/steam_launch_wrapper_env_defaults.txt` to `$XDG_RUNTIME_DIR/steam/env/gfx.txt` before each start. The file's header says `steam-launch-wrapper` reads it "upon game start", that the copy in `$XDG_RUNTIME_DIR` can be edited directly, and that `~/.config/steam/env/gfx.txt` is read after it for persistent overrides. Its settings, by name:

| Setting | Value or purpose (from the file's comments) |
|---|---|
| `VK_INSTANCE_LAYERS` | Commented out. Add your own layers here; the RPO layer is enabled per game with `STEAM_LAUNCH_WRAPPER_RPO=1` in Steam's per-app settings. |
| `ENABLE_MESA_VRAM_REPORT_LIMIT`, `VK_VRAM_REPORT_LIMIT_HEAP_SIZE`, `VK_VRAM_REPORT_LIMIT_DEVICE_ID` | "limit the vram avail to all games that use thunking to 4096MB" |
| `PROTON_USE_PREPOPULATED_PREFIX` | `1` |
| `STEAM_COMPAT_TRACING` | `1`: "Tell pressure-vessel to expose `/sys/kernel/tracing` as read/write so games can trace" |
| `TU_AUTOTUNE_FLAGS` | `preempt_optimize` (`TU_AUTOTUNE_ALGO` commented out) |
| `GFXRECON_CAPTURE_FILE`, `GFXRECON_MEMORY_TRACKING_MODE` | `/tmp/gfxrecon_capture.gfxr`, `unassisted`; used once you add `VK_LAYER_LUNARG_gfxreconstruct` |
| `VK_APIDUMP_LOG_FILENAME` | `/tmp/vk_apidump_log.txt`; used once you add `VK_LAYER_LUNARG_api_dump` |
| `PRESSURE_VESSEL_IMPORT_OPENXR_1_LAYERS`, `PRESSURE_VESSEL_IMPORT_OPENXR_1_RUNTIMES` | `1`: "Tell pressure-vessel that it's okay to enable OpenXR layers on this system" |

### Vulkan layers on the system

| Manifest | Package |
|---|---|
| Explicit: `VkLayer_api_dump.json`, `VkLayer_monitor.json`, `VkLayer_screenshot.json` | `vulkan-extra-layers` |
| Explicit: `VkLayer_gfxreconstruct.json` | `gfxreconstruct` |
| Explicit: `VkLayer_VALVE_fdm_injection.json`, `VkLayer_VALVE_rpo.json` | `deckard-vulkan-layers-linux-aarch64` |
| Implicit: `VkLayer_fossilize.json` | `deckard-vulkan-layers-linux-aarch64` |
| Implicit: `VkLayer_MESA_vram_report_limit.json` | `deckard-mesa-linux-aarch64` |
| Implicit: `MangoHud.aarch64.json` | `mangohud` |
| Implicit: `VkLayer_FROG_gamescope_wsi.aarch64.json` | `gamescope` |
| Implicit (in `/etc/vulkan/implicit_layer.d/`): `renderdoc_capture.json` | `renderdoc` |

`deckard-vulkan-layers-linux-aarch64` also installs OpenXR API layer manifests for the FDM injection layer, in `/usr/share/openxr/1/api_layers/explicit.d/` and `implicit.d/`. The Khronos validation layer isn't a system package, but the Steam client ships `libVkLayer_khronos_validation.so` in `steamrtarm64/`.

## Debugging and profiling

### Debuggers

**Tag: Public (upstream).**

- `/proc/sys/kernel/yama/ptrace_scope` is `1`.
- `ulimit -c` in an SSH shell is `unlimited`.
- `RUNSTEAM.sh` can start a sideloaded Steam client under `gdbserver 127.0.0.1:2345` ([above](#running-your-own-steam-client)).
- Lepton has `gdb_server`, `lldb_server`, `gdb_attach`, `strace` and `perfetto` support for Android games ([Running other software → Lepton verbs](compatibility.md#verbs)).
- Steam's and SteamVR's Chromium UIs are debuggable over DevTools on ports 8081 and 8088 ([network services](network-services.md#chromium-devtools-80808081-and-80878088)).

### perf and tracing

**Tag: Public (upstream).**

| Item | Observed |
|---|---|
| `/proc/sys/kernel/perf_event_paranoid` | `2` |
| `/proc/sys/kernel/kptr_restrict` | `0` |
| `/sys/kernel/tracing` | `root:perf`, mode 775 |
| `/sys/kernel/debug` | `root:perf`, mode 750 ([The kernel → Where to look](kernel.md#where-to-look)) |
| `steamos` user's groups | include `perf` ([permissions](permissions.md#the-steamos-user)) |
| `/usr/bin/perf` | No file capabilities (`getcap` printed nothing) |
| Kernel | `CONFIG_PERF_EVENTS`, `CONFIG_KPROBES`, `CONFIG_UPROBES`, `CONFIG_FTRACE`, BPF and BTF are built in ([The kernel → Build options worth knowing](kernel.md#build-options-worth-knowing)) |

### gpu-trace

**Tag: Internal.** `gpu-trace.service` runs `gpu-trace --daemon` as root, with an XML-RPC control port on `localhost:47317` ([network services](network-services.md#gpu-trace-xml-rpc-47317)). The options defined in the script's `argparse` setup are `--daemon`, `--verbose`, `--logfile`, `--output`, `--no-gpuvis`, `--enable-startup-tracing`/`--no-enable-startup-tracing`, `--get-startup-tracing`, `--capture`, `--exit`, `--start`, `--stop` and `--get-tracing-status`. `gpuvis` isn't installed on the headset. The start/capture/stop sequence is on [Network services → gpu-trace XML-RPC (47317)](network-services.md#gpu-trace-xml-rpc-47317).

### RenderDoc

**Tag: Public (upstream)** for RenderDoc; **Internal** for SteamVR's hooks.

- `renderdoc` 1.45 installs `/usr/lib/librenderdoc.so`, `renderdoccmd`, `qrenderdoc` and the implicit Vulkan layer `VK_LAYER_RENDERDOC_Capture`, which loads when `ENABLE_VULKAN_RENDERDOC_CAPTURE=1` is set.
- `vrcmd --renderdoc-capture` is in `vrcmd --help` ([methodology](methodology.md#vrcmd-options)). `vrcmd`'s strings include `trigger_renderdoc_capture` and "Sent command. Captures only happen when SteamVR was started with vrstartup -renderdoc."
- `vrstartup`'s strings include `-renderdoc`, `STEAMVR_VRCOMPOSITOR_RENDERDOC`, `STEAMVR_VRSERVER_RENDERDOC`, and "-renderdoc: SteamVR is already running, so the running vrserver and vrcompositor won't load RenderDoc. Exit SteamVR first."
- `/opt/steamvr/tools/vrlink/bin/linuxarm64/run_vrlink_renderdoc.sh` runs `vrlink` with `LD_PRELOAD=/usr/lib/librenderdoc.so`, setting `TU_DEBUG=gmem` if `TU_DEBUG` isn't already set.
- For Android games, see [Running other software → Android pieces in the OS](compatibility.md#android-pieces-in-the-os).

How SteamVR's `-renderdoc` start option is passed through `steamvr.service` wasn't determined; none of these was run.

### Coredumps

**Tag: Internal.**

- `/proc/sys/kernel/core_pattern` pipes cores to `/usr/bin/python -m steamos_log_submitter.hooks.coredump` with `%P %e %u %g %s %t %c %h %f %E`.
- That hook (`/usr/lib/python3.14/site-packages/steamos_log_submitter/hooks/coredump.py`) always feeds the core to `/usr/lib/systemd/systemd-coredump`. It also feeds Breakpad's `/usr/lib/breakpad/core_handler` to make a minidump for the [log submitter](dbus.md#log-submitter-comsteampoweredsteamoslogsubmitter), except for executables under `/tmp/.mount_` (AppImage), `/app` (Flatpak), `/.local/share/Steam/` ("Steam-managed application, has its own handler") or `/homebrew/`.
- Developer mode adds `/etc/systemd/coredump.conf.d/steamos-devkit-coredumps-enabled.conf` with `[Coredump]` `MaxUse=3000M` ([Permissions and privileged helpers → Developer mode](permissions.md#developer-mode)). `/etc/systemd/coredump.conf` has no uncommented settings, and `/usr/lib/systemd/coredump.conf.d/` doesn't exist.
- `/var/lib/systemd/coredump` is on the `home` partition ([Services catalog → Filesystem mounts](services.md#filesystem-mounts)).
- `coredumpctl list` works as `steamos` and listed entries. Their contents aren't reproduced here; they name executables and PIDs.

## Interpretation

*This section is interpretation, not observation. It combines the facts above with general knowledge and may be wrong.*

**Compared with SteamOS on the Steam Deck.** The workflow pieces are the same SteamOS ones: a read-only btrfs root, an `/etc` overlay with an update keep list, offload mounts on `/home`, pacman with its database under `/usr/lib/holo`, `steamos-readonly`, `steamos-devmode` and `steamos-unminimize`, the devkit pairing service, `gpu-trace`, and coredumps routed through the log submitter. Code built or configured against those on a Deck should find the same paths here.

The differences, from outside knowledge of the Deck:

- **Tools in the image.** The Deck's image is minimized and ships without a compiler, headers or `gdb`; developers usually reach for `steamos-devmode`/`steamos-unminimize` or a container first. This image already has `gcc`, `clang`, `cmake`, `gdb`, `perf`, `valgrind`, RenderDoc, GFXReconstruct and `/usr/include`, so many build and debug tasks work without touching the read-only root.
- **Architecture.** The Deck is x86_64, so its Proton and Linux games run natively. Here, anything x86 goes through FEX inside Steam's launch path, and there's no binfmt fallback in a shell ([Running other software](compatibility.md#fex)). Native development means building for aarch64; `pacman.conf` has no `multilib`, which `steamos-unminimize --dev` asks for.
- **Containers.** Recent Deck images ship `distrobox` with podman. Here podman is present, apparently for Lepton, but `distrobox` and `toolbox` aren't, even though `steamos-devmode`'s warning text recommends them.
- **Devkit deployment.** On the Deck, the SteamOS Devkit Client uploads builds to `~/devkit-game` and the devkit service ships extra hooks for preparing uploads and launching titles. Here only the SSH-pairing and identify hooks exist, while `select_steam.sh` and `RUNSTEAM.sh` use `~/devkit-game` for a sideloaded Steam client instead of games.
- **The VR session.** The Deck's session is gamescope plus Steam. Here `steam.service` and `steamvr.service` share `gamescope-session.target` with gamescope's OpenVR backend, and the knobs for VR rendering (`gfx.txt`, `VRCOMPOSITOR_TU_DEBUG`, Valve's FDM and RPO layers) are specific to the headset.

**Launching from SSH.** Because `gamescope-onready` imports the display variables into the user manager, `systemd-run --user <program>` should start the program with the session's `DISPLAY` and `GAMESCOPE_WAYLAND_DISPLAY`, without copying them by hand. Running it launches `<program>` in the live session as a transient user unit, so only use it for a program you mean to start.

**Debug symbols.** `gdb` and other elfutils-based tools read `DEBUGINFOD_URLS`, so in a login shell they should be able to fetch symbols from the two servers listed above.

**The keep list and `systemctl edit`.** `systemctl edit` writes drop-ins under `/etc/systemd/system/<unit>.d/`, which matches the keep list's `*.service.d/**` and `*.socket.d/**` patterns, so system-unit drop-ins made that way should survive an update. `systemctl --user edit` writes to your home directory instead. `gdbserver` on `127.0.0.1:2345` is reachable from another machine through an SSH tunnel (`ssh -L 2345:127.0.0.1:2345`).

**Coredump limit.** In upstream systemd, `MaxUse=` caps the total disk space that stored coredumps may take, so developer mode's `MaxUse=3000M` is a 3 GB budget for all of them together rather than a per-dump size limit.

**ptrace and perf.** With `ptrace_scope` at `1`, `gdb -p` on a process that isn't gdb's child needs `sudo`; starting the program under `gdb` or `gdbserver` doesn't. With `perf_event_paranoid` at `2`, `perf` as `steamos` can profile its own processes in user space; kernel-side and system-wide profiling needs `sudo`, or `trace-cmd` and tracefs through the `perf` group.

## How to inspect this yourself

These only read. Don't run `steamos-devmode` or `steamos-readonly`, even with `status`; read them with `cat`.

```sh
# Tools
for t in gcc clang cmake gdb gdbserver lldb perf strace valgrind renderdoccmd gfxrecon-replay distrobox podman; do
  printf '%-16s %s\n' "$t" "$(command -v "$t" || echo -)"
done
pacman -Q gcc clang gdb perf renderdoc base-devel
cat /etc/debuginfod/archlinux.urls /etc/debuginfod/steamos.urls

# Read-only root, persistence, packages
btrfs property get / ro
grep -v '^#' /usr/lib/rauc/atomic-update-keep.conf
grep -nE '^\[|SigLevel|DBPath' /etc/pacman.conf
cat /usr/bin/steamos-devmode

# Your own Steam client
cat /usr/share/deckard/select_steam.sh /usr/share/deckard/RUNSTEAM.sh
systemctl --user cat steam.service
/usr/share/deckard/select_steam.sh --verbose --print
ls -R /usr/share/steamos-devkit/hooks

# Session environment (names only)
systemctl --user show-environment | cut -d= -f1
tr '\0' '\n' < /proc/$(pgrep -xo vrcompositor)/environ | cut -d= -f1 | sort
cat /usr/lib/steamos/gamescope-env-list /usr/share/deckard/mesavars.sh
cat "$XDG_RUNTIME_DIR/steam/env/gfx.txt"

# Debugging and profiling settings
cat /proc/sys/kernel/perf_event_paranoid /proc/sys/kernel/yama/ptrace_scope
ls -ld /sys/kernel/tracing /sys/kernel/debug
cat /proc/sys/kernel/core_pattern /etc/systemd/coredump.conf.d/*.conf
strings /opt/steamvr/bin/linuxarm64/vrstartup | grep -i renderdoc
```

`select_steam.sh --print` only prints a path. `/proc/<pid>/environ` values can include per-session tokens: share names, not values. `coredumpctl list` names programs and PIDs, so don't paste its output.

## Not determined

- What populates `~/devkit-game` for a sideloaded Steam client: a Valve tool, the devkit service or manual copying (no such hook is on the headset)
- What `~/devkit-game/steamdeckard-argv.json` and `steamdeckard-settings.json` contain beyond the `.[0]` and `.gdbserver` fields `RUNSTEAM.sh` reads
- How to start SteamVR with `vrstartup -renderdoc` under `steamvr.service`, and whether `STEAMVR_VRCOMPOSITOR_RENDERDOC` and `STEAMVR_VRSERVER_RENDERDOC` are read from the environment
- Whether pacman can install or update packages from the listed repositories with the shipped keyring, and whether `steamos-unminimize --dev` succeeds without a `multilib` repository (nothing was installed)
- Whether `/etc/pacman.conf` edits survive an update in practice (it isn't on the keep list)
- Whether the headset's SteamOS debuginfod servers serve symbols for the `deckard-*` packages
- Whether gpu-trace captures include GPU events from the Adreno driver, or only CPU-side ftrace and perf data
- Whether `perf` can read the GPU's hardware counters

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
