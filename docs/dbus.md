# D-Bus APIs

Valve's system services are on the system bus. The user-facing SteamOS Manager API is on the session bus. You can explore any of them with `busctl`:

```sh
busctl --user tree com.steampowered.SteamOSManager1
busctl --user introspect com.steampowered.SteamOSManager1 /com/steampowered/SteamOSManager1
```

Over SSH, the session bus for the `steamos` user is at `/run/user/1000/bus`. `busctl --user` finds it as long as you're logged in as `steamos`.

| Bus name | Bus | Tag | What it does |
|---|---|---|---|
| `com.steampowered.SteamOSManager1` | session | Public | Performance profiles, GPU clocks, session switching, storage, firmware updates |
| `com.steampowered.SteamOSManager1` | system | Internal | The root-side backend for the above |
| `com.steampowered.Atomupd1` | system | Public | OS updates |
| `de.pengutronix.rauc` | system | Public (upstream) | A/B image installer that atomupd drives |
| `com.steampowered.SteamOSLogSubmitter` | system | Internal | Crash and log collection |
| `org.freedesktop.Notifications` | session | Public | Steam's notification daemon |
| `org.freedesktop.impl.portal.desktop.holo` / `.gamescope` | session | Public (spec) | xdg-desktop-portal backends |

---

## SteamOS Manager

**Tag: Public.** SteamOS Manager is Valve's open-source (MIT) daemon for device settings. Its device files in `/usr/share/steamos-manager/devices/` cover the Steam Deck, the Steam Machine and several third-party handhelds as well as the Frame. Steam's `steamui.so` contains the string `com.steampowered.SteamOSManager1`. The interface XML, with Valve's own doc comments, ships at `/usr/share/dbus-1/interfaces/com.steampowered.SteamOSManager1.xml`.

There are two instances:

- **Session bus** (`/usr/lib/steamos-manager`, runs as `steamos`). It exposes the versioned interfaces described in the XML file below.
- **System bus** (`/usr/lib/steamos-manager -r`, runs as root). It exposes a single flat `RootManager` interface. Treat it as internal.

The XML marks most interfaces as "Optional", and the Frame's session object exposes only some of them (listed below). For example, the XML defines `ScreenReader0` and `ScreenReader1`, but neither is exported on the Frame ([graphics → accessibility](graphics.md#accessibility)). Device support is described in TOML under `/usr/share/steamos-manager/devices/`, and the Frame's file is `steam-frame.toml`. The scripts behind factory reset, firmware update, trim and format are set in `/usr/share/steamos-manager/platform.toml`.

There's also a CLI, `steamosctl`, that wraps most of this:

```sh
steamosctl get-all-properties
steamosctl get-performance-profile
steamosctl set-performance-profile Balanced
```

### Interfaces present on the Frame

Object path: `/com/steampowered/SteamOSManager1`

#### `Manager2`

| Member | Type | Notes |
|---|---|---|
| `DeviceModel` | property `(ss)`, read | `("steam_frame", "Deckard")` |
| `ReloadConfig()` | method | Re-read config from disk |

#### `PerformanceProfile1`

| Member | Type | Value on Frame |
|---|---|---|
| `AvailablePerformanceProfiles` | `as`, read | `Performance`, `Balanced`, `Powersave` |
| `PerformanceProfile` | `s`, read/write | one of the above |
| `SuggestedDefaultPerformanceProfile` | `s`, read | `Performance` |

On the Frame these are "custom" profiles defined in `steam-frame.toml`. Each one caps the maximum frequency of the four CPU clusters (cpufreq policies 0, 2, 5 and 7):

| Profile | policy0 | policy2 | policy5 | policy7 | GPU cap |
|---|---|---|---|---|---|
| Performance | 2.27 GHz | 3.15 GHz | 2.96 GHz | 3.05 GHz | none |
| Balanced | 2.27 GHz | 2.52 GHz | 2.52 GHz | 2.55 GHz | none |
| Powersave | 2.04 GHz | 2.04 GHz | 2.04 GHz | 2.04 GHz | 629 MHz |

