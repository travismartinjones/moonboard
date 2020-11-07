#!/bin/bash
set -o errexit
LOG_FILE=/var/log/moonboard

exec 1>$LOG_FILE
exec 2>&1

cd /home/pi/moonboard/frontend
sudo dotnet run