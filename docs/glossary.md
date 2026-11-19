# Glossary

Terms that come up across these notes, with a link to where each one is used. Valve codenames are described only by where they appear on the headset. Entries are drawn from the docs, and anything from general knowledge is marked "(outside knowledge)".

**A/B slot.** SteamOS keeps two copies of the OS, slot A and slot B. (Outside knowledge: this lets an update be written to the one that isn't running.) On the headset each slot has its own `rootfs`, `efi` and `var` partitions, and the kernel command line names the booted slot as `rauc.slot=`. The boot firmware has a separate a/b slot of its own. See [Boot → Partsets](boot.md#partsets) and [Boot firmware package](boot.md#boot-firmware-package).

**ADB.** Android Debug Bridge, Android's USB debugging tool. On the headset, `adbd` runs over USB in developer mode or when the bootloader sets ADB or factory mode, and the initramfs recovery shell starts its own copy. See [Network services → USB networking and ADB](network-services.md#usb-networking-and-adb).

**aDSP, cDSP.** The SoC's audio DSP and compute DSP (a DSP is a digital signal processor). On the headset, SteamVR's `dsp_service` boots both through `/dev/adsp` and `/dev/cdsp`, not the kernel. See [Firmware → aDSP and cDSP](firmware.md#adsp-and-cdsp).

**AEC.** Echo cancellation (outside knowledge: AEC stands for acoustic echo cancellation). `steamvr dspaec 0|1` "disables (0) or enables (1) echo cancellation on adsp" by re-pointing two PipeWire config files from their `-cpu` filter chains to `-dsp` ones, whose `audiofilter.so` filter has an `AEC enable` control. See [Audio → Echo cancellation on the aDSP](audio.md#echo-cancellation-on-the-adsp-steamvr-dspaec).

**atomupd.** SteamOS's update service: `atomupd-daemon` on D-Bus as `com.steampowered.Atomupd1`, with the CLI `atomupd-manager`. Its client runs `rauc install` with a bundle URL. See [D-Bus → atomupd](dbus.md#os-updates-comsteampoweredatomupd1) and [Boot → Updates](boot.md#updates-rauc-atomupd-and-the-slot-switch).

**Basalt.** Named in a source path in `XRService`'s strings (`…/arcturus-xr/basalt/src/vi_estimator/landmark_creator.cpp`). The OpenXR page's interpretation reads it as the open-source visual-inertial odometry (VIO) library that `XRService`'s camera tracking builds on. See [OpenXR → Tracking pipeline and spaces](openxr.md#tracking-pipeline-and-spaces).

**binfmt_misc.** (Outside knowledge: the Linux kernel feature that hands executables of a registered format to an interpreter.) On the headset `/proc/sys/fs/binfmt_misc/` has no interpreter registered, so the kernel doesn't hand x86 ELF files to FEX on its own, and running an x86 binary from a shell fails. See [Running other software → No system FEX](compatibility.md#no-system-fex-no-binfmt_misc-registrations).

**Boulder, Denver.** The names of the headset's two speaker EQ filter chains (`filter-chain-boulder.conf`, `filter-chain-denver.conf`) and their LV2 plugins. At boot, `soundsetup.sh` links in Boulder when the EEPROM's audio vendor is `GGEC` and Denver otherwise; the headset surveyed used Denver. See [Audio → Boot-time setup](audio.md#boot-time-setup-soundsetupsh) and [Speaker path](audio.md#speaker-path).

**BTF.** BPF Type Format: type information about the running kernel that BPF programs, such as sched_ext schedulers, use to work across kernel builds. The headset's kernel exposes it at `/sys/kernel/btf/vmlinux`. See [Kernel → Build options](kernel.md#build-options-worth-knowing).

**CEF, DevTools.** CEF is the Chromium Embedded Framework. (Outside knowledge: it's the browser engine behind Steam's `steamwebhelper` and SteamVR's web UI.) DevTools is Chromium's remote debugging interface. Steam's is on `127.0.0.1:8080`, and developer mode forwards it to port 8081. See [Network services → Chromium DevTools](network-services.md#chromium-devtools-80808081-and-80878088).

**Deckard.** The codename used in the Frame's package names (`deckard-*`, `linux-72-deckard`) and by SteamOS Manager, which reports `steam_frame` / `Deckard`. U-Boot's version string also says "for deckard board". See [README → What this was gathered from](../README.md#what-this-was-gathered-from).

**Developer mode.** The setting that `steamos-devkit-mode` switches on and off. It turns on `sshd`, `xrdp`, the devkit service, the DevTools forwarders, ADB and USB NCM networking. See [Permissions → Developer mode](permissions.md#developer-mode).

**Devkit service.** `steamos-devkit-service`, Valve's Python HTTP service on port 32000. It advertises the headset over mDNS and installs SSH keys once the Steam client approves them. See [Network services → Devkit pairing service](network-services.md#devkit-pairing-service-port-32000).

**dm-verity.** A Linux device-mapper feature that checks each block of a read-only filesystem against a hash tree. It's built into the headset's kernel but not in use. See [Boot → Root filesystem](boot.md#root-filesystem-read-only-flag-and-dm-verity).

**DRM master, KMS.** (Outside knowledge: KMS, kernel mode setting, is the part of Linux's DRM graphics subsystem that sets display modes, and the DRM master is the one client on a card allowed to set them.) On the headset `vrcompositor` is the only DRM master on `card0`; gamescope and Xwayland only open the render node. Don't run `modetest`, `kmscube` or anything else that takes DRM master or sets a mode while SteamVR is running. See [Graphics → DRM clients](graphics.md#drm-clients) and [DRM/KMS](graphics.md#drmkms).

**EL2.** Arm's exception level 2, the CPU privilege level for hypervisors. The headset's kernel log says all CPUs started at EL2, and KVM is available. See [Kernel → Build options](kernel.md#build-options-worth-knowing).

**EROFS.** Enhanced Read-Only File System, a compact read-only Linux filesystem. `/boot/ubootfw.img`, which holds U-Boot's logos and fonts, is an EROFS image. See [Boot → Boot firmware package](boot.md#boot-firmware-package).

**FDM (fragment density map).** A Vulkan feature (`VK_EXT_fragment_density_map`) for shading parts of a render target at lower resolution, which the headset's Turnip driver supports. Valve's FDM injection layer, registered as the Vulkan layer `VK_LAYER_VALVE_fdm_injection` and the implicit OpenXR layer `XR_APILAYER_VALVE_fdm_injection`, has strings about foveation centers and eye-tracked foveation. See [OpenXR → API layers](openxr.md#xr_apilayer_valve_fdm_injection) and [Graphics → Valve layers](graphics.md#valve-vulkan-and-openxr-layers).

**FEX.** An x86 emulator. On the headset it isn't an OS package and has no binfmt_misc registration: the Steam client installs it as the `FEX-Emu` Steam tool (app 3127680), whose entry point is the `fex-compat-tool` script. The x86 Mesa it runs against is in `/usr/share/guestos/fex-mesa/`. `/usr/bin/FEXBash` is a Valve wrapper script, not FEX's own binary. See [Running other software → FEX](compatibility.md#fex).

**FEX thunks.** The `FEX-Emu` Steam tool ships `HostThunks/` (such as `libvulkan-host.so`, `libGL-host.so` and `libasound-host.so`) and matching `GuestThunks/` (`*-guest.so`) libraries, and `fex-compat-tool` points FEX's `ThunkHostLibs` and `ThunkGuestLibs` settings at them. (Outside knowledge: thunks let emulated x86 code call the native aarch64 build of a library instead of emulating it.) See [Running other software → The FEX-Emu Steam tool](compatibility.md#the-fex-emu-steam-tool) and [What `fex-compat-tool` does](compatibility.md#what-fex-compat-tool-does).

**FIT.** Flattened Image Tree, U-Boot's format for packing several images and their hashes into one file. `/boot/uboot.img` is a FIT with a U-Boot entry and a device-tree entry. See [Boot → Boot components](boot.md#boot-components).

**FPGA.** Field-programmable gate array: a chip whose logic is loaded from a bitstream at power-on. The headset's is a Gowin GW1N-2, loaded over SPI by `littlebee_config` at every boot. See [Hardware → FPGA](hardware.md#fpga) and [Firmware → FPGA bitstreams](firmware.md#fpga-bitstreams).

**Galileo.** Appears in `steamos-firmware-update`, which runs `jupiter-biosupdate` when the DMI board name is `Jupiter` or `Galileo`. (Outside knowledge: Galileo is Valve's codename for the Steam Deck OLED.) See [Firmware → Update paths](firmware.md#update-paths).

**gamescope.** A compositor (outside knowledge: Valve's open-source one). On the headset, `gamescope-session.service` runs it with `--backend openvr` as the base of the VR session, turning flat apps' windows into SteamVR overlays. See [Services → How a boot reaches VR](services.md#how-a-boot-reaches-vr) and [Graphics → Compositing](graphics.md#compositing-gamescope-and-xwayland).

**HRTF.** (Outside knowledge: head-related transfer function, the filter that makes a sound seem to come from a direction.) SteamVR's spatializer plugin `vraudiocompositor.so` names `iplHRTFCreate` and "VrAudioCompositor: Failed loading Steam Audio HRTFs". See [Audio → Spatial audio](audio.md#spatial-audio).

**ICD, implicit and explicit layers.** (Outside knowledge: an ICD, or installable client driver, is a GPU driver that the Vulkan loader finds through a JSON manifest; layers sit between an app and the driver, and the Vulkan and OpenXR loaders load explicit layers only when asked.) On the headset the only Vulkan ICD is `/usr/share/vulkan/icd.d/freedreno_icd.aarch64.json` (Turnip). Per the graphics page, an implicit layer loads into every Vulkan app unless its manifest has an enable variable that isn't set. Valve's FDM injection library is registered as an explicit Vulkan layer and an implicit OpenXR API layer. See [Graphics → Vulkan](graphics.md#vulkan), [Layers](graphics.md#layers) and [OpenXR → API layers](openxr.md#api-layers).

**ICP, EVA/CVP.** Two device-tree blocks that the firmware page lists as "Camera ICP" (`ac00000.icp`, device node `/dev/icp`) and "EVA / CVP" (`ab00000.cvp`, device node `/dev/cvp`). The kernel log calls the second "cvp (eva)". Their firmware files, `CAMERA_ICP.mbn` and `evass.mbn`, are named in `XRService`. The notes don't expand these abbreviations, because nothing on the device does. See [Firmware → Camera ICP and EVA/CVP](firmware.md#camera-icp-and-evacvp).

**initramfs.** A small filesystem the kernel loads into memory before it mounts the real root. On the headset it's `/boot/initrd.uImage`, built by mkinitcpio. Its hooks find the booted slot, set most of the flash read-only, and mount `/var` and `/etc`. See [Boot → Initramfs](boot.md#initramfs).

**Interaction profile (OpenXR).** An OpenXR path naming a kind of input device, such as `/interaction_profiles/valve/frame_controller`, that apps suggest action bindings against. SteamVR's `vrclient.so` lists 19 of them and translates an app's suggested bindings into OpenVR binding files under `~/.config/openvr/config/openxr/`. See [OpenXR → Interaction profiles](openxr.md#interaction-profiles).

**Internal, Public (tags).** Every interface in these notes is tagged with one of these. Public means a published definition exists: D-Bus XML on the device, a spec, or an upstream project. Internal means it's only visible through Valve's own scripts, binaries and files, and is more likely to change. See [README → Public vs. internal](../README.md#public-vs-internal).

**Jupiter.** Appears in file names on the headset: `jupiter-biosupdate` (a stub that exits 0), polkit actions for `jupiter-*` programs that aren't installed, and a DMI board name checked by `steamos-firmware-update`. (Outside knowledge: Jupiter is Valve's codename for the original Steam Deck.) See [Permissions → Polkit](permissions.md#polkit-what-runs-as-root-without-a-password) and [Firmware → Update paths](firmware.md#update-paths).

**Lepton.** A Steam tool, installed at `steamapps/common/Lepton/`, whose README describes it as "a tool for use with the Steam client which allows games which are exclusive to Android to run on the Linux operating system". It runs an Android 11 (LineageOS 18.1) root filesystem in podman containers, with an Android build of SteamVR's OpenXR runtime inside; on the OS side, `pidbridge` ("Host PID bridge for Lepton containers"), a podman drop-in and the packages under `/usr/share/guestos/android/` support it. See [Running other software → Lepton](compatibility.md#lepton-android-games), [OpenXR → Android apps](openxr.md#android-apps-lepton) and [Local IPC → pidbridge](local-ipc.md#pidbridge).

**LV2, LADSPA.** (Outside knowledge: two Linux audio plugin formats.) The headset's speaker and mic EQs are LV2 plugins (`/usr/lib/lv2/valve_{boulder_speakers,denver_speakers,deckard_mic}.lv2/`). At boot, `soundsetup.sh` links SteamVR's `audiofilter.so`, `libphonon.so` and `vraudiocompositor.so` into `/run/ladspa` as LADSPA plugins. See [Audio → What `deckard-audio-config` installs](audio.md#what-deckard-audio-config-installs), [Boot-time setup](audio.md#boot-time-setup-soundsetupsh) and [Spatial audio](audio.md#spatial-audio).

**Mailbox (SteamVR).** A named endpoint that a SteamVR process, including the web UI, registers with `vrserver` to exchange JSON messages. From outside SteamVR, the only route found is the WebSocket on port 27062. See [SteamVR → Mailboxes](steamvr.md#mailboxes).

**MHI.** The bus of the Wi-Fi chip's `mhi0` device, which is a wakeup source on the headset. (Outside knowledge: MHI is Qualcomm's Modem Host Interface, used by its PCIe-attached chips.) See [Power → Sleep states](power.md#sleep-states) and [Wi-Fi chip and driver](wireless.md#wi-fi-chip-and-driver).

**NCM.** USB Network Control Model, a standard USB class for Ethernet over USB. In developer mode the headset adds an NCM function on `usb0` and takes the address `10.86.200.233`. See [Network services → USB networking and ADB](network-services.md#usb-networking-and-adb).

**nRF52.** (Outside knowledge: Nordic Semiconductor's family of Bluetooth Low Energy microcontrollers.) The headset radio that talks to the controllers is an nRF52, programmed from the SoC with `roy_dongle_fw.hex`. See [Firmware → Headset radio](firmware.md#headset-radio-nrf52) and [Controllers → How they connect](controllers.md#how-they-connect).

**ntsync.** A kernel driver built into the headset's kernel (`CONFIG_NTSYNC=y`) and exposed as `/dev/ntsync`, mode 666. Proton's `wineserver` contains `/dev/ntsync` and `ntsync: up and running.` (Outside knowledge: ntsync provides Windows NT synchronization primitives for Wine.) See [Running other software → Wine and ntsync](compatibility.md#wine-and-ntsync).

**OpenVR, OpenXR.** Two VR APIs. (Outside knowledge: OpenVR is Valve's VR API, and OpenXR is the Khronos standard.) SteamVR is registered as the runtime for both, through `openvrpaths.vrpath` and `active_runtime.json`. See [SteamVR → Finding the runtime](steamvr.md#finding-the-runtime) and [OpenXR and the VR runtime](openxr.md).

**Partset.** SteamOS's name for a group of partitions, exposed as symlinks under `/dev/disk/by-partsets/`: `A`, `B`, `self`, `other`, `shared` and `all`. See [Boot → Partsets](boot.md#partsets).

**`/persist`.** The `syspersist` partition, mounted read-only. It holds the unit's device config and calibration (`device_config.json`, `xrservice.json`, `eyetracking.json` and others), and `vrconfig_write` commits changes to a git repository inside it. See [SteamVR → Per-device config in /persist](steamvr.md#per-device-config-in-persist) and [Boot → Storage layout](boot.md#storage-layout).

**polkit, pkexec.** polkit is the freedesktop authorization framework, and `pkexec` runs a program as root when a polkit policy allows it (outside knowledge). Valve's policy files let the `steamos` user run a list of helpers as root without a password. See [Permissions → Polkit](permissions.md#polkit-what-runs-as-root-without-a-password).

**pressure-vessel.** See Steam Linux Runtime.

**Prism.** A SteamVR compositor path that ships disabled. `vrclient.so` has an OpenXR compositor backend for it (`openxr_compositor_prism.cpp`, `CSxrCompositorPrism`) next to the OpenVR one, `libprism.so` and `vrprismhost` ship with SteamVR, and `vrserver` logs "Not loading driver prism because it is disabled in settings". See [OpenXR → OpenVR driver model](openxr.md#openvr-driver-model).

**Proton.** On the headset, the Steam tool `Proton 11.0 (ARM64)` (app 4628740): an aarch64 Wine build whose Windows-side files include `libarm64ecfex.dll` and `libwow64fex.dll`, and which requires the `SteamLinuxRuntime_4-arm64` tool. (Outside knowledge: Proton is Valve's Wine-based compatibility tool for running Windows games.) See [Running other software → Proton](compatibility.md#proton).

**RAUC.** Robust Auto-Update Controller (outside knowledge: an open-source A/B update tool). On the headset it installs update bundles into the slot that isn't running, using a custom bootloader backend that calls `steamos-bootconf`. See [Boot → Updates](boot.md#updates-rauc-atomupd-and-the-slot-switch) and [D-Bus → RAUC](dbus.md#rauc-depengutronixrauc).

**remoteproc.** The Linux framework for loading firmware into the SoC's other processors and starting them. It's built into the headset's kernel, but `/sys/class/remoteproc/` is empty. See [Firmware → Not remoteproc](firmware.md#not-remoteproc).

**Renderpass Optimizer (RPO).** Valve's explicit Vulkan layer `VK_LAYER_VALVE_rpo`, from the same source tree and package as the FDM injection layer; its option strings cover reordering, merging and deleting render passes. Steam's graphics defaults file says to enable it per game with `STEAM_LAUNCH_WRAPPER_RPO=1`. See [Graphics → Valve layers](graphics.md#valve-vulkan-and-openxr-layers) and [Developer workflow → The graphics environment file](developer-workflow.md#the-graphics-environment-file).

**Roy.** The name used in the controllers' file and class names (`CRoyController`, `roy_*` configs, model numbers like `Roy_DV1_Left`) and in the headset radio's firmware (`roy_dongle_fw.hex`). See [Controllers](controllers.md).

**s2idle, deep.** The two suspend modes in `/sys/power/mem_sleep`, which reads `s2idle [deep]` on the headset (deep is selected); the journal's suspends log `PM: suspend entry (deep)`. (Outside knowledge: s2idle suspends by idling the CPUs, and deep is suspend-to-RAM, which powers down more of the system.) See [Power → Sleep states](power.md#sleep-states).

**sched_ext, scx_lavd.** sched_ext is a Linux feature that lets a BPF program act as the CPU scheduler. `scx_lavd` is one such scheduler: `scx.service` runs it on the headset, and SteamOS Manager's `CpuScheduler` property reports `lavd`. See [Services → Boot, updates and filesystem](services.md#boot-updates-and-filesystem) and [D-Bus → CpuScheduler1](dbus.md#cpuscaling1-cpuboost1-cpuscheduler1).

**Slot.** See A/B slot.

**Soft AP.** A Wi-Fi access point run in software. `softapmanager` runs the headset's own network on `wlanap`, alongside the normal client connection on `wlan0`. See [Local IPC → Soft-AP manager](local-ipc.md#soft-ap-manager) and [Network services → The Frame's own Wi-Fi hotspot](network-services.md#the-frames-own-wi-fi-hotspot).

**splctl.** Valve's command-line tool for reading and writing bootloader slot state (package `deckard-uboot-splctl`). It has write subcommands, so don't run it to explore. See [Boot → splctl](boot.md#splctl).

**Steam Audio, phonon.** SteamVR ships `libphonon.so` (37 MB), whose strings include "# Generated by Steam Audio". The spatializer plugin `vraudiocompositor.so` names it, along with `iplHRTFCreate` and "VrAudioCompositor: Failed loading Steam Audio HRTFs". See [Audio → Spatial audio](audio.md#spatial-audio).

**Steam Linux Runtime, pressure-vessel.** The Steam Linux Runtime is a set of container runtimes installed as Steam tools; the headset had `SteamLinuxRuntime_4-arm64` (aarch64), `SteamLinuxRuntime_soldier` and `SteamLinuxRuntime` (scout). pressure-vessel is their container tool, and `fex-compat-tool` tells it where to find FEX's `emulator.json`. See [Running other software → Steam Linux Runtime](compatibility.md#steam-linux-runtime) and [What `fex-compat-tool` does](compatibility.md#what-fex-compat-tool-does).

**SteamOS Manager.** A daemon for device settings (outside knowledge: Valve's open-source one), on D-Bus as `com.steampowered.SteamOSManager1`, with the CLI `steamosctl`. See [D-Bus → SteamOS Manager](dbus.md#steamos-manager).

**SWD.** Serial Wire Debug, Arm's two-wire debug and programming interface. `openocd` uses it, through SoC GPIO lines, to program the headset radio. See [Firmware → Headset radio](firmware.md#headset-radio-nrf52).

**Turnip.** Mesa's Vulkan driver (`libvulkan_freedreno.so`), the only native GPU driver on the headset. It reports `Turnip Adreno (TM) 750` and Vulkan 1.4.362. See [Graphics → Vulkan](graphics.md#vulkan).

**U-Boot SPL, U-Boot proper.** U-Boot is an open-source bootloader (outside knowledge). Its SPL (secondary program loader) is a small first stage, in the `uefi_a/b` partitions on the headset. Its strings cover slot choice and loading U-Boot proper from `uboot_a/b`. U-Boot proper has the boot menu and boots the kernel. See [Boot → U-Boot SPL](boot.md#u-boot-spl) and [U-Boot proper](boot.md#u-boot-proper).

**UCM.** (Outside knowledge: ALSA's Use Case Manager, configuration files that describe how to set up a sound card's mixer for each use.) `deckard-audio-config` provides the UCM directories `LPASS-SNDCARD/` and `SM8250_LPASS/`, each with one use case, `HiFi`. See [Audio → UCM profile](audio.md#ucm-profile).

**V4L2.** Video4Linux2, Linux's camera and video API. The headset's cameras appear as V4L2 sub-devices (`/dev/v4l-subdev*`) and capture nodes (`/dev/video*`). See [Hardware → Cameras](hardware.md#cameras).

**VIO.** Visual-inertial odometry: tracking from cameras plus an IMU. The OpenXR page's interpretation describes `XRService`'s tracking this way, built on Basalt with four tracking cameras and one IMU, and `vrserver.txt` logs counters such as `NumSwitchesToVIO` and `NumVioResets`. See [OpenXR → Tracking pipeline and spaces](openxr.md#tracking-pipeline-and-spaces).

**vrconsole.** The kernel's built-in VR text console: an in-kernel DRM client (`CONFIG_DRM_CLIENT_VRCONSOLE=y`, described as "DRM VR VT console") that the kernel starts on the panels at boot. See [Graphics → The VR text console](graphics.md#the-vr-text-console-vrconsole).

**vrdevice_path.** Valve's helper `/usr/local/bin/vrdevice_path <key>`, which prints the device node or sysfs file for a named piece of hardware. See [Hardware → vrdevice_path](hardware.md#vrdevice_path-the-name-to-node-map).

**vrlink.** SteamVR's PC streaming client, `/opt/steamvr/tools/vrlink/bin/linuxarm64/vrlink`. Its strings show a UDP link to a PC and video decoding on the SoC's V4L2 hardware decoder; it wasn't running during the survey. See [Wi-Fi, Bluetooth and streaming → PC streaming](wireless.md#pc-streaming-vrlink).

**WCN7850, ath12k.** The WCN7850 is the headset's Qualcomm Wi-Fi and Bluetooth combo chip. Its Wi-Fi side is on PCIe, driven by the upstream `ath12k` driver with Valve's module options; its Bluetooth side is on a UART, driven by `hci_uart_qca`. See [Wi-Fi, Bluetooth and streaming → Wi-Fi chip and driver](wireless.md#wi-fi-chip-and-driver) and [Bluetooth controller](wireless.md#bluetooth-controller).

**WirePlumber.** The session manager that runs alongside PipeWire. On the headset, `deckard-audio-config` adds WirePlumber scripts and rules for spatial audio, the microphone filters, and which clients can see which audio nodes. (Outside knowledge: WirePlumber is PipeWire's standard session and policy manager.) See [Audio → Spatial audio](audio.md#spatial-audio) and [Access rules](audio.md#access-rules-who-sees-which-nodes).

**Xwayland.** (Outside knowledge: an X11 server that runs as a Wayland client, so X11 apps can run under a Wayland compositor.) On the headset gamescope starts two Xwayland servers, `:0` for Steam and `:1` for games, and both only open the GPU's render node. See [Graphics → Compositing](graphics.md#compositing-gamescope-and-xwayland).

**Zink.** Mesa's OpenGL driver that runs on top of Vulkan. On the headset, all OpenGL and OpenGL ES go through Zink on Turnip, and the session caps the GL version reported to apps at 4.3. See [Graphics → OpenGL, GLES and EGL](graphics.md#opengl-gles-and-egl).

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