The cpufreq policies' hardware ranges and the thermal side are on [power → CPU and GPU frequency](power.md#cpu-and-gpu-frequency).

#### `GpuPerformanceLevel1`

| Member | Type | Value on Frame |
|---|---|---|
| `AvailableGpuPerformanceLevels` | `as`, read | `auto`, `manual` |
| `GpuPerformanceLevel` | `s`, read/write | `auto` |
| `ManualGpuClock` | `u`, read/write (MHz) | only takes effect in `manual` |
| `ManualGpuClockMin` / `Max` | `u`, read | 500 / 903 |

The GPU is driven through devfreq at `/sys/devices/platform/soc@0/3d00000.gpu/devfreq/3d00000.gpu`.

```sh
busctl --user set-property com.steampowered.SteamOSManager1 /com/steampowered/SteamOSManager1 \
  com.steampowered.SteamOSManager1.GpuPerformanceLevel1 GpuPerformanceLevel s manual
busctl --user set-property com.steampowered.SteamOSManager1 /com/steampowered/SteamOSManager1 \
  com.steampowered.SteamOSManager1.GpuPerformanceLevel1 ManualGpuClock u 700
```

#### `CpuScaling1`, `CpuBoost1`, `CpuScheduler1`

| Member | Type | Value on Frame |
|---|---|---|
| `AvailableCpuScalingGovernors` | `as`, read | `conservative ondemand userspace powersave performance schedutil` |
| `CpuScalingGovernor` | `s`, read/write | `schedutil` |
| `CpuBoostState` | `u`, read/write | `0` = off, `1` = on |
| `AvailableCpuSchedulers` | `as`, read | `none`, `lavd` |
| `CpuScheduler` | `s`, read/write | `lavd` (the `scx_lavd` sched_ext scheduler) |

