# Permissions and privileged helpers

## The `steamos` user

**Tag: Internal.** The default account is `steamos` (uid 1000). `sudo` works, but it asks for the account password; passwordless `sudo` isn't enabled. If you've never set a password, set one with `passwd` first.

Group memberships that matter for development:

| Group | Grants |
|---|---|
| `wheel` | `sudo` (with password); some udisks and `systemd-resolved` actions without one |
| `video`, `render` | GPU, V4L2 cameras, backlight, DSI panel attributes |
| `input` | `/dev/input/*`, `hidraw`, `uinput`, USB devices |
| `leds` | Write to every `/sys/class/leds/*` |
| `cdsp` | `/dev/cdsp` (mode 760, group `cdsp`) |
| `spidev` | SPI devices, including the FPGA |
| `gpiod` | GPIO chips |
| `perf` | Power-monitor measurement mode, perf/tracefs |
| `fpga` | No file owned by this group was found under `/dev`, `/sys/devices`, `/run`, `/etc` or `/usr` |
| `audio` | Sound devices |

## Developer mode

**Tag: Internal.** Developer mode is switched by `/usr/bin/steamos-polkit-helpers/steamos-devkit-mode --enable|--disable`. Steam's `steamui.so` references this helper. Enabling it:

- enables and starts `sshd`, `xrdp`, `steamos-devkit-service`, `steam-web-debug-portforward` and `steamvr-web-debug-portforward`
- writes `MaxUse=3000M` to `/etc/systemd/coredump.conf.d/steamos-devkit-coredumps-enabled.conf` ([developer workflow → coredumps](developer-workflow.md#coredumps))
- creates `/etc/systemd/system/adbd.service.d/steamos-devkit-enabled`, which lets ADB and USB NCM start
- creates the marker file `/etc/steamos-devkit-enabled`

Disabling it reverses all of that.

## Polkit: what runs as root without a password

**Tag: Internal.** `/usr/share/polkit-1/actions/org.valve.steamos*.policy` allowlists 30 programs for `pkexec`, and 22 of them exist on the Frame. `pkaction --verbose` shows `implicit any: yes`, `implicit inactive: yes` and `implicit active: yes` for all 30 actions. Polkit therefore authorizes them for any process, in any session, without a password. `pkcheck` run from an SSH session (`loginctl` reports `Remote=yes`) returned "authorized" for these actions.

Paths starting with `steamos-polkit-helpers/` are under `/usr/bin/`.

| Helper | What it runs (read from the script) |
|---|---|
| `/usr/bin/steamvr` | The [SteamVR control script](steamvr.md#the-steamvr-command) |
| `/usr/bin/steamos-session-select` | `steamosctl set-default-login-mode …` / `set-default-desktop-session …`, then switches session |
| `steamos-polkit-helpers/steamos-devkit-mode` | Enables or disables the developer-mode units ([below](#developer-mode)) |
| `steamos-polkit-helpers/steamos-enable-sshd` | `systemctl enable --now sshd`, unless it's already enabled |
| `steamos-polkit-helpers/steamos-priv-write` | Writes a value to an allowlisted sysfs file ([below](#steamos-priv-write)) |
| `steamos-polkit-helpers/steamos-update` | `/usr/bin/steamos-update "$@"` |
| `steamos-polkit-helpers/steamos-select-branch` | `/usr/bin/steamos-select-branch "$@"` |
| `steamos-polkit-helpers/steamos-format-device` | `/usr/lib/hwsupport/format-device.sh "$@"` |
| `steamos-polkit-helpers/steamos-format-sdcard` | `/usr/lib/hwsupport/format-sdcard.sh "$@"` |
| `steamos-polkit-helpers/steamos-trim-devices` | `/usr/lib/hwsupport/trim-devices.sh "$@"` |
| `steamos-polkit-helpers/steamos-factory-reset-config` | `/usr/bin/steamos-factory-reset-config "$@"` |
| `steamos-polkit-helpers/steamos-reboot-now` | `reboot` |
| `steamos-polkit-helpers/steamos-poweroff-now` | `poweroff` |
| `steamos-polkit-helpers/steamos-reboot-other` | `/usr/bin/steamos-reboot --reboot-other`. That program **doesn't exist** on the Frame. |
| `steamos-polkit-helpers/steamos-restart-sddm` | `systemctl restart sddm` |
| `steamos-polkit-helpers/steamos-set-hostname` | `hostnamectl set-hostname "$1"` |
| `steamos-polkit-helpers/steamos-set-timezone` | `timedatectl set-timezone "$1"` |
| `steamos-polkit-helpers/steamos-disable-wireless-power-management` | `iwconfig wlan0 power off` |
| `steamos-polkit-helpers/steamos-systemreport-privileged` | Runs diagnostic commands as root and prints their output (`lsblk`, `parted --list`, the `/efi/steamos/partsets/*` files, and more) |
| `steamos-polkit-helpers/jupiter-biosupdate` | A stub that exits 0 |
| `/usr/lib/deckard-hw-support/restore-calibration` | `verify`, `backup [file]`, or `restore-from-eeprom [--force]`: compares or restores the `/persist` calibration files against the copies in the EEPROM ([hardware](hardware.md#eeprom)) |
| `/usr/bin/steamos-prepare-oobe-test` | Downloads the latest OOBE test image URL from `steamdeck-images.steamos.cloud` and installs it on the other slot with `atomupd-manager custom-update` |

Eight more actions in the same policy files point at programs that **don't exist** on the Frame: `/usr/bin/jupiter-initial-firmware-update`; `jupiter-amp-control`, `jupiter-check-support`, `jupiter-dock-updater`, `jupiter-fan-control` and `jupiter-get-als-gain` in `steamos-polkit-helpers/`; `steamos-polkit-helpers/steamos-retrigger-automounts`; and `/opt/steamvr/tools/vrlink/bin/linuxarm64/stream_mode.sh`.

`steamui.so` references `steamos-devkit-mode`. Where SteamOS Manager has a D-Bus method for the same job (session switching, trim, format, factory reset), that interface is versioned and documented in its XML.

### `steamos-priv-write`

```sh
/usr/bin/steamos-polkit-helpers/steamos-priv-write <path> <value>
```

It re-runs itself through `pkexec` if you aren't root, so you don't need to call `pkexec` yourself. It writes `<value>` to `<path>` as root, but only if the path matches one of these patterns. Anything else is refused and logged to the journal as `p-steamos-priv-write`.

```
/sys/class/backlight/*/brightness
/dev/drm_dp_aux0
/sys/class/drm/card*/device/power_dpm_force_performance_level
/sys/class/drm/card*/device/pp_od_clk_voltage
/sys/class/hwmon/hwmon*/power*_cap
/sys/devices/platform/*/*/*/iio:device*/in_illuminance_integration_time
/sys/devices/*/*/*/*/hwmon/hwmon*/led_brightness
/sys/devices/*/*/*/*/hwmon/hwmon*/content_adaptive_brightness
/sys/devices/platform/*/i2c-2/i2c-*/brightness
/sys/devices/platform/*/i2c-2/i2c-*/bmode
/sys/class/leds/status:white/led_brightness_multiplier
```

Of those patterns, only `/sys/class/backlight/*/brightness` matches anything on the Frame (`/sys/class/backlight/ae94000.dsi.0/brightness`), and the `video` group can already write that file directly.

### OS updates

**Tag: Internal.** Two separate routes into OS updates exist on the headset, and their polkit defaults differ.

| Route | What it runs | Polkit default (`pkaction --verbose`, rules files) | `pkcheck` from SSH |
|---|---|---|---|
| atomupd D-Bus methods on `com.steampowered.Atomupd1` ([D-Bus → Atomupd1](dbus.md#os-updates-comsteampoweredatomupd1)) | `atomupd-daemon` methods such as `StartUpdate`, `SwitchToBranch`, `StartCustomUpdate` and `EnableDevKeys` | Five actions: `yes` for an active session, `auth_admin` otherwise. Six (switching branch or variant, custom updates, downgrades, proxy changes, trusted keys): `auth_admin_keep` for an active session. `com.steampowered.Atomupd1.rules` grants those six to `steamos` when `subject.active` and `subject.local` are both true. | "not authorized" for `start-upgrade` and `switch-variant-or-branch` |
| `pkexec` helper `steamos-polkit-helpers/steamos-update` | `/usr/bin/steamos-update "$@"` | `implicit any: yes`, `implicit inactive: yes`, `implicit active: yes` ([above](#polkit-what-runs-as-root-without-a-password)) | "authorized" |
| `pkexec` helper `steamos-polkit-helpers/steamos-select-branch` | `/usr/bin/steamos-select-branch "$@"` | `implicit any: yes`, `implicit inactive: yes`, `implicit active: yes` ([above](#polkit-what-runs-as-root-without-a-password)) | "authorized" |

These notes don't cover what `/usr/bin/steamos-update` and `/usr/bin/steamos-select-branch` do in turn.

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
