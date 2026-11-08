#!/bin/sh
# Installs the systemd user timer that runs scripts/clips-home.mjs every minute
# while this computer is on (docs/adr/0004). Run it again after moving the repo or
# changing Node versions. Remove with:
#   systemctl --user disable --now ivan-os-clips.timer
#   rm ~/.config/systemd/user/ivan-os-clips.*
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
node=$(command -v node)
uv=$(command -v uv)
units="$HOME/.config/systemd/user"
mkdir -p "$units"

cat > "$units/ivan-os-clips.service" <<UNIT
[Unit]
Description=Ivan OS: download the YouTube Clips waiting for this computer
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$repo
Environment=PATH=$(dirname "$uv"):$(dirname "$node"):/usr/local/bin:/usr/bin:/bin
ExecStart=$node $repo/scripts/clips-home.mjs
UNIT

cat > "$units/ivan-os-clips.timer" <<UNIT
[Unit]
Description=Ivan OS: look for waiting YouTube Clips every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=5s
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now ivan-os-clips.timer
echo "Installed. Logs: journalctl --user -u ivan-os-clips -f"
