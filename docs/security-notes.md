# Security notes

These are configuration facts observed on the headset that affect who can reach what. Network reachability was tested from another machine on the same Wi-Fi network, with developer mode on and again with it off, using TCP connects and HTTP `GET` requests only. Nothing was exploited.

## In practice

- Leave developer mode off when you aren't using it. That stops `sshd` (22), the DevTools forwarders (8081, 8088), RDP (3389), the devkit service (32000), ADB and USB networking.
- With developer mode off, three TCP ports still accepted connections from other machines: Steam (27036), LLMNR name resolution (5355) and a kernel-owned socket (16385). UDP, including mDNS (5353), wasn't scanned. Developer mode doesn't control these, so use the headset only on networks you trust.
- If you need developer mode on a shared network, at least stop the DevTools forwarders:
  ```sh
  sudo systemctl disable --now steam-web-debug-portforward steamvr-web-debug-portforward
  ```
  Toggling developer mode on again re-enables them.
- Set a strong password for `steamos`. RDP uses it.
- Back up the calibration data and raw EEPROMs before you experiment ([Before you poke around → Back up first](safety.md#back-up-first)).
- Don't post the output of `dmesg`, `softapcmd state`/`status`, `eeprom_console print_all`, `vrconfig_serial`, `devkit-1-identify`, or the log submitter's `UnitId` publicly. They contain credentials or per-device identifiers ([full list](safety.md#keep-these-private)).

## At a glance

**Tag: Internal.** Everything was observed with developer mode on, except LLMNR (5355), whose network test was only run with it off; network ports were also scanned with developer mode off. In the "Needs developer mode?" column: "Yes" means `steamos-devkit-mode` turns it on. "No" means the configuration behind it (a udev rule, a polkit policy or a script) doesn't depend on developer mode, or, for TCP 16385, 27036 and 5355, that it still accepted connections from another machine with developer mode off. "Not switched by developer mode" means `steamos-devkit-mode` doesn't change it, but it wasn't checked with developer mode off.

| Item | Reachable from | Needs developer mode? | How established |
|---|---|---|---|
| Chromium DevTools, TCP 8081 | The LAN, no authentication | Yes | Tested from another machine (`GET /json/version` returned 200); served by the `socat` forwarder |
| Devkit pairing service, TCP 32000 | The LAN | Yes | Tested from another machine (`GET /properties.json` returned 200) |
| RDP (`xrdp`), TCP 3389 | The LAN; account password | Yes | Tested from another machine (TCP connect) |
| SSH, TCP 22 | The LAN; `sshd` also listens on `usb0` | Yes | Tested from another machine (TCP connect) |
| Kernel-owned socket, TCP 16385 | The LAN | No | Tested from another machine with developer mode on and off (connect succeeds, no HTTP response); owner from a read-only root pass on the headset |
| Steam client, TCP 27036 | The LAN | No | Tested from another machine with developer mode on and off (TCP connect) |
| LLMNR (`systemd-resolved`), TCP 5355 | The LAN | No | Tested from another machine with developer mode off (TCP connect) |
| Soft-AP control sockets, open to all local users | Any local process | Not switched by developer mode | Tested on the headset as `steamos` |
| EEPROM sysfs files, mode 666 | Any local user | No | Read from config (udev rule `99-eeprom.rules`) |
| `gpu-trace` XML-RPC, TCP 47317 | Local processes; closed or filtered from the LAN | No | Methods read from the script; LAN result tested from another machine |
| 22 passwordless `pkexec` helpers | Any local process, in any session, SSH included | No | Polkit policy; tested on the headset (`pkaction`, `pkcheck`) |
| atomupd polkit rules | A local, active `steamos` session; not SSH | No | Read from config; `pkcheck` from SSH tested on the headset |
| Recovery-shell ADB | USB-C, while the recovery shell runs | No | Read from scripts |
| Serial numbers in `dmesg` and `/proc/device-tree/board-info/` | Any local user | Not switched by developer mode | Tested on the headset |
| Calibration files in `/persist`, modes 664 and 644 | Any local user, read only | Not switched by developer mode | File modes from a root listing on the headset |
| `/dev/dri/card0`, mode 666 | Any local user | No | Mode from `ls -l`; udev rule `99-gpu-permissions.rules` |
| Display panel debugfs files, group-writable | Members of the `video` group, which includes `steamos` | No | Owner and mode from a listing |
| `xhost +` on X display `:0` | Local processes; Xwayland doesn't listen on TCP | Not switched by developer mode | Read from `gamescope-onready` and Xwayland's command line |
| `/dev/kvm`, `/dev/ntsync`, `/dev/fuse`, mode 666 | Any local user | Not switched by developer mode | Modes from `ls -l` on the headset |

## On the network

**Tag: Internal.**

**The firewall opens all high ports.** The `public` zone on `wlan0` allows TCP and UDP 1024–65535 from anywhere. From another machine on the same network, ports 22, 3389, 8081, 8088, 16385, 27036 and 32000 accepted connections. The ports bound to 127.0.0.1 (8080, 27062, 47317) were closed or filtered ([port map](network-services.md#port-map)).

**Chromium DevTools answers other machines without authentication.** Port 8081 forwards to the Steam client's Chromium DevTools endpoint on `127.0.0.1:8080`. From another machine on the same network, `GET /json/version` on port 8081 returned 200, with no authentication. That means anyone on the same network can reach the Steam client's debugger. Port 8088 is the matching forwarder for SteamVR's UI; it accepted TCP connections from another machine, but nothing was listening on its target, `127.0.0.1:8087`. If you don't need remote UI debugging, turn developer mode off, or stop the two `*-web-debug-portforward` services ([DevTools](network-services.md#chromium-devtools-80808081-and-80878088)).

**RDP is on 3389.** It accepted TCP connections from another machine. It's protected by the account password, so set a strong one.

**SSH is on 22.** It accepted TCP connections from another machine.

**The devkit pairing service accepts requests from anyone on the network.** `GET /properties.json` returned 200 from another machine. Its `approve-ssh-key` hook asks the running Steam client to approve each key and fails after 30 seconds without a response ([devkit service](network-services.md#devkit-pairing-service-port-32000)).

**Steam listens on 27036 on all interfaces.** It accepted TCP connections from another machine, with developer mode on and with it off.

**LLMNR name resolution listens on 5355.** `systemd-resolved` accepted TCP connections from another machine with developer mode off ([port map](network-services.md#port-map)).

**A kernel-owned socket is on TCP 16385.** It's bound to all interfaces, accepted connections from another machine, with developer mode on and with it off, and didn't respond to an HTTP `GET`. A read-only root pass found no process holding the socket ([port 16385](network-services.md#port-16385)).

## Over USB

**Tag: Internal.**

**ADB is on while developer mode is on, and it's configured to allow root.** Whether a PC must be authorized first wasn't tested. Turn developer mode off when you aren't using it.

**The recovery shell offers ADB over USB-C.** If the headset drops to its initramfs recovery shell, it starts ADB on the USB-C port before rebooting, whether or not developer mode is on ([boot → recovery shell](boot.md#recovery-shell)). As with any device, don't leave the headset where someone else can plug into it.

## Local (any process running on the headset)

**Tag: Internal.**

**Any program on the headset can read the hotspot password.** The headset's own Wi-Fi access point is managed through control sockets that every local process can use, so any program can read the hotspot's name and password and change or stop the hotspot. Don't reuse that password anywhere else.

**The EEPROMs are world-writable.** The I²C `eeprom` sysfs files are mode 666. A buggy or malicious local program could corrupt the unit's calibration, serial numbers or MAC addresses. Back up both the calibration data and the raw EEPROMs somewhere off the headset ([how](safety.md#back-up-first)). The backups contain per-unit identifiers, so keep them private.

**The kernel log contains the headset's serial numbers, and any local user can read it.** `steamos-dump-info` writes the serial numbers of the unit, main board, head strap and several components into the kernel log at every boot. Because `kernel.dmesg_restrict` is 0, `dmesg` shows them to any local process. Don't paste raw `dmesg` output in bug reports or forums without redacting it.

**The device tree exposes the same serials.** U-Boot passes a `board-info` node, and its entries (`mpcba_sn`, `fan_sn`, `core_cm_sn`, the audio and heat-pipe serials, and more) are world-readable files under `/proc/device-tree/board-info/` ([boot](boot.md#device-tree-flags-from-the-bootloader)).

**The calibration files in `/persist` are world-readable.** A root listing shows `device_config.json`, `xrservice.json` and `exp_5v_out_enable` as `root:root`, mode 664, `eyetracking.json` as mode 644, and the directory itself as mode 775, so any local user can read them ([SteamVR → /persist](steamvr.md#per-device-config-in-persist)). Going by their key names, `device_config.json` holds the device and display serial numbers and the display calibration ([OpenXR → display](openxr.md#display-refresh-rate-and-timing)), `xrservice.json` the tracking cameras' and IMU's calibration, including camera serials ([tracking](openxr.md#tracking-pipeline-and-spaces)), and `eyetracking.json` the eye cameras' calibration and IPD data ([eye tracking](openxr.md#eye-tracking-foveation-hands-and-passthrough)). Writes are more limited: the group-write bit is for the `root` group, `/persist` is normally mounted read-only, and `vrconfig_write`, which remounts it to commit changes, is root only. Treat these files' contents like the serials in the kernel log, and back them up before you experiment ([how](safety.md#back-up-first)).

**`gpu-trace` accepts unauthenticated requests from local programs.** The profiling daemon runs as root and listens on localhost only; port 47317 was closed or filtered from another machine ([gpu-trace](network-services.md#gpu-trace-xml-rpc-47317)).

**`/dev/dri/card0` is mode 666.** The display controller's primary DRM node is `root:video` with mode 666, set by `99-gpu-permissions.rules` (`deckard-hw-support`), plus an ACL for `steamos`. `/dev/dri/renderD128` is also mode 666. During a VR session `vrcompositor` is the only DRM master on `card0` ([graphics → devices and permissions](graphics.md#devices-and-permissions), [hardware → display](hardware.md#display)).

**The display panel's debug controls are writable by the `steamos` user.** Some debugfs files for the display panel are writable by the `video` group, which `steamos` belongs to, so a program running as `steamos` could send low-level commands to the panel. These files weren't read or written during the survey.

**X access control is off on display `:0`.** `gamescope-onready` runs `xhost +` on the Steam client's Xwayland display, `:0`. Xwayland is started without `-listen tcp`, so on the surveyed build this applies to local processes only ([graphics → interpretation](graphics.md#interpretation), [displays and sockets](graphics.md#displays-and-sockets)).

**`/dev/kvm`, `/dev/ntsync` and `/dev/fuse` are mode 666.** `/dev/kvm` is `root:kvm` and `/dev/ntsync` is `root:root`, both mode 666 ([kernel → build options](kernel.md#build-options-worth-knowing), [Running other software → Wine and ntsync](compatibility.md#wine-and-ntsync)). `/dev/fuse` is also mode 666 ([developer workflow → containers](developer-workflow.md#containers)).

**Programs in your session can change OS update settings.** A local, active `steamos` session can change update settings, including the update branch, without a password. From SSH, the same actions were refused ([permissions → OS updates](permissions.md#os-updates)).

**Any process can run 22 root helpers without a password.** All 30 Valve `pkexec` actions have `implicit any: yes`, and 22 of their target programs exist ([permissions](permissions.md#polkit-what-runs-as-root-without-a-password)). That applies to every session, SSH included (`pkcheck` returned "authorized" from SSH), and isn't limited to the `steamos` user.

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
