# Before you poke around

This page gathers the safety notes spread across the other pages: what to back up, what not to run, what changes state even though it looks harmless, what's known about recovery, and what to keep out of public posts. Each item links to the page it comes from.

## Back up first

The headset's EEPROM sysfs files are mode 666, so any local program can write them ([security notes](security-notes.md#local-any-process-running-on-the-headset)). They hold the unit's calibration copies, serial numbers and MAC addresses ([hardware → EEPROM](hardware.md#eeprom)). Back up both the calibration data and the raw EEPROMs, and copy the files somewhere off the headset:

```sh
# Valve's own tool; its usage line is: restore-calibration backup [persist-YYYYMMDD.tar.zst]
/usr/lib/deckard-hw-support/restore-calibration backup

# Raw EEPROM contents (these files are readable by any user)
for e in /sys/bus/i2c/devices/{7-0050,7-0051,9-0050}/eeprom; do
  cat "$e" > ~/eeprom-$(basename "$(dirname "$e")").bin
done
/usr/lib/deckard-eeprom/eeprom_console print_all > ~/eeprom-backup.txt
```

- `restore-calibration backup` re-runs itself through `pkexec` (its action has `implicit any: yes`). Without an argument, it writes `/home/steamos/persist_backup-<unix time>.tar.zst`.
- Its `verify` subcommand compares `/persist` with the calibration copies stored in the EEPROM ([permissions](permissions.md#polkit-what-runs-as-root-without-a-password)).
- `eeprom_console print_all` is the backup command the [hardware page](hardware.md#eeprom) gives, alongside the read commands `help` and `get`. It wasn't run for these notes ([methodology](methodology.md)).
- All of these files contain per-unit identifiers. Keep them private.

## Commands not to run

Don't run Valve's daemons by hand, and don't pass `--help` to a Valve binary unless you know it supports it; use `strings` to look inside instead ([methodology](methodology.md#incident-running-unknown-binaries-with---help)). Three tools didn't treat `--help` as a help flag:

| Command | What happened or what it does | Source |
|---|---|---|
| `ledcontrol` | Ignored `--help` and started a second copy of the LED daemon, which changed the status LED's pattern until it was killed. `sudo systemctl restart deckard-led-control` puts the LED back under the real daemon. | [Methodology](methodology.md#incident-running-unknown-binaries-with---help), [hardware → status LED](hardware.md#status-led) |
| `pidbridge` | Treated `--help` as a socket path, then exited without leaving a file | [Methodology](methodology.md#incident-running-unknown-binaries-with---help) |
| `splctl` | Printed nothing and exited 0 on `--help`. It has `set-*` subcommands that write the U-Boot environment. | [Boot → `splctl`](boot.md#splctl) |
| `eeprom_console reset`, `lock`, `unlock`, `upgrade` | Act on the `bootloader`, `core`, `vrcal` and `strap` EEPROM sections, per `eeprom_console help`. Don't run them without a backup, and never as root unless you know what they'll do. | [Hardware → EEPROM](hardware.md#eeprom), [methodology](methodology.md#incident-running-unknown-binaries-with---help) |
| `PrepareFactoryReset` (SteamOS Manager D-Bus method) | Marked destructive: `kind` 1 = user data, 2 = OS, 3 = both | [D-Bus → `FactoryReset1`](dbus.md#factoryreset1-updatebios1) |
| `blockdev --setrw` on `/dev/sdb*`, `/dev/sdc*`, `/dev/sdd*` | Undoes the read-only flag the initramfs sets on LUNs 1–3. The hook's comment says that flag "prevents accidental `sudo dd if=/dev/zero of=/dev/sdd` from wiping out your device configuration or bootloader". | [Boot → read-only LUNs](boot.md#read-only-luns) |

Each page's How to inspect section lists commands to avoid:

- [Boot → How to inspect this yourself](boot.md#how-to-inspect-this-yourself) (the table at the end of that section): `splctl`, `steamos-bootconf`, `steamos-readonly`, `steamos-verity`, `fw_setenv`, `kernelsetup.sh`, `steamos-finalize-install`, `steamos-boot-install`, `steamos-partsets` and `steamos-factory-reset*`.
- [Firmware → How to inspect this yourself](firmware.md#how-to-inspect-this-yourself) (the paragraph after the commands): `fpga_load.sh`, `littlebee_config`, `program_ble.sh`, `openocd`, `cdsp_setpath`, `update_pack_nvm.py`, `kernelsetup.sh`, `splctl` and `dsp_service`.
- [OpenXR → How to inspect this yourself](openxr.md#how-to-inspect-this-yourself): `helloxr`, `hellovr_sdl`, `trackingtest`, `vrprismhost` and `XRService`.
- [Graphics → How to inspect this yourself](graphics.md#how-to-inspect-this-yourself): `modetest`, `kmscube` or anything else that takes DRM master or sets a mode while SteamVR is running. What reading the debugfs `rd`, `hangrd`, `gpu` and `perf_now` files, the `DSI-1/panel/*` files and `debug/cac_*` does wasn't checked.
- [Audio → How to inspect this yourself](audio.md#how-to-inspect-this-yourself): `pw-play`, `pw-record`, `wpctl set-*`, `amixer sset` and `steamvr dspaec`.
- [Power → How to inspect this yourself](power.md#how-to-inspect-this-yourself): `systemctl suspend`, `echo mem > /sys/power/state`, `fanspeed -s` and `steamosctl set-*`.
- [Wi-Fi, Bluetooth and streaming → How to inspect this yourself](wireless.md#how-to-inspect-this-yourself): `iw scan`, `iw … set`, `nmcli … connect`/`modify`, `bluetoothctl scan|pair|connect|power|discoverable`, `softapcmd create|teardown|refresh` and `vrlink`.
- [Running other software → How to inspect this yourself](compatibility.md#how-to-inspect-this-yourself): `lepton`, `FEXBash`, `fex-compat-tool` and `proton`.
- [Developer workflow → How to inspect this yourself](developer-workflow.md#how-to-inspect-this-yourself): `steamos-devmode` and `steamos-readonly`, even with `status`. That page also says to restart the VR session with `steamvr restart`, not by stopping `steam.service` directly ([developer workflow → running your own Steam client](developer-workflow.md#running-your-own-steam-client)).

## Things that change state when they look read-only

- **`steamos-readonly`** runs `mount -o remount,rw /` before it reads its arguments, even for `status`. `steamos-verity` calls `steamos-readonly`. To check the read-only flag, use `btrfs property get / ro` instead ([boot](boot.md#root-filesystem-read-only-flag-and-dm-verity)).
- **`steamos-devmode status`** calls `steamos-readonly status`, so it remounts `/` read-write too ([developer workflow → package management](developer-workflow.md#package-management)).
- **`steamos-bootconf`** (the wrapper in `/usr/bin`) passes every call to the real binary first, and its `set-mode` and `config --set` call `splctl set-*` ([boot](boot.md#steamos-bootconf-wrapper)).
- **Reading a RAUC D-Bus property** when RAUC isn't running starts `rauc.service`, which runs `steamos-bootconf this-image`. Guard the read with `systemctl is-active --quiet rauc` ([boot](boot.md#how-to-inspect-this-yourself)). More generally, a D-Bus-activated unit starts when something calls its bus name ([services](services.md)).
- **Any `lepton` command, including `help`,** checks for a `catatonit` process before it reads its verb. If there isn't one and the user's systemd instance is running, it runs `podman system migrate` and starts (or restarts) the user's `podman.service`. It then opens `/tmp/lepton.lock`. Read the script with `cat` instead ([Running other software → Lepton verbs](compatibility.md#verbs)).
- **`--help` on an unknown binary** can start a daemon (`ledcontrol`) or do something silently (`splctl` printed nothing and exited 0) ([methodology](methodology.md#incident-running-unknown-binaries-with---help)).
- **`podman images`, `podman ps` and the like** can create user storage, so they weren't run ([Running other software → How to inspect](compatibility.md#how-to-inspect-this-yourself)).
- **The debugfs `rd` and `hangrd` files** under `/sys/kernel/debug/dri/0/` are world-readable, but they weren't read, and what reading them does wasn't checked ([graphics → debugfs files](graphics.md#debugfs-files)).
- **`file`** was killed by its own seccomp filter ("Bad system call") while identifying a firmware file and dumped core, which can leave a `systemd-coredump` entry in the journal ([methodology](methodology.md#incident-running-unknown-binaries-with---help)).

## Recovery

**Tag: Internal.** No recovery path was exercised for these notes. What follows is what the files and strings state.

**Boot menu.** U-Boot proper contains a `Deckard Boot Menu` with these entries and command strings ([boot](boot.md#boot-intentions-boot-menu-and-reboot-reasons)):

| Entry | Command string |
|---|---|
| `Current …` | `setenv slottarget current` |
| `Previous …` | `setenv slottarget previous` |
| `Boot from USB` | `setenv slottarget usb` |
| `Repair Steam Installation` | `setenv slottarget current && setenv steamreset 1` |
| `Erase User Data` | `setenv slottarget current && setenv factoryreset 1` |
| `ADB mode` / `ADB mode [enabled]` | `setenv adb-mode 1` / `setenv adb-mode 0` |
| `Battery Ship Mode` | `setenv shipmode 1` |

U-Boot also contains the string `Select button pressed. Boot intention: boot menu`. The button combination that opens the menu: not determined.

**Repair Steam Installation.** The boot page lists the menu's `steamreset` as the source of the `u-boot,steamreset` device-tree flag. That flag makes `steamvr_first_init.sh` run `steam-health-check --repair-now` and delete `~/.config/openvr` and the OpenXR `active_runtime.json` ([boot → device-tree flags](boot.md#device-tree-flags-from-the-bootloader)).

**Factory reset.** When the initramfs `factory_reset` hook finds a `.cfg` file under `efi/steamos/factory-reset/` on the `esp` partition, it formats `var-A`, `var-B` and `home`, zeroes `ubootenv_a` and `ubootenv_b`, removes `/esp/efi/steamos` and reboots. `steamos-factory-reset-config` writes those `.cfg` files, and U-Boot contains `factory reset: creating file in /efi/steamos/factory-reset/factoryreset.cfg`. Which partition U-Boot's path refers to: not determined ([boot → factory reset](boot.md#factory-reset)).

**Initramfs recovery shell.** When `launch_interactive_shell` runs (for example, from the late `initrd_shell` hook when `gotoinitrd=yes`), it starts `adbd` when a USB-C partner connects and opens shells on `tty1` and the first console. Unless `break` or `gotoinitrd` is set, or `autoreboot` isn't `yes`, it counts down 20 seconds and reboots; an adb shell, or Enter on a USB keyboard or serial console, stops the countdown ([boot → recovery shell](boot.md#recovery-shell)). How to set `gotoinitrd=yes` from the headset, and what `reboot initrd` does: not determined.

**Calibration.** `restore-calibration restore-from-eeprom [--force]` restores the `/persist` calibration files from the copies in the EEPROM ([hardware → EEPROM](hardware.md#eeprom)). It wasn't run.

**Not determined:** what `Boot from USB`, the `Fastboot` and `EDL (emergency download)` boot intentions, and `dead_battery_recovery.bin` do beyond their strings; how U-Boot behaves when a slot runs out of boot attempts or is marked bad ([boot → not determined](boot.md#not-determined), [firmware → not determined](firmware.md#not-determined)).

## Keep these private

These contain credentials, serial numbers, calibration or other per-device details. Don't paste them publicly without redacting them:

| Source | What's in it | Page |
|---|---|---|
| `dmesg` | Serial numbers of the unit, main board, head strap and several components (`steamos-dump-info`); the Wi-Fi MAC address (ath12k probe); the panels' factory gamma values | [Security notes](security-notes.md#local-any-process-running-on-the-headset), [firmware](firmware.md#runtime-versions-where-to-read-them), [graphics](graphics.md#panel-and-backlight) |
| `softapcmd state` / `status` | The hotspot's SSID and password | [Local IPC](local-ipc.md#control-socket) |
| `eeprom_console print_all`, raw EEPROM copies, `restore-calibration` backups | Serial numbers, MAC addresses, calibration | [Hardware → EEPROM](hardware.md#eeprom) |
| `vrconfig_serial` | The unit serial | [Hardware → EEPROM](hardware.md#eeprom) |
| `devkit-1-identify` | Hostname, machine ID, DMI fields | [Network services](network-services.md#devkit-pairing-service-port-32000) |
| The log submitter's `UnitId` | A per-device ID | [D-Bus](dbus.md#log-submitter-comsteampoweredsteamoslogsubmitter) |
| `/proc/device-tree/board-info/` | Board, strap and component serials | [Boot](boot.md#device-tree-flags-from-the-bootloader) |
| `/proc/cmdline`, `/proc/device-tree/chosen/bootargs` | PARTUUIDs | [Boot](boot.md#how-to-inspect-this-yourself) |
| `iw reg get` | Your regulatory country | [Wi-Fi, Bluetooth and streaming](wireless.md#regulatory-handling) |
| `iw dev` | MAC addresses and network names | [Wi-Fi, Bluetooth and streaming](wireless.md#how-to-inspect-this-yourself) |
| `bluetoothctl show`, `bluetoothctl list` | The Bluetooth controller's address and the host name | [Wi-Fi, Bluetooth and streaming](wireless.md#bluetooth-controller) |
| `/var/run/softap_hostapd.conf`, `/var/run/softap_dnsmasq.conf`, `/etc/NetworkManager/system-connections/` | Network names and passwords | [Wi-Fi, Bluetooth and streaming](wireless.md#how-to-inspect-this-yourself) |
| `journalctl -u deckard-audio-setup` | Per-unit speaker calibration values | [Audio](audio.md#how-to-inspect-this-yourself) |
| SteamVR logs in `~/.local/share/Steam/logs` (such as `vrserver.txt`, `xrclient_*.txt` and `lepton-steamlaunch-*.log`); directory and file names under `~/.config/openvr/config/cv/` and `~/.config/openvr/config/roy/` | Serial numbers of the headset and other tracked devices; the logs also name app IDs and package names | [OpenXR](openxr.md#how-to-inspect-this-yourself) |
| Values in `/persist/*.json` (`device_config.json`, `xrservice.json`, `eyetracking.json`) | Per-unit calibration and serials; the docs read key names only | [OpenXR](openxr.md#display-refresh-rate-and-timing), [Security notes](security-notes.md#local-any-process-running-on-the-headset) |
| `~/.config/openvr/config/chaperone_info.vrchap` and `~/.config/openvr/config/cv/xrservice/serializedmap/` | Play area and collision bounds; saved `persistent_world_<id>.pb` files. The docs list names only. | [OpenXR → tracking](openxr.md#tracking-pipeline-and-spaces) |
| `coredumpctl list` | Program names and PIDs | [Developer workflow](developer-workflow.md#how-to-inspect-this-yourself) |
| `/proc/<pid>/environ` values | Can include per-session tokens; share variable names, not values | [Developer workflow](developer-workflow.md#how-to-inspect-this-yourself) |
| `pw-dump` | Per-node serials and object IDs | [Audio](audio.md#how-to-inspect-this-yourself) |
| `/sys/module/cfg80211/parameters/ieee80211_regdom` | A two-letter country code | [Wi-Fi, Bluetooth and streaming](wireless.md#regulatory-handling) |
| Listings of `~/.local/share/Steam/steamapps/common`, and the `appmanifest_<id>.acf` files | The owner's installed games and their app IDs | [Running other software](compatibility.md#how-to-inspect-this-yourself) |

When you report something, strip serial numbers, MAC addresses, machine IDs and Wi-Fi credentials ([README](../README.md#contributing)). For the command line, [boot](boot.md#how-to-inspect-this-yourself) uses:

```sh
sed -E 's/PARTUUID=[^ ]+/PARTUUID=<redacted>/' /proc/cmdline
```

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
