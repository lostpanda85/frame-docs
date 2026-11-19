# Local sockets and IPC

These are the Unix sockets and files that Valve's components use to talk to each other on the device. None of them are reachable from the network.

## Soft-AP manager

**Tag: Internal.** `softapmanager` (root) runs the Frame's own Wi-Fi access point on `wlanap`, alongside the normal client connection on `wlan0`. It generates the `hostapd` and `dnsmasq` configs in `/var/run/`, picks channels, puts `wlanap` in the `nm-shared` firewall zone, and can also bring up USB NCM networking.

### Control socket

`/var/run/softapmanager.socket` is a stream socket. Send a command as plain text **with no trailing newline**, then read the reply. The server closes the connection afterwards. With a trailing newline, the command isn't recognized.

```sh
printf 'get-channels' | socat - UNIX-CONNECT:/var/run/softapmanager.socket
```

The `softapcmd` CLI does the same thing:

```sh
softapcmd state
softapcmd get-channels
softapcmd get-plan
```

| Command | Reply / effect |
|---|---|
| `status` | Tab-separated: state code, state text, SSID, password. **Contains the AP password.** |
| `state` | JSON: `sta` (client link), `ap` (access point), `status`, `clients`. **Contains the AP password.** |
| `getcreds` | Not run (it's listed in the binary's usage string) |
| `get-channels` | JSON: usable channels for the current regulatory country, grouped as `5g80`, `5g160`, `6g80`, `6g160`, each with `center`, `primaries` and `dfs` |
| `get-plan` | JSON `searchPlan`: the fallback order used when bringing the AP up (see below) |
| `create …` | Not run. Full usage string below the table. |
| `teardown` | Not run |
| `refresh`, `delayrefresh` | Not run. `/usr/lib/systemd/system-sleep/50-softapcmd-refresh-on-resume.sh` runs `softapcmd delayrefresh` after resume (`$1 == post`). |
| `enablencm` | Not run. The binary contains the paths `/sys/kernel/config/usb_gadget/g1/functions/ncm.usb0` and `…/configs/c.1/ncm.usb0`. |
| `set-fallback-country-code` | Not run |
| `test`, `test-scan`, `streamon`, `streamoff`, `transparent` | Seen in the binary. Not explored. |

Usage for `create`, as printed by the binary:

```
create <AP name | -> <password | -> <hbs|hbs6|scs> <nat|noroute> [preferred_channel]
       [--channel preferred_6_channel] [--channel56 <0|preferred_5_channel> <0|preferred_6_channel>]
       [--hidden] [--width <80|160>]
```

The shape of a `state` reply, with every value except the `isAP` flags removed:

```json
{
  "sta": { "frequency": …, "channel": …, "SSID": "…", "connected": …, "isAP": 0, "band": …, "width": … },
  "ap":  { "frequency": …, "channel": …, "SSID": "…", "password": "…", "connected": …, "isAP": 1, "band": …, "width": … },
  "status": { "country": "<CC>", "noir": …, "mode": "<mode>", "route": "…", "state": …,
              "text": "…", "stations": …, "ssid": "…", "password": "…" },
  "clients": []
}
```

The mode names (`hbs`, `hbs6`, `scs`) aren't explained anywhere on the device.

The default search plan, tried in order:

1. "Regular Connection": `hbs6`, hidden SSID
2. "AP Visible": `hbs6`, visible
3. "High Channel Fallback": `hbs6`, `--channel56 153 69`
4. "Low Channel Fallback": `hbs6`, `--channel56 40 37`
5. "Global Fallback": `scs`

### Streaming socket

