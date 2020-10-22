#!/bin/bash

echo "Enable SPI"
sudo sed -i 's/\#dtparam=spi=on/dtparam=spi=on/g' /boot/config.txt

echo "Disable Audio"
sudo sed -i 's/\dtparam=audio=on/#dtparam=audio=on/g' /boot/config.txt
sudo echo blacklist snd_bcm2835 > /etc/modprobe.d/raspi-blacklist.conf # FIXME: defensive


# Install dependencies
sudo apt-get update
sudo apt-get upgrade
sudo apt-get -y install git vim python3-pip gcc make build-essential
sudo apt-get -y install libatlas-base-dev 
sudo apt-get -y install python-dev swig scons # for building WS2811 drivers

echo "Install application"
test -d moonboard || git clone https://github.com/travismartinjones/moonboard.git
cd moonboard
git pull
git checkout feature/customization

# Installing python dependencies
pip3 install -r requirements.txt
sudo pip3 install -r requirements.txt 
# pip3 uninstall -y -r requirements.txt # uninstall


echo "Install service"
cd /home/pi/moonboard/services
sudo ./install_service.sh moonboard.service 
cd /home/pi/moonboard


echo "Install DBUS service"
sudo cp /home/pi/moonboard/ble/com.moonboard.conf /etc/dbus-1/system.d
sudo cp /home/pi/moonboard/ble/com.moonboard.service /usr/share/dbus-1/system-services/


echo "Prepare logfiles"
sudo touch /var/log/moonboard
sudo chown pi:pi /var/log/moonboard
sudo chown pi:pi /var/log/moonboard

# Prepare phase 2 to run at boot
sudo cp --verbose /home/pi/moonboard/services/moonboard-install.service /lib/systemd/system/moonboard-install.service
sudo chmod 644 /lib/systemd/system/moonboard-install.service
sudo systemctl daemon-reload
sudo systemctl enable moonboard-install.service

echo "Restarting in 5 seconds to finalize changes. CTRL+C to cancel."
sleep 1 > /dev/null
printf "."
sleep 1 > /dev/null
printf "."
sleep 1 > /dev/null
printf "."
sleep 1 > /dev/null
printf "."
sleep 1 > /dev/null
printf " Restarting"
sudo shutdown -r now