The user unit `steamos-scheduler.service` sets the governor and scheduler at login ([power → CPU and GPU frequency](power.md#cpu-and-gpu-frequency)).

#### `SessionManagement1`

| Member | Notes |
|---|---|
| `SwitchToGameMode()` | Log out and go back to the VR session |
| `SwitchToDesktopMode()` | Log out into the default desktop session |
| `SwitchToDesktopSession(s)` | Log out into a specific desktop session |
| `SwitchToLoginMode(s)` | `game` or `desktop` |
| `ValidDesktopSessions() → as` | Sessions you can pass above |
| `DefaultDesktopSession` | `s`, rw. Default is `plasma.desktop` |
| `DefaultLoginMode` | `s`, rw. Default is `game` |
| `CleanTemporarySessions()` | Internal |

On the Frame, "game mode" is `gamescope-session.target`, which runs gamescope with its OpenVR backend.

#### `Storage1`

| Member | Notes |
|---|---|
| `FormatDevice(s device, s label, b validate) → o job` | Formats e.g. `/dev/mmcblk0` for Steam. `validate` runs a fake-flash check first. |
| `TrimDevices() → o job` | XML doc: "Perform fstrim on relevant disk devices. Calling this over fstrim is important as some devices are not safe to trim unless some kernel quirks are available." Runs `/usr/lib/hwsupport/trim-devices.sh` (`platform.toml`). |

#### `FactoryReset1`, `UpdateBios1`

| Member | Notes |
|---|---|
| `PrepareFactoryReset(u kind) → u status` | `kind`: 1 = user data, 2 = OS, 3 = both. Returns 1 when a reboot is required. **Destructive.** |
| `UpdateBios() → o job` | Runs the `[update_bios]` script from `platform.toml` (`/usr/bin/jupiter-biosupdate --auto`), which on the Frame is a stub ([firmware](firmware.md)) |

#### `WifiBackend1`, `WifiPowerManagement1`

| Member | Notes |
|---|---|
| `WifiBackend` | `s`, rw. `wpa_supplicant` or `iwd`. The Frame uses `wpa_supplicant`. |
| `WifiPowerManagementState` | `u`, rw. 0 = off, 1 = on |

The NetworkManager drop-ins behind these are on [Wi-Fi → NetworkManager and wpa_supplicant](wireless.md#networkmanager-and-wpa_supplicant).

#### `RemoteInterface1`, `UdevEvents1`

`RemoteInterfaces` (`as`) lists interfaces that SteamOS Manager relays to other processes. It's empty on the Frame. `UsbOverCurrent(s devpath, s port, t count)` is a signal raised when a USB port trips over-current.

### Jobs

Long-running methods return an object path under `/com/steampowered/SteamOSManager1/Jobs/…` that implements `Job1`:

| Method | Notes |
|---|---|
| `Pause()` / `Resume()` | |
| `Cancel(b force)` | `force` uses SIGKILL instead of SIGTERM |
| `Wait() → i` | Blocks until done and returns the exit code (negative signal number if killed) |
| `ExitCode() → i` | Non-blocking version |

`/com/steampowered/SteamOSManager1/Jobs` itself implements `JobManager1`, which emits `JobStarted(o)`.

### Root interface (internal)

The system-bus instance exposes `com.steampowered.SteamOSManager1.RootManager`, a flat list of setters (`SetGpuPerformanceLevel`, `SetCpuScalingGovernor`, `SetMaxChargeLevel`, `SetFanSpeed`, `SetTdpLimit` and so on). It also has a few extra properties: `InhibitDs` (true on the Frame), `EcLogging`, `FanControlState`, `AlsCalibrationGain`, and HDMI-CEC state. Its interface name carries no version number. It lists methods for features the Frame's session object doesn't expose (`SetTdpLimit`, `SetFanSpeed`, `SetMaxChargeLevel`).

---

## OS updates: `com.steampowered.Atomupd1`

**Tag: Public.** `atomupd-daemon` manages SteamOS's A/B image updates. The CLI is `atomupd-manager`. Steam's `steamui.so` also references `com.steampowered.Atomupd1`.

Object path: `/com/steampowered/Atomupd1`

### Properties

| Property | Type | Example / meaning |
|---|---|---|
| `CurrentVersion` | `s` | OS version, e.g. `0.5.x` |
| `CurrentBuildID` | `s` | Build ID, in `YYYYMMDD.N` form |
| `Variant` | `s` | `vr` |
| `Branch` | `s` | One of `KnownBranches` |
| `KnownVariants` | `as`, read | `vr` |
| `KnownBranches` | `as`, read | `stable beta preview rc bc pc main` |
| `KnownDevBranches` | `as`, read | `rc beta bc preview pc main` |
| `UpdateStatus` | `u` | 0–5: idle, in progress, paused, successful, failed, cancelled (order as listed by `atomupd-manager --help`) |
| `ProgressPercentage` | `d` | |
| `EstimatedCompletionTime` | `t` | Unix time |
| `UpdateVersion`, `UpdateBuildID` | `s` | The build being installed |
| `UpdatesAvailable`, `UpdatesAvailableLater` | `a{sa{sv}}` | Filled in by `CheckForUpdates` |
| `FailureCode`, `FailureMessage` | `s` | |
| `HttpProxy` | `(si)` | host, port |
| `Version` | `u` | API version, 8 |

### Methods

| Method | Notes |
|---|---|
| `CheckForUpdates(a{sv}) → (a{sa{sv}}, a{sa{sv}})` | Returns (available now, available later) |
| `StartUpdate(s buildid)` | |
| `PauseUpdate()`, `ResumeUpdate()`, `CancelUpdate()` | |
| `SwitchToBranch(s)`, `SwitchToVariant(s)` | |
| `GetBuilds(a{sv}) → s` | JSON list of builds |
| `StartCustomUpdate(a{sv})` | Install a specific RAUC bundle URL, version or build ID |
| `SimulateUpdate(a{sv})` | Shows which `/etc` files wouldn't survive an update |
| `EnableHttpProxy(s, i, a{sv})`, `DisableHttpProxy()` | |
| `EnableDevKeys(a{sv})`, `DisableDevKeys(a{sv})` | Trust development signing keys |
| `ReloadConfiguration(a{sv})` | |

Polkit defaults (`pkaction --verbose`): five atomupd actions are `yes` for an active session and `auth_admin` otherwise, and six (switching branch or variant, custom updates, downgrades, proxy changes, trusted keys) are `auth_admin_keep` for an active session. A rule in `com.steampowered.Atomupd1.rules` grants those six to `steamos` when `subject.active` and `subject.local` are both true. From an SSH session, `pkcheck` returned "not authorized" for both `start-upgrade` and `switch-variant-or-branch`.

```sh
atomupd-manager status
atomupd-manager list-branches
atomupd-manager check
```

---

## RAUC: `de.pengutronix.rauc`

**Tag: Public (upstream).** [RAUC](https://rauc.io). `atomupd-manager --help` describes `custom-update` as applying "a custom update from a specific RAUC bundle URL". Interface XML is at `/usr/share/dbus-1/interfaces/de.pengutronix.rauc.Installer.xml`. On the Frame: `Compatible = "steamos-aarch64"`, `BootSlot` is `"A"` or `"B"`. `GetSlotStatus()` shows both slots.

The bootloader is U-Boot. The slot variable names (`BOOT_ORDER`, `BOOT_COUNT_*` and others) appear in the SPL, U-Boot and `splctl` binaries. A root read of the environment partition that `/etc/fw_env.config` points at found only `bootdelay`, `default_bootargs` and `verify`, so where slot state is stored wasn't determined. [Boot](boot.md#u-boot-environment-and-slot-state) has the details.

---

## Log submitter: `com.steampowered.SteamOSLogSubmitter`

**Tag: Internal.** Unit description: "SteamOS log submitter service - sends error logs to Valve". The manager has `Enabled`, `CollectEnabled` and `SubmitEnabled` properties. The manager object is at `/com/steampowered/SteamOSLogSubmitter/Manager`:

| Member | Notes |
|---|---|
| `Enabled`, `CollectEnabled`, `SubmitEnabled`, `Inhibited` | `b`, read/write |
| `ListPending()`, `ListUploaded()`, `ListFailed()` | `as` |
| `Trigger()`, `TriggerAsync()` | Run a collection pass now |
| `Log(dsus)` | Write to its log. Argument names aren't given in the introspection data. |
| `NewLogs(as)` | signal |
| `UnitId` | `s`. A per-device ID. Don't paste it publicly. |

Each collector is a child object under `/com/steampowered/SteamOSLogSubmitter/helpers/` (`Devcoredump`, `Earlyoom`, `Gpu`, `Journal`, `Kdump`, `Minidump`, `Sysinfo`, `Sysreport`, `Trace`, `Tzlog`) and implements `…Helper` with `Collect()`, `Extract(ss) → h`, and per-helper enable flags. `Trace` adds `LogEvent(s, a{sv})`.

---

## Notifications

**Tag: Public.** `steam_notif_daemon` owns `org.freedesktop.Notifications` on the session bus and implements the [freedesktop notification spec](https://specifications.freedesktop.org/notification-spec/latest/) (server info: `simple_notif_daemon`, spec 1.2). It passes each notification to Steam as a `steam://open_xdg_notification/?euid=…&pid=…&notif_id=…&app_name=…&summary=…&body=…` URL, and closes them with `steam://close_xdg_notification/?notif_id=…` (both from its binary's strings).

```sh
notify-send "Build finished" "Took 4m12s"
# or
gdbus call --session --dest org.freedesktop.Notifications \
  --object-path /org/freedesktop/Notifications \
  --method org.freedesktop.Notifications.Notify \
  "my-app" 0 "" "Build finished" "Took 4m12s" [] {} 5000
```

`GetCapabilities` returns an empty list, so don't count on actions, markup or icons.

---

## Desktop portals

**Tag: Public (spec).** The portal configuration (`/usr/share/xdg-desktop-portal/gamescope-portals/gamescope-portals.conf`) prefers `holo`, then `gamescope`, and uses KDE for file choosers.

- `xdg-desktop-portal-gamescope` provides `ScreenCast`, `Screenshot` and `Access`.
- `xdg-desktop-portal-holo` provides `AppChooser`, `Email`, `Lockdown` and `Settings`.

Apps should use the normal `org.freedesktop.portal.*` frontend interfaces, not the `impl` backends directly.

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
