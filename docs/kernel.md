# The kernel

The Frame runs Linux 7.2 from Valve's own tree, packaged as `linux-72-deckard`. The package metadata points to `gitlab.steamos.cloud/deckard/deckardos/linux-valve`. Whether that repository is publicly reachable wasn't checked. This page covers what's visible from the running system: the build config, the drivers Valve added, how the hardware is described in the device tree, and the sysfs knobs those drivers expose.

Everything here is **Internal**. Driver names, sysfs attributes and device-tree layout can change with any kernel update.

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

## Interpretation

*This section is interpretation, not observation. It combines the facts above with general knowledge and may be wrong.*

**Compared with SteamOS on the Steam Deck.** Most of the userspace is the same SteamOS: atomupd driving RAUC, SteamOS Manager (whose device files include the Steam Deck), the devkit pairing service, `steamos-bootconf`, partsets, mkinitcpio, gamescope and the `scx_lavd` scheduler. Leftovers point the same way: `jupiter-*` polkit actions for programs that aren't installed, Steam started with `-steamdeck`, and a `steamos-bootconf` comment contrasting the Deck's boot counting with this one.

The differences sit below the OS image. The Frame is aarch64 (RAUC `compatible=steamos-aarch64`) on a Qualcomm SoC described by a device tree, with no DMI tables or UEFI at runtime. On the Deck, from outside knowledge, UEFI firmware runs `steamcl.efi`, which reads per-slot bootconf files on the ESP. Here U-Boot boots the kernel directly, and a wrapper maps `steamos-bootconf` onto `splctl` ([boot](boot.md#u-boot-environment-and-slot-state)). Bootloader and firmware updates go through `kernelsetup.sh`, and `jupiter-biosupdate` is a stub. The kernel is Valve's own tree with headset-specific drivers.

**EL2 and KVM.** "All CPU(s) started at EL2" means Linux holds the CPU's hypervisor level itself, instead of running under a vendor hypervisor as many Qualcomm phones do. With `/dev/kvm` at mode 666, any local user can run hardware-accelerated virtual machines.

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
