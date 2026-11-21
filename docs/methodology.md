# Methodology

## How this was collected

Everything came from an SSH session as `steamos` on a retail Frame in developer mode, without root, except where noted below:

- **Ports**: `ss -tulpn` for listeners, then `curl` with a plain `GET` against each TCP port (from the device itself). `ss` hides the process name for root-owned sockets unless you're root. For those, `ss -tlne` still shows the owning uid and the systemd cgroup, which names the service (e.g. `cgroup:/system.slice/gpu-trace.service`). Port 16385's socket shows uid 0 and the root cgroup, so `ss` alone didn't identify its owner; the root pass below did (the kernel).
- **D-Bus**: `busctl --system list` / `busctl --user list`, then `busctl tree` and `busctl introspect` on every Valve-owned name. Property values in these docs are what introspection reported.
- **Packages**: `pacman -Q` filtered for Valve and `deckard-*` packages, then `pacman -Ql` to see what each one installs. Text files (scripts, units, udev rules, polkit policies, configs) were read directly.
- **Binaries**: `--help` at first. After the incident below, `strings` only, and `--help` only on tools known to support it.
- **Hardware**: walking `/sys/class/hwmon`, `/sys/bus/iio`, `/sys/class/leds`, `/proc/bus/input/devices`, and running `vrdevice_path` for every key.
- **Services**: `pacman -Qoq` on every unit file in `/usr/lib/systemd/{system,user}` and `/etc/systemd/{system,user}`, then `systemctl [--user] show` and `systemctl cat` for each Valve-owned unit, and a read of every wrapper script they call. Results are in [services](services.md).
- **Boot and firmware**: `strings` on the boot images (`/boot/uboot.img`, `uefi.fw` streamed out of `/boot/bootfw.tar.xz` with `tar xO`, nothing extracted to disk), the U-Boot default environment file, mkinitcpio hooks and install scripts, RAUC and atomupd scripts, `lsblk`/`findmnt`/sysfs for partitions, `/proc/device-tree/chosen`, `/usr/lib/firmware` with `pacman -Qo`, `modinfo`, `qcom_socinfo` in debugfs (readable through the `perf` group), and `systemd-analyze`. No bootloader, slot, firmware or update tool was run. [Boot](boot.md) and [firmware](firmware.md) each list the specific commands that are safe and the ones to avoid.
- **From a second machine**: from a Mac on the same Wi-Fi network, with developer mode on, TCP connects to each listening port and `GET` requests to `8081/json/version` and `32000/properties.json`. Ports 22, 3389, 8081, 8088, 16385, 27036 and 32000 accepted connections; 8080, 27062 and 47317 (bound to 127.0.0.1) didn't. Once more with developer mode off: a TCP connect scan of all 65,535 ports from the same Mac found only 5355, 16385 and 27036 open; UDP wasn't scanned ([port map](network-services.md#port-map)).
- **One read-only root pass**: the owner ran a short script with `sudo` that only reads: `ss -tlnpe` for port 16385, a scan of `/proc/*/fd` for the owner of that socket, `fw_printenv` (variable names and slot variables only), names and modes in `/persist`, a depth-3 listing of `/efi` and `/esp`, and a listing of `/sys/fs/pstore`. Its output was redacted on the device before it was read. Results are folded into [network services](network-services.md), [boot](boot.md) and [SteamVR](steamvr.md#per-device-config-in-persist).
- **SteamVR web API**: grepping the shipped web UI JavaScript in `/opt/steamvr/resources/webinterface/` and the `vrserver` binary's strings.

Nothing was deliberately written or changed. Commands that talked to a service or ran a Valve tool: `GET` requests (devkit service, DevTools ports, SteamVR web server), D-Bus property reads and `busctl introspect`, the notification server's `GetServerInformation`/`GetCapabilities`, `softapcmd status`/`state`/`get-channels`/`get-plan` and one raw `get-channels` over the socket with `socat`, a connection to `pidbridge`, `fanspeed -p`, `vrcmd --help`, `vrcmd --dumpsensors`, `vrcmd --mailboxcmd zz_nonexistent_doc_probe noop` (rejected), `pkcheck`/`pkaction` authorization queries, `fw_printenv` (failed without root), `eeprom_console help` and `get`, `vrdevice_path` for every key, and `avahi-browse -rtp _steamos-devkit._tcp` (found nothing).

## Source availability check

The [Kernel](kernel.md#source-availability) and [Boot](boot.md#source-availability) source-availability sections were checked on 2026-11-21. By then the owner had moved the headset from the beta channel back to stable, outside these read-only checks. The headset was reached over SSH on the USB-C link.

The RAUC journal (`journalctl -u rauc`) shows the 0.5.x bundles, including 0.5.9, installed between 2026-10-28 and 2026-11-19. Stable 0.4.5 (`deckard-stable-20261022.6150929-0.4.5.raucb`) was installed on 2026-11-20, and the headset then booted kernel 6.18.0. The 0.5.x bundle names carry no channel name: the beta channel is the owner's account of the setting. `/etc/steamos-atomupd/preferences.conf` now reads `Branch=stable`.

- **On the headset (read-only):** `pacman -Qi` and `pacman -Ql` for the kernel, U-Boot and `splctl` packages; `pacman -Qo` on files in `/boot`; `pacman -Q deckard-boot-firmware`; `/proc/device-tree/chosen/u-boot,version`; `modinfo` and `modules.builtin.modinfo` for driver metadata; `/proc/device-tree/compatible`; `/boot/ubootrelease.txt`; `journalctl -b <n> -k`, `journalctl -u rauc` and `/etc/steamos-atomupd/preferences.conf` to confirm the channel change.
- **From the Mac:**
  - Anonymous requests to the `gitlab.steamos.cloud` REST API (project lookups and the public project list).
  - Directory listings of Valve's Deckard source directory and the Steam Deck source mirror.
  - Partial downloads from the Deckard source directory, with their archive contents listed and nothing built or run: the whole `deckard-uboot-splctl` source package (110 KB), the first 4 MB of one `linux-72-deckard` package, the first 256 KB of one `linux-618-deckard` package, and the first 34 MB of `deckard-uboot-20261119.1-1`. For the last one, the git pack index was searched for one commit hash.
  - The GitHub API for `torvalds/linux`, `u-boot/u-boot` and the evlaV mirrors (directory listings, file contents, commits and commit search).
  - Seven public `gitlab.steamos.cloud` repositories (SteamFrame, the five `frame-public` projects and `holo-core-aarch64-preview`), cloned by the owner and read without running anything in them. The other public projects were judged from the project list only.
- **Not searched:** GitLab's web pages and the kernel mailing-list archives (lore.kernel.org, patchwork.kernel.org). All of them answered automated requests with a bot check.

## Incident: running unknown binaries with `--help`

Three tools didn't treat `--help` as a help flag:

- **`ledcontrol`** ignored it and started a second copy of the LED daemon, which changed the status LED's pattern until it was killed. `sudo systemctl restart deckard-led-control` puts the LED back under the real daemon's control.
- **`pidbridge`** treated `--help` as a socket path. It exited without leaving a file.
- **`splctl`** printed nothing and exited 0. It's a U-Boot boot-slot tool (`fw_setenv BOOT_ORDER …`). The U-Boot environment partition is `root:disk 0660`, so as `steamos` it couldn't have changed anything. `fw_printenv` couldn't even open its lock file.

After that, compiled binaries were only inspected with `strings`. One later side effect: while identifying a firmware file, `file` was killed by its own seccomp filter ("Bad system call") and dumped core, which can leave a `systemd-coredump` entry in the journal. Nothing on the device was changed by it. If you're exploring your own unit, do the same. Don't run Valve's daemons by hand, and never run `splctl` or `eeprom_console reset|lock|unlock|upgrade` as root unless you know what they'll do.

## Repeating this on your unit

Useful commands to see whether your build matches these docs:

```sh
cat /etc/os-release
pacman -Q | grep -E 'deckard|steamos|steamvr|softap|pidbridge|atomupd'
ss -tulpn
busctl --user introspect com.steampowered.SteamOSManager1 /com/steampowered/SteamOSManager1
busctl --system introspect com.steampowered.Atomupd1 /com/steampowered/Atomupd1
for k in $(vrdevice_path 2>&1 | grep -v '^Usage' | sed 's/^ *\(Valid keys:\)\? *//; s/<[^>]*>//g' | tr ',' ' '); do
  printf '%-24s %s\n' "$k" "$(vrdevice_path "$k" 2>&1 | head -1)"
done
```

## vrcmd options

The full `vrcmd --help` output from the SteamVR build in `/opt/steamvr` when these notes were written:

```
--anchortopose --appmanifest --background --chaperonesetuptest
--cmd --cmdasync --cmdhmd --compositorcmd --dock-overlay --dump-positions
--dump-vrlink-textures --dumpapps --dumpsensors --dumpsensorstomaya --events
--exitafterone --fastposes --gametheatersample --getanchor --handlewakeup
--help --hidedashboard --info --is-pid-present --lighthousedebugstring
--notify --overlay --overlays --pollcontrollers --pollhmdpresent --pollinit
--pollposes --predictiontime --prelaunch --printexportlivetobuffer --prop
--recenter --reload-shaders --renderdoc-capture --replay --resetroomheight
--resetroomsetup --rewind --screenshot --send-vrevent --set-settings-bool
--set-settings-float --set-settings-int --set-settings-string
--set-vsync-to-photons-offset-ms --settings-bool --settings-float
--settings-int --settings-string --showdashboard --showevents --showmodels
--spamhaptics --speedprops --startcapture --startlighthouserecording --stats
--statsLoop --stopcapture --stoplighthouserecording --testdisabledashboard
--testmessageoverlay --testpipe --toggle-overlay-flag --toggle-theater-stereo
--universe --util --version --waitforpose --waitforquit --watchdog
```

`--mailboxcmd` isn't in this list either. Valve's `vrshortcuts.sh` still uses it, but this `vrcmd` rejects it with `ERROR: --mailboxcmd is no longer supported.`

## Not covered

- Anything that needs root to see: root-owned sockets' owners, `/persist` contents, the U-Boot environment, the firewall's runtime rules beyond `firewall-cmd --list-all`
- gamescope's private Wayland protocols
- The Steam client's own internal APIs (the JavaScript `SteamClient` object in `SharedJSContext`). Those deserve their own write-up.
- The controllers' BLE protocol. [`steamvr-program-ble.service`](services.md#hardware-and-power) runs `program_ble.sh` against the headset's nRF52 radio at boot, but what goes over the air wasn't looked at.
- What runs on the FPGA
- Which kernel code serves port 16385 ([network services](network-services.md#port-16385)).

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
