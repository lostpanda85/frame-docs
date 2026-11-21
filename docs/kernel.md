# The kernel

The Frame runs Linux 7.2 from Valve's own tree, packaged as `linux-72-deckard`. The package metadata points to `gitlab.steamos.cloud/deckard/deckardos/linux-valve`, which isn't publicly reachable, but Valve publishes source packages for many builds of this kernel elsewhere ([Source availability](#source-availability)). This page covers what's visible from the running system (plus public source listings, in [Source availability](#source-availability)): the build config, the drivers Valve added, how the hardware is described in the device tree, and the sysfs knobs those drivers expose.

Everything here is **Internal** except [In mainline Linux](#in-mainline-linux), which describes upstream code. Driver names, sysfs attributes and device-tree layout can change with any kernel update.

## Where to look

| What | Where | Needs root? |
|---|---|---|
| Kernel build config | `/proc/config.gz` (`zcat /proc/config.gz`) | no |
| Kernel log | `dmesg` (readable by all users: `kernel.dmesg_restrict = 0`) | no |
| Built-in driver metadata | `/usr/lib/modules/$(uname -r)/modules.builtin.modinfo` (NUL-separated; read with `tr '\0' '\n' < <file>`) | no |
| Loadable module metadata | `modinfo <module>` | no |
| Device tree | `/proc/device-tree/` (top-level compatible: `qcom,sm8650-dv1`, `qcom,sm8650`) | no |
| pstore (ramoops) | `/sys/fs/pstore/` (`CONFIG_PSTORE_RAM=y`; `dmesg`: `ramoops: using 0x240000@0x84a00000`, `pstore: Using crash dump compression: deflate`). `systemd-pstore.service` is disabled. In a later read-only pass run as root, `/sys/fs/pstore/` was empty (no stored crash records). | yes |
| debugfs | `/sys/kernel/debug` (`root:perf`, mode 750) | `perf` group, which `steamos` is in |

Almost every driver is built in. Only about 60 loadable modules ship, mostly networking extras, unused touchscreen drivers, the Wi-Fi driver (`ath12k`), the video codec (`iris`), and two power-supply drivers (`max1720x_battery`, `mp2652_charger`). There's one out-of-tree module, `v4l2loopback`, in `/usr/lib/modules/$(uname -r)/updates/`, from the `linux-72-v4l2loopback-deckard` package.

## Valve-written drivers

These declare `author=Valve` or name Valve in their description:

| Driver (module name) | Source path | modinfo description | Bound on the Frame |
|---|---|---|---|
| `valve_fpga` (platform drivers `valve_fpga_pwr`, `t8f81c2_fpga_pwr`) | `drivers/fpga/valve-fpga` | "Valve FPGA Power and clock" | `valve_fpga_pwr` → device `fpga` (compatible `valve,fpga`) |
| `slg4ax46073v_fan` | `drivers/hwmon/slg4ax46073v-fan` | "Valve Silego slg4ax46073v custom fan Driver" | 8-0008; hwmon `fan1_input`, `pwm1`, `pwm1_enable`, `pwm1_freq` |
| `panel_deckard` | `drivers/gpu/drm/panel/panel-deckard` | "Sharp LS0DAS7232 DSI Panel Driver with BOE support" | `ae94000.dsi.0` (compatible `deckard-panel`) |
| `panel_deckard_plano` | `drivers/gpu/drm/panel/panel-deckard-plano` | "Plano DSI Panel Driver" | no (no `deckard-panel-plano` node in the device tree) |
| `valve_5v_exp_regulator` | `drivers/regulator/valve-5v-exp-regulator` | "Valve 5V Expansion Regulator" | `exp_vout_5v` (compatible `regulator-valve_5v_exp`; [hardware](hardware.md#expansion-port-5-v)) |
| `valve_rgb_3v0_regulator` | `drivers/regulator/valve-rgb-3v0-regulator` | "Valve RGB 3V0 Regulator" | registers `exp_rgb_3v0_vout`; its only consumer is `arcimx616` 0-001a (`passthrough_left`) |
| `ktd2151_regulator` | `drivers/regulator/ktd2151-regulator` | "Kinetic ktd2151 dual dual output LCD bias power supply driver" | not checked |
| `nex10000ub_regulator`, `nex10000ub_dual_regulator` | `drivers/regulator/nex10000ub*` | "NEXPERIA nex10000ub dual output LCD bias power supply driver" (the `_dual` one adds "with combined enable pins") | `nex10000ub`: 8-003e and 9-003e |
| `tps61377_regulator` | `drivers/regulator/tps61377-regulator` | "TI 23-VIN, 25-VOUT 6-A synchronous boost converter with programmable peak current limit" | device-tree node `backlight_preboost` |
| `mp9184` | `drivers/regulator/mp9184` | "MPS MP9184A 19A, 600kHz, 20V Wide Input Range, Synchronous Boost Converter driver" | not checked |
| `mpq3367` | `drivers/regulator/mpq3367` | "MPS MPQ3367 6-Channel, Max.150mA/Ch Boost WLED Driver" | no |

The Valve FPGA driver registers two platform drivers, `valve_fpga_pwr` and `t8f81c2_fpga_pwr`; the bound one is `valve_fpga_pwr`, and it logs `valve,fpga probe done`. It exposes `/sys/bus/platform/devices/fpga/valve/enable` (root-writable), and a companion `fpga-clock` platform driver supplies a 24 MHz clock.

## Other Frame-specific drivers in the tree

These drivers serve Frame hardware but don't name Valve as author. Their modinfo credits individual authors or chip vendors.

| Driver | Description | Notes |
|---|---|---|
| `northgate_hotswap` | "Steam Frame Hotswap Driver" | For a Silego GreenPAK (`slg4ad48669m`, compatible `silego,northgate_hotswap`) at I²C 7-0018. See the notes below the table. |
| `mp2652_charger` (module) | "MP2652 Charger Driver" | A charger IC driver (compatible `mps,mp2652`). This board's device tree has no `mps,mp2652` node. |
| `max1720x_battery` (module) | "Maxim MAX17201/5, MAX17300/1/2/3, MAX17320 and MAX17330/2/5 Fuel Gauge driver" | Bound to 7-0036 (compatible `maxim,max17320`); power supply `max1720x_bat_7-36` |
| `max34417` | "MAX34417 Power Accumulator Driver" | Bound to 9-0010, 9-0012, 9-001a ([hardware](hardware.md#power-rails)) |
| `i2c-sw-broadcaster` | (no modinfo) | At probe it logs `broadcaster: new device` for 9-0010, 9-0012 and 9-001a, the three MAX34417 addresses on bus 9 |
| `mp3317_led` | (no modinfo) | Bound to 8-0028, 8-0029 and 9-0029 (compatible `mps,mp3317`). LED class devices: `mp3317-backlight-left`, `mp3317-backlight-right`, `mp3317-scene-illum-ir`. |
| `als31300` | "ALS31300 3-D Linear Hall Effect Driver" | Bound to 8-006c; registers input device `als31300` |
| `arcimx616` | "arcimx616 MIPI Camera Subdev Driver" | 0-0010 (`passthrough_right`) and 0-001a (`passthrough_left`) |
| `og01a1b` (`og01a1b-a`) | "og01a1b MIPI Camera Subdev Driver" | 4-0060 (`slam_left`) and 4-0036 (`slam_right`) |
| `og0ve10` (`og0ve10-a`) | "og0ve10 MIPI Camera Subdev Driver" | 5-0060 (`upper_left`) and 5-003e (`upper_right`) |

**The hot-swap driver.** The device tree has a `silego,northgate_hotswap` node, the driver describes itself as "Steam Frame Hotswap Driver", and `deckard_charge_daemon` references `/sys/class/power_supply/northgate-hotswap/` (`charge_from_int`, `enable_cross_charger`) and `/sys/class/power_supply/mp2652-charger/`. If the device at 7-0018 doesn't answer at probe time, the driver logs `pattern id read failed: -6`, and neither power supply appears under `/sys/class/power_supply/`.

The `qcom_camss` camera driver logs `camss_subdev_notifier_complete: apply combo mode hack to 'og0ve10 …'` for both `og0ve10` sensors at boot.

Several more I²C drivers are built in but have no device bound: `ov6211`, `ov6710`, `og0ve1b`, `lp855x`, `sy7758`, `sgm3804`, `tps65132`, `mp8859`, `max732x`, `pca953x`, `typec_fusb302`, `ucsi_ccg` and `mpq3367`.

No eye-tracking camera appears as an I²C or V4L2 device. The `eyetracking` process (`-b CDSP`) holds `/dev/spidev0.1`, the `/dev/input/event*` devices, the panel backlight and shared-memory buffers, but no `/dev/video*` node.

## Hardware map from the device tree

Non-Qualcomm compatibles found in `/proc/device-tree`, the driver bound to each (from `/sys/bus/*/drivers`), and the I²C address. Camera names come from `/sys/class/video4linux/v4l-subdev*/name` and `vrdevice_path camera_v4l_subdev`. The device tree defines no `i2cN` aliases (`/proc/device-tree/aliases`), so I²C bus numbers are enumeration order on this kernel.

| Device | Compatible | Driver | Where |
|---|---|---|---|
| Cameras `passthrough_right`, `passthrough_left` | `arcimx616` | `arcimx616` | I²C bus 0, 0x10 and 0x1a |
| Cameras `slam_left`, `slam_right` | `ovti,og01a1bx` | `og01a1b` | I²C bus 4, 0x60 and 0x36 |
| Cameras `upper_left`, `upper_right` | `ovti,og0ve10x` | `og0ve10` | I²C bus 5, 0x60 and 0x3e |
| Proximity sensor (IIO `in_proximity_raw`) | `vishay,vcnl4040` | `vcnl4000` | I²C bus 6, 0x60 |
| Battery fuel gauge | `maxim,max17320` | `max1720x` | I²C bus 7, 0x36 |
| Hot-swap controller | `silego,northgate_hotswap` | `northgate-hotswap` (binds only if the device answers) | I²C bus 7, 0x18 |
| EEPROMs | `atmel,24c04` / `24c32` / `24c64` | `at24` | I²C buses 7 and 9 |
| Fan controller | `silego,slg4ax46073v` | `slg4ax46073v-fan` | I²C bus 8, 0x08 |
| Hall sensor | `allegro,als31300` | `als31300` | I²C bus 8, 0x6c |
| LED drivers ×3 | `mps,mp3317` | `mp3317_led` | I²C bus 8 at 0x28 and 0x29; bus 9 at 0x29 |
| LCD bias ×2 | `nexperia,nex10000ub` | `nex10000ub` | I²C buses 8 and 9, 0x3e on each |
| Power monitors ×3 | `maxim,max34417` | `max34417` | I²C bus 9, 0x10, 0x12, 0x1a |
| I²C broadcaster | `i2c-sw-broadcaster` | `i2c-sw-broadcaster` | I²C bus 9, 0x2c |
| Speaker amplifiers ×2 | `maxim,max98390` | `max98390` | I²C bus 6, 0x38 and 0x3d |
| Backlight pre-boost | `ti,tps61377` | `tps61377_regulator` | not recorded |
| Display panel | `deckard-panel` | `deckard-panel` | DSI `ae94000.dsi.0` |
| FPGA | `valve,fpga` | `valve_fpga_pwr` | platform device `fpga` |
| Expansion 5 V | `regulator-valve_5v_exp` | `reg-valve_5v_exp` | platform |
| Crash log store | `ramoops` | pstore | reserved memory |

## Sysfs added by these drivers

| Path | Access | What it does |
|---|---|---|
| `/sys/bus/mipi-dsi/devices/ae94000.dsi.0/gamma_black_mode` | `video` group | Panel black-level gamma mode. `gamma_black_mode_max` gives the upper bound. The driver logs the per-panel factory gamma at boot. |
| `/sys/bus/platform/devices/fpga/valve/enable` | root | FPGA power enable |
| `/sys/bus/platform/drivers/reg-valve_5v_exp/exp_vout_5v/control/enable` | `steamos` | Expansion-port 5 V output |
| `/sys/class/hwmon/hwmon*/measurement_mode` (`max34417*`) | `perf` group | Power-monitor measurement mode |
| `/sys/class/hwmon/hwmon*/pwm1` (`slg4ax46073v`) | root | Fan duty cycle |

The `steamos` user is in an `fpga` group, but no file under `/dev`, `/sys/devices`, `/run`, `/etc` or `/usr` is owned by that group.

## Build options worth knowing

From `/proc/config.gz`:

| Option | Setting | Observed on the running system |
|---|---|---|
| `CONFIG_PREEMPT`, `CONFIG_HZ` | `y`, 1000 | `CONFIG_PREEMPT_RT` and `CONFIG_PREEMPT_DYNAMIC` are not set |
| `CONFIG_SCHED_CLASS_EXT` | `y` | `scx_lavd` is running ([services](services.md#boot-updates-and-filesystem)) |
| `CONFIG_BPF_SYSCALL`, `CONFIG_BPF_JIT`, `CONFIG_DEBUG_INFO_BTF`, `CONFIG_CGROUP_BPF` | `y` | `/sys/kernel/btf/vmlinux` exists |
| `CONFIG_KPROBES`, `CONFIG_UPROBES`, `CONFIG_FTRACE`, `CONFIG_DYNAMIC_FTRACE`, `CONFIG_PERF_EVENTS`, `CONFIG_KALLSYMS_ALL` | `y` | |
| `CONFIG_NTSYNC` | `y` | `/usr/lib/modules-load.d/ntsync.conf` is installed. `/dev/ntsync` is mode 666, and Proton's `wineserver` names it ([Running other software](compatibility.md#wine-and-ntsync)). |
| `CONFIG_KVM` | `y` | `dmesg`: `CPU: All CPU(s) started at EL2` and `kvm [1]: nv: … trap handlers`. `/dev/kvm` exists, mode 666 (`root:kvm`). None of Lepton's scripts mention it ([Running other software](compatibility.md#binder-and-kvm)). |
| `CONFIG_ANDROID_BINDER_IPC`, `CONFIG_ANDROID_BINDERFS` | `y` | `CONFIG_ANDROID_BINDER_DEVICES="anbox-binder,anbox-hwbinder,anbox-vndbinder"`. No binderfs is mounted and there are no `/dev/binder*` nodes. How binder works inside a Lepton container wasn't determined ([Running other software](compatibility.md#binder-and-kvm)). |
| `CONFIG_DRM_CLIENT_VRCONSOLE`, `CONFIG_DRM_CLIENT_DEFAULT` | `y`, `"vrconsole"` | Module metadata describes `drm_client_lib` as "DRM VR VT console". At boot: `Console: switching to colour vrconsole 80x24` ([graphics](graphics.md#the-vr-text-console-vrconsole)). |
| `CONFIG_USB_CONFIGFS_NCM`, `CONFIG_USB_CONFIGFS_F_FS` | `y` | Used by the `usb0` NCM and ADB FunctionFS gadget functions ([network](network-services.md#usb-networking-and-adb)) |
| `CONFIG_PSTORE_RAM` | `y` | See [Where to look](#where-to-look) |
| `CONFIG_MODULE_SIG`, `CONFIG_MODULE_SIG_ALL` / `CONFIG_MODULE_SIG_FORCE` | `y` / not set | `CONFIG_SECURITY_LOADPIN` is not set |
| `CONFIG_SECURITY_LOCKDOWN_LSM`, `CONFIG_LOCK_DOWN_KERNEL_FORCE_NONE` | `y` | `/sys/kernel/security/lockdown` shows `[none] integrity confidentiality` |
| `CONFIG_DEVMEM` / `CONFIG_STRICT_DEVMEM` | `y` / not set | |
| `CONFIG_SECURITY_APPARMOR`, `CONFIG_LSM` | `y`, `"landlock,lockdown,yama,loadpin,safesetid,integrity,bpf"` | Active list in `/sys/kernel/security/lsm`: `lockdown,capability,landlock,yama,bpf` |

## Kernel command line

The command line comes from a format string in U-Boot proper. The full line, where each parameter comes from and what uses it on the headset are listed in one place: [Boot → Kernel command line](boot.md#kernel-command-line). It has no `root=`. The initramfs sets the root device itself, from the partset files on the partition that `steamos.efi=` names.

## Boot-time quirks

- The tracking-camera drivers (`og01a1b`, `og0ve10`) log `…_set_power_on: failed to enable power` and `Failed to get chip ID for <camera>` at boot. Despite that, all four stay bound (`/sys/bus/i2c/drivers/og01a1b`, `og0ve10`), and their `v4l-subdev` nodes exist.
- `steamos-dump-info.service` writes OS, partition, boot-config and battery info into the kernel log at every boot, including the headset's serial numbers from the EEPROM. Since `dmesg` is readable by any local user, so are those. Don't paste raw `dmesg` output publicly. See [security notes](security-notes.md).

## Controllers and `hid-steam`

`hid_steam` is built in (modinfo description "HID driver for Valve Steam Controller"). Its modinfo aliases cover USB product IDs `28de:1102`, `28de:1142` and `28de:1205`. No `/dev/hidraw*` nodes exist, and the Frame controllers are handled by SteamVR over SPI instead ([controllers](controllers.md)).

## Source availability

Checked on 2026-11-21, with the headset on SteamOS 0.4.5 (stable), not the 0.5.9 beta the rest of this page describes. Installed-package details are from 0.4.5 ([Methodology](methodology.md#source-availability-check)).

- **The 0.5.9 beta kernel has a source package.** `linux-72-deckard 7.2.0+g344f27110f05`, the build this page describes, is in Valve's [source directory](https://holo-packages.steamos.cloud/archlinux-deckard-hotfixes/source/).
- **The 0.4.5 stable kernel isn't listed under its own version.** No source package is named for `linux-618-deckard 6.18.0+ge66bc2ca6f8c`. The two kernel packages sampled carry a git mirror of Valve's kernel repository. Whether any listed package's mirror contains that commit wasn't determined. A third-party mirror, not Valve's, does ([below](#third-party-mirrors)).
- **Mainline Linux has a device tree for the Frame** since v7.4-rc1, but none of the Valve-written drivers above ([In mainline Linux](#in-mainline-linux)).

- **Valve's source directory.** [`holo-packages.steamos.cloud/archlinux-deckard-hotfixes/source/`](https://holo-packages.steamos.cloud/archlinux-deckard-hotfixes/source/) is an anonymously readable directory of Arch source packages (`.src.tar.gz`). Valve's public [`deckard-pacman-src`](https://gitlab.steamos.cloud/frame-public/frame-developer-tools/-/blob/main/pacman/deckard-pacman-src) script (in frame-developer-tools) names the `archlinux-deckard-hotfixes` repository on this server, and `source/` is a subdirectory of it.
  - The directory lists 24 `linux-72-deckard` and 12 `linux-618-deckard` source packages. Other packages built from the same commits (`-hwdebug`, `v4l2loopback`, `linux-api-headers`, `linux-tools`) aren't counted.
  - `linux-72-deckard-7.2.0+g344f27110f05-1` is 2.5 GiB. Only its first 4 MB was read. That part contains a `.SRCINFO`, a PKGBUILD (`license=(GPL-2.0-only)`) and a bare git mirror (`+refs/*:refs/*`) of `deckard/deckardos/linux-valve-publicly-released-branches`.
  - The first 256 KB of a second package, `linux-618-deckard-6.18.0+g733a4be78129-4`, shows the same kind of mirror.
- **Installed package metadata.** `pacman -Qi linux-618-deckard` gives the URL `https://gitlab.steamos.cloud/deckard/deckardos/linux-valve/-/tree/e66bc2ca6f8ca6baa5260c69c9b79dc01a6238b9` and the license field `GPL-2.0-only`, `no-source-release`. Its file list (`pacman -Ql`) has no license or `COPYING` file.
- **Valve's GitLab.** Anonymous API requests for `deckard/deckardos/linux-valve`, `deckard/deckardos/linux-valve-publicly-released-branches` and every PKGBUILD repository that `deckard-pacman-src` can print return `404 Project Not Found`. GitLab returns that for private and missing projects alike.
  - None of the 46 public projects is a kernel tree, judged by name and description.
  - The Frame-related public projects are the Frame's [CAD and electrical references](https://gitlab.steamos.cloud/SteamHardware/SteamFrame) and the [`frame-public`](https://gitlab.steamos.cloud/frame-public) group (Lepton, Waydroid forks, Android Vulkan headers, frame-developer-tools).
  - Separately, [`holo/holo-core-aarch64-preview`](https://gitlab.steamos.cloud/holo/holo-core-aarch64-preview) is an Arch Linux aarch64 port. Its only kernel is Arch's `linux` 6.17.8.arch1 package, built from the kernel.org tarball plus Arch's patch.
- **Steam Deck source mirror.** [`steamdeck-packages.steamos.cloud/archlinux-mirror/sources/`](https://steamdeck-packages.steamos.cloud/archlinux-mirror/sources/) has 30 directories, all `holo-*` or `jupiter-*`. The `jupiter-*` directories hold the Steam Deck's kernels (`linux-neptune-*`). No listing mentions `deckard`.
- <a id="third-party-mirrors"></a>**Third-party mirrors.** On GitHub, evlaV publishes [evlaV/deckard](https://github.com/evlaV/deckard), which its README says is generated from Valve's source directory, and [evlaV/deckard-linux](https://github.com/evlaV/deckard-linux). These aren't Valve's and weren't reviewed. The only check made was that `deckard-linux` contains commit `e66bc2ca6f8c`, the 0.4.5 kernel. A U-Boot mirror is on [Boot → Source availability](boot.md#source-availability).

### In mainline Linux

**Tag: Public (upstream).** As of `torvalds/linux` master `c44104f3642d` (2026-11-21):

- **The board is described.** Two commits from Linaro, authored 2026-09-23, first appear in v7.4-rc1:
  - [`abbbaa99ac66`](https://git.kernel.org/torvalds/c/abbbaa99ac66) adds the compatible `valve,deckard` to `Documentation/devicetree/bindings/arm/qcom.yaml`.
  - [`f905cb6e600a`](https://git.kernel.org/torvalds/c/f905cb6e600a) adds `arch/arm64/boot/dts/qcom/sm8650-valve-deckard.dts` (model `Valve Deckard`, copyright Valve). Its commit message lists "initial support" for reserved memory, regulators, GPIO keys, PMIC functions and ADC channels, UFS, USB gadget, WCN7850 Wi-Fi and Bluetooth, I²C and the SD card slot. Its Link tag points to [patch 2 of the v2 series](https://lore.kernel.org/r/20260923-topic-sm8650-deckard-initial-dt-v2-2-8361c4548efa@linaro.org).
- **The headset doesn't boot that device tree.** Its top-level compatible is `qcom,sm8650-dv1`, `qcom,sm8650`, not `valve,deckard`.
- **The Valve-written drivers aren't there.** Of the source paths in the [Valve-written drivers](#valve-written-drivers) table, only `nex10000ub-regulator` has a mainline file of the same name, and that file is a different driver (see the table below).
- **Commit search.** GitHub commit search of mainline for `deckard` and `Steam Frame` finds only the two commits above, the merges that carry them, and a 2025 `drm/msm/dpu` commit whose patch link (a Linaro message ID) contains `hmd-deckard`.
- **Mailing lists.** Whether Valve has posted any of its own drivers to a kernel mailing list wasn't determined. The archives couldn't be searched ([Methodology](methodology.md#source-availability-check)).

Of the chips in [Valve-written drivers](#valve-written-drivers) and [Other Frame-specific drivers](#other-frame-specific-drivers-in-the-tree), four have a mainline driver, but not the one the headset runs. The path, compatible or supported chips differ:

| Chip | On the Frame (0.4.5, kernel 6.18.0) | In mainline |
|---|---|---|
| Nexperia NEX10000UB | `drivers/regulator/nex10000ub-regulator`, `author=Valve`, compatibles `nexperia,nex10000ub`, `nexperia,nex10000aub` | `drivers/regulator/nex10000ub-regulator.c` ("NEX10000UB regulator driver"), compatible `nexperia,nex10000ub`, from Linaro, first in v7.4-rc1 |
| Allegro ALS31300 | `drivers/input/misc/als31300` (input device), compatible `allegro,als31300` | `drivers/iio/magnetometer/als31300.c` (IIO), compatibles `allegromicro,als31300-*`, from Linaro (2024). Same module description. The mainline Deckard device tree uses it (`allegromicro,als31300-500`). |
| Maxim fuel gauge (the Frame's is a [MAX17320](#other-frame-specific-drivers-in-the-tree)) | `max1720x_battery`, crediting Maxim: "MAX17201/5, MAX17300/1/2/3, MAX17320 and MAX17330/2/5" | `drivers/power/supply/max1720x_battery.c`: same module name, "MAX17201/MAX17205" only (compatible `maxim,max17201`) |
| OmniVision OG01A1B | `drivers/media/i2c/og01a1b-a` ("og01a1b MIPI Camera Subdev Driver"), compatible `ovti,og01a1bx` | `drivers/media/i2c/og01a1b.c` ("OmniVision OG01A1B sensor driver"), compatible `ovti,og01a1b` |

## Interpretation

*This section is interpretation, not observation. It combines the facts above with general knowledge and may be wrong.*

**Compared with SteamOS on the Steam Deck.** Most of the userspace is the same SteamOS: atomupd driving RAUC, SteamOS Manager (whose device files include the Steam Deck), the devkit pairing service, `steamos-bootconf`, partsets, mkinitcpio, gamescope and the `scx_lavd` scheduler. Leftovers point the same way: `jupiter-*` polkit actions for programs that aren't installed, Steam started with `-steamdeck`, and a `steamos-bootconf` comment contrasting the Deck's boot counting with this one.

The differences sit below the OS image. The Frame is aarch64 (RAUC `compatible=steamos-aarch64`) on a Qualcomm SoC described by a device tree, with no DMI tables or UEFI at runtime. On the Deck, from outside knowledge, UEFI firmware runs `steamcl.efi`, which reads per-slot bootconf files on the ESP. Here U-Boot boots the kernel directly, and a wrapper maps `steamos-bootconf` onto `splctl` ([boot](boot.md#u-boot-environment-and-slot-state)). Bootloader and firmware updates go through `kernelsetup.sh`, and `jupiter-biosupdate` is a stub. The kernel is Valve's own tree with headset-specific drivers.

**EL2 and KVM.** "All CPU(s) started at EL2" means Linux holds the CPU's hypervisor level itself, instead of running under a vendor hypervisor as many Qualcomm phones do. With `/dev/kvm` at mode 666, any local user can run hardware-accelerated virtual machines.

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
