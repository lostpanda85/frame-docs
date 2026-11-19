# Steam Frame: unofficial developer notes

Valve hasn't published developer documentation for the Steam Frame's operating system. These notes cover what you can see from a shell on a retail unit: the OpenXR runtime, graphics, audio and wireless stacks, network services and D-Bus APIs, hardware and power, compatibility layers, developer workflow, and the boot chain and firmware.

They're for Linux-literate Steam Frame owners and developers who want to explore the headset or build tools for it. You'll need developer mode on, SSH access, and to be comfortable in a shell.

Every statement is based on something observed read-only on a retail headset: files, command output, strings in binaries, sysfs and the journal. Each claim names its source, and some content comes from strings in binaries only, not from watching the feature run. Where something couldn't be confirmed, the docs say so instead of guessing. Names and behavior can change with any OS update.

## I want to…

- **Know what's risky before I start:** [Before you poke around](docs/safety.md)
- **Back up calibration before experimenting:** [Back up first](docs/safety.md#back-up-first), [EEPROM](docs/hardware.md#eeprom) and [Security notes: local](docs/security-notes.md#local-any-process-running-on-the-headset)
- **Get SSH access:** [Quick start](#quick-start), or pair a key through the [devkit service](docs/network-services.md#post-register)
- **Check what my headset exposes on my network:** the [port map](docs/network-services.md#port-map) and [Security notes: on the network](docs/security-notes.md#on-the-network)
- **See which developer tools are installed:** [What's installed](docs/developer-workflow.md#whats-installed)
- **Deploy and debug my own code:** [Developer workflow](docs/developer-workflow.md), especially [Where changes persist](docs/developer-workflow.md#where-changes-persist), [Starting and inspecting programs from SSH](docs/developer-workflow.md#starting-and-inspecting-programs-from-ssh) and [Debugging and profiling](docs/developer-workflow.md#debugging-and-profiling)
- **Run my own SteamVR build:** [Running a different SteamVR build](docs/steamvr.md#running-a-different-steamvr-build)
- **Build an OpenXR app or check which extensions it can use:** [Extensions](docs/openxr.md#extensions), [Interaction profiles](docs/openxr.md#interaction-profiles) and [API layers](docs/openxr.md#api-layers)
- **Use eye tracking, foveation or hand tracking:** [Eye tracking, foveation, hands and passthrough](docs/openxr.md#eye-tracking-foveation-hands-and-passthrough)
- **Check Vulkan, OpenGL and GPU support:** [Vulkan](docs/graphics.md#vulkan) and [OpenGL, GLES and EGL](docs/graphics.md#opengl-gles-and-egl)
- **Understand how flat apps appear in VR:** [How a flat app reaches the panels](docs/graphics.md#how-a-flat-app-reaches-the-panels)
- **Run x86 or Android software:** [FEX](docs/compatibility.md#fex), [Proton](docs/compatibility.md#proton) and [Lepton (Android games)](docs/compatibility.md#lepton-android-games)
- **Understand audio routing:** [Node graph](docs/audio.md#node-graph), [Spatial audio](docs/audio.md#spatial-audio) and [Microphone path](docs/audio.md#microphone-path)
- **Check Wi-Fi, Bluetooth or PC streaming:** [Wi-Fi chip and driver](docs/wireless.md#wi-fi-chip-and-driver), [Bluetooth controller](docs/wireless.md#bluetooth-controller) and [PC streaming: `vrlink`](docs/wireless.md#pc-streaming-vrlink)
- **Read battery, fan and power state:** [Battery and charging](docs/hardware.md#battery-and-charging), [Thermals and the fan](docs/hardware.md#thermals-and-the-fan), [Power rails](docs/hardware.md#power-rails)
- **Understand sleep, the power button and thermals:** [Sleep states](docs/power.md#sleep-states), [Power button](docs/power.md#power-button) and [Thermal zones](docs/power.md#thermal-zones)
- **Understand the boot and update process:** [Boot](docs/boot.md), especially [Updates: RAUC, atomupd and the slot switch](docs/boot.md#updates-rauc-atomupd-and-the-slot-switch)
- **Look up a term or codename:** [Glossary](docs/glossary.md)

## Contents

1. [Before you poke around](docs/safety.md): what to back up first, commands not to run, things that change state when they look read-only, and recovery.
2. [Network services](docs/network-services.md): every listening port, including the devkit pairing API, the Chromium debug ports and SteamVR's web server.
3. [D-Bus APIs](docs/dbus.md): SteamOS Manager, the OS updater (atomupd), RAUC, the log submitter, notifications and portals.
4. [SteamVR on the Frame](docs/steamvr.md): the `steamvr` and `vrcmd` tools, mailboxes, sideloading a SteamVR build, and how apps find the runtime.
5. [OpenXR and the VR runtime](docs/openxr.md): how the runtime is registered, the extensions and interaction profiles it lists, Valve's FDM injection API layer, eye tracking, foveation, display timing and tracking.
6. [Graphics, display and input](docs/graphics.md): Turnip (Vulkan) and Zink (OpenGL), Valve's Vulkan layers, the DRM/KMS state, how gamescope hands flat apps to `vrcompositor`, input devices, text input and accessibility.
7. [Audio](docs/audio.md): the sound card, PipeWire and WirePlumber, the speaker EQ, the microphone chain, spatial audio and who can see which audio nodes.
8. [Hardware access](docs/hardware.md): `vrdevice_path`, battery and power rails, thermals, the fan, the status LED, cameras, sensors and the EEPROM.
9. [Controllers](docs/controllers.md): how the controllers connect through the headset's radio, their inputs, compatibility remapping, pairing and firmware updates.
10. [Power, suspend and thermals](docs/power.md): sleep states, sleep inhibitors, the power button, thermal zones, and CPU and GPU frequency governors.
11. [Wi-Fi, Bluetooth and streaming](docs/wireless.md): the WCN7850 chip, NetworkManager, the headset's own access point, Bluetooth, and the `vrlink` PC streaming client.
12. [Running other software](docs/compatibility.md): FEX for x86 programs, Proton, the Steam Linux Runtime, Lepton for Android games, podman, Flatpak and `ntsync`.
13. [Developer workflow](docs/developer-workflow.md): installed tools, where changes persist, packages and containers, running your own Steam client, starting programs from SSH, and debugging and profiling.
14. [Services catalog](docs/services.md): every systemd unit from Valve, SteamOS and Frame-specific packages, what it runs, and how a boot gets to VR.
15. [Kernel](docs/kernel.md): Valve's kernel tree, the drivers it adds, the device-tree hardware map, and build options.
16. [Boot](docs/boot.md): boot firmware, U-Boot, A/B slot state, RAUC updates, the initramfs and the bootloader's device-tree flags.
17. [Firmware](docs/firmware.md): every firmware image on the device, what loads it, and how it's updated.
18. [Local sockets and IPC](docs/local-ipc.md): the soft-AP manager, pidbridge, and the Steam client pipe.
19. [Permissions](docs/permissions.md): what the `steamos` user can do without a password, and what developer mode turns on.
20. [Security notes](docs/security-notes.md): things worth knowing before you leave developer mode on.
21. [Methodology](docs/methodology.md): how this was collected, and how to repeat it on your own unit.
22. [Glossary](docs/glossary.md): codenames, package names and abbreviations used across these pages.

## Quick start

Turn on developer mode in the headset's settings first. Then:

1. **Find the headset.** On the headset, `ip -4 addr show wlan0` prints its Wi-Fi address. The devkit service also registers an mDNS record of type `_steamos-devkit._tcp`. Over a USB-C cable (with developer mode on), the headset is always `10.86.200.233` (see [USB networking](docs/network-services.md#usb-networking-and-adb)).
2. **Get SSH access.** Either pair an RSA key through the [devkit service](docs/network-services.md#post-register), which asks the running Steam client to approve the key, or set a password on the headset with `passwd` from the desktop-mode terminal. You need a password anyway for `sudo` and RDP.
3. **Connect and look around:**

```sh
ssh steamos@<frame-ip>

# What model does the OS think it is?
busctl --user get-property com.steampowered.SteamOSManager1 \
  /com/steampowered/SteamOSManager1 \
  com.steampowered.SteamOSManager1.Manager2 DeviceModel
# (ss) "steam_frame" "Deckard"

# Battery, fan and thermals
cat /run/deckardcharger/battery_percent
fanspeed -p
cat /sys/class/hwmon/hwmon*/name

# What is SteamVR running from?
steamvr path
```

## What this was gathered from

| Item | Value |
|---|---|
| OS | SteamOS 0.5.9, VR variant, build 20261113.6134720 |
| Kernel | 7.2.0 (`linux-72-deckard 7.2.0+g344f27110f05`) |
| SteamVR | `deckard-steamvr-rel r26655409+24cb4748` |
| Steam client | `deckard-steam-rel r1794536281+f85bf676` |
| SteamOS Manager | 26.4.1 |
| SoC | SM8650 (`/sys/devices/soc0/machine`), aarch64, 8 CPUs (`nproc`), 16 GB RAM (`/proc/meminfo`) |
| Codename | Deckard (packages are named `deckard-*`; SteamOS Manager reports `steam_frame` / `Deckard`) |
| Access | SSH as the default `steamos` user with developer mode on; one read-only root pass run by the owner (script and output summary in [Methodology](docs/methodology.md)); port tests from a second machine on the same network, with developer mode on and off |
| Survey | November 2026 |

Probing was read-only: listing, D-Bus introspection and property reads, reading files, `GET` requests, `pkcheck` authorization checks, and a few query commands listed in [Methodology](docs/methodology.md). Port tests were run against the headset from a second machine on the same local network. Nothing was written to the device on purpose. The one accidental change is described in [Methodology](docs/methodology.md#incident-running-unknown-binaries-with---help).

## Public vs. internal

Each interface in these docs is tagged with one of two labels:

- **Public**: the interface has a published definition on the device or upstream. That means an installed D-Bus interface XML file, a freedesktop or Khronos spec, or an upstream open-source project. Examples: the SteamOS Manager D-Bus API, the OpenXR runtime registration, and the freedesktop notification server.
- **Internal**: no such definition was found; the interface is only visible through Valve's scripts, binaries and files. Examples: the soft-AP control socket, the `/run/deckardcharger` state files, and SteamVR mailboxes.

A few entries say "Public (upstream)" or "Public (spec)". These are third-party projects or freedesktop standards, documented elsewhere. Port 16385, whose socket is owned by the kernel itself, is tagged "Unknown" because which kernel code serves it is not established.

If you're building something you want to survive updates, stay on the public side where you can.

## Reading the diagrams

Several pages include diagrams. They use one convention: a solid arrow is a step or path the files state; a dotted arrow or dashed box is something not determined, not observed, or inactive; a plain line means "named in" (evidence from strings or config). Diamonds are decisions and rounded ends are end states. Every diagram restates facts from the text around it, so nothing in a diagram is new.

## Contributing

If your unit shows something different, such as a new port, a renamed interface or a different build, open an issue or PR with your OS version (`cat /etc/os-release`) and what you saw. Please strip serial numbers, MAC addresses, machine IDs and Wi-Fi credentials before posting. Several of the tools described here print them. If you edit a page, run `python3 scripts/build-llms-full.py` to refresh `llms-full.txt`.

## Credit and citation

These notes are written and maintained by [lostpanda85](https://github.com/lostpanda85). If you use them in a project, article, video, wiki or AI-generated answer, please credit **lostpanda85** and link to <https://github.com/lostpanda85/frame-docs>.

Suggested citation:

> lostpanda85. *Steam Frame developer notes.* https://github.com/lostpanda85/frame-docs

GitHub's "Cite this repository" button gives the same in APA and BibTeX form (from [`CITATION.cff`](https://github.com/lostpanda85/frame-docs/blob/main/CITATION.cff)). For AI tools, [`llms.txt`](https://lostpanda85.github.io/frame-docs/llms.txt) indexes the pages and [`llms-full.txt`](https://lostpanda85.github.io/frame-docs/llms-full.txt) has all of them in one file.

## License

The documentation in this repo is released under the [MIT License](https://github.com/lostpanda85/frame-docs/blob/main/LICENSE). File names, paths, command output and strings quoted from Valve's software belong to their respective owners and are quoted for reference.

## Disclaimer

Not affiliated with or endorsed by Valve. "Steam", "SteamVR", "SteamOS" and "Steam Frame" are Valve trademarks. This repo describes interfaces and does not redistribute Valve's code or binaries. Where a quoted snippet comes from an openly licensed file (SteamOS Manager, steamos-devkit-service and gpu-trace are MIT-licensed), the source is named.
