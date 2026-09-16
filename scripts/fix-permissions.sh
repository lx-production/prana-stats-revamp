#!/usr/bin/env bash
set -euo pipefail

# Fix permissions after build if needed
# Doc: /home/prana/prana-stats-revamp/docs/harden.md section 5

APP=/home/prana/prana-stats-revamp

echo "Fixing permissions for .env and app JSON files..."

# .env - owner:prana, group:prana-stats, mode:640
sudo chown prana:prana-stats "$APP/.env"
sudo chmod 640 "$APP/.env"

# Three app JSON files - owner:prana-stats, group:prana, mode:660
sudo chown prana-stats:prana \
  "$APP/bonds_v2.json" \
  "$APP/bonds_v2_details.json" \
  "$APP/active_stakes.json"

sudo chmod 660 \
  "$APP/bonds_v2.json" \
  "$APP/bonds_v2_details.json" \
  "$APP/active_stakes.json"

echo "Done. Permissions restored."