`/var/run/softapmanager.streaming.socket` is a second socket created by `softapmanager`. `vrlink` and `vrlinkquery` (in `/opt/steamvr/tools/vrlink/`) contain the socket path; no other binary checked does (`steamclient.so`, `vrserver`, `vrcompositor`, `driver_cv.so` and the SteamVR `.so` files). Next to the path in `vrlink` are `streamon`, `streamoff` and `Could not open streaming scan suppression socket` ([Wi-Fi, Bluetooth and streaming → PC streaming: `vrlink`](wireless.md#pc-streaming-vrlink)). Separately, `softapmanager` contains `streamon`/`streamoff` command names, a `scanblock %s -> %f` log string, and the path `/sys/module/cfg80211/parameters/cfg80211_block_scans`.

Both sockets are mode 0777. See [security notes](security-notes.md).

## pidbridge

**Tag: Internal.** `pidbridge` (user service `pidbridge.service`, described as "Host PID bridge for Lepton containers") listens on `$XDG_RUNTIME_DIR/pidbridge/pidbridge.sock`, which is `/run/user/1000/pidbridge/pidbridge.sock`.

Connect, and it replies with 4 bytes: the connecting process's PID, as a little-endian 32-bit integer. The binary's strings include `getsockopt(SO_PEERCRED)` and `peer host pid=%d uid=%u gid=%u`. A test connection got back its own PID.

```python
import socket, struct

with socket.socket(socket.AF_UNIX) as s:
    s.connect("/run/user/1000/pidbridge/pidbridge.sock")
    buf = b""
    while len(buf) < 4:
        chunk = s.recv(4 - len(buf))
        if not chunk:
            raise ConnectionError("pidbridge closed early")
        buf += chunk
host_pid, = struct.unpack("<i", buf)
```

"Lepton" appears in two places in the OS image. One is this service's description, quoted above. The other is a podman drop-in, `/usr/lib/systemd/user/podman.service.d/lepton-podman-timeout.conf`, whose comment reads: "Force podman to disable its auto-disable timeout, so that `catatonit -P` doesn't linger after our container has exited, making Steam think that a lepton game is still running." Lepton itself is a Steam tool (`steamapps/common/Lepton/`) that runs Android games in podman containers. The Android userspace packages (`deckard-mesa-android-aarch64`, `deckard-vulkan-layers-android-aarch64`) install under `/usr/share/guestos/android`, which Lepton bind-mounts into its containers ([Running other software → Lepton (Android games)](compatibility.md#lepton-android-games)).

If you run `pidbridge` by hand, it treats its first argument as the socket path, even if that argument is `--help`.

## Steam client pipe

**Tag: Internal.** The Steam client reads commands from a FIFO at `~/.steam/steam.pipe`. The devkit hooks use it to reach Steam:

```
devkit-1 steam://devkit-1/<token>/<command>?<query>\n
```

`<token>` is the contents of `~/.steam/steam.token`. Steam's PID is in `~/.steam/steam.pid`. The only `devkit-1` command used on the Frame is `approve-ssh-key?response=<file>&request=<text>`. The hook then waits up to 30 seconds for Steam to create the `response` file. The `request` text is "Development host at IP <ip> key: <key comment>". The helper for this is in `/usr/share/steamos-devkit/hooks/devkit_utils/__init__.py`.

## Charger state files

**Tag: Internal.** `/run/deckardcharger/` is effectively IPC between `deckard_charge_daemon`, `ledcontrol` and the VR stack. See [Hardware access → `/run/deckardcharger/`](hardware.md#rundeckardcharger).

## Steam and SteamVR internals

**Tag: Internal.** These are listed so you can recognize them, not to be used directly.

Listening sockets and their owners (`ss -xlp`):

- `/tmp/.com.valvesoftware.Steam.<id>/SingletonSocket`: `steamwebhelper` and `vrwebhelper`
- `/tmp/steam_chrome_shmem_uid1000_spid<pid>`: `steamwebhelper`
- `@/steamvr/*` and `@dsp_service`: see [SteamVR](steamvr.md#internal-ipc-sockets)
- `/run/user/1000/gamescope-0` and `gamescope-0-ei`: the Steam process's environment has `LIBEI_SOCKET=gamescope-0-ei` and `DISPLAY=:0`

---

*Part of [Steam Frame developer notes](https://github.com/lostpanda85/frame-docs) by [lostpanda85](https://github.com/lostpanda85). MIT licensed: if you reuse or quote this, please credit lostpanda85 and link back to the repository.*
