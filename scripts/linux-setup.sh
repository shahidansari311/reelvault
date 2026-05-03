#!/bin/bash

# Update system
sudo apt-get update
sudo apt-get install -y curl git unzip zip openjdk-17-jdk

# Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Android SDK
export ANDROID_HOME=$HOME/android-sdk
mkdir -p $ANDROID_HOME/cmdline-tools
cd $ANDROID_HOME/cmdline-tools

curl -o commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools.zip
mv cmdline-tools latest
rm commandlinetools.zip

# Add to PATH
echo "export ANDROID_HOME=$HOME/android-sdk" >> ~/.bashrc
echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools" >> ~/.bashrc
source ~/.bashrc

# Accept licenses and install platform tools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "Linux/WSL environment setup complete! You can now build your app."
