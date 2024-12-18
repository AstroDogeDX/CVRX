# CVRX - The X stands for 'Xtra Cool'
A standalone companion app for ChilloutVR that expands the user experience!

## Features
* **Real Time** Friends List
* **Live Instances** with Friend Count
* See your **Friends, Avatars, Worlds & Props**
* Get & Reply **Notifications** in Real Time
* **Built on Electron** for Multiplatform Support

## Screenshots
![CVRX Getting Credentials](https://i.imgur.com/tSnPiKH.gif)
---
![CVRX Logging In](https://i.imgur.com/9uTEvbi.gif)
---
![CVRX Home Page](https://i.imgur.com/gy3HQzN.png)
---
![CVRX Search Feature](https://i.imgur.com/cKW1mJH.gif)

## Coming Soon™
* Manage your friends and content in-app
* Get additional stats and info, such as:
  * Time spent with friends
  * Last seen online
  * ...and more!

## Build Instructions
### Windows
1. Download and Install Node from https://nodejs.org/en/download/ (LTS is usually a good choice)
2. `git clone https://github.com/AstroDogeDX/CVRX.git`
3. `cd CVRX`
4. `npm install`
5. `npm run make`

This should create the `CVRX-x.x.x Setup.exe` in the folder: `out/make/squirrel.windows/x64/`

### MacOS
1. Ensure the electron pre-requisites are met: https://www.electronjs.org/docs/latest/development/build-instructions-macos#prerequisites
2. `git clone https://github.com/AstroDogeDX/CVRX.git`
3. `cd CVRX`
4. `npm install`
5. `npm run make-mac`

This should create the `CVRX-x.x.x-universal.dmg` in the folder: `out/make/`

### Others
Other platform build instructions are probably the same with some variations, however they haven't been tested.

## File Paths
### Windows
- Root: `%Appdata%/CVRX/`
- Logs: `%Appdata%/CVRX/CVRLogs/`
- Images Cache: `%Appdata%/CVRX/CVRCache/`

### MacOS
- Root: `~/Library/Application\ Support/CVRX/`
- Logs: `~/Library/Application\ Support/CVRX/CVRLogs/`
- Images Cache: `~/Library/Application\ Support/CVRX/CVRCache/`

## Disclaimer
> ---
> ⚠️ **Notice!**  
>
> This software is in no way associated with or supported by ChilloutVR or AB Interactive.
>
> ---
