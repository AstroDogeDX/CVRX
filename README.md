# CVRX

A companion app for **ChilloutVR** that e**X**pands the user experience!

## Features
* **Real Time Friends List** - Stay connected with your friends instantly
* **Live Instance Tracking** - Monitor instances with player and friend counts
* **Deep Link Support** - Join instances and invites directly from CVRX
* **Detailed Content Pages** - Comprehensive views for avatars, props, worlds, users, and instances
* **Content Search** - Find exactly what you're looking for
* **Content Discovery** - Explore new, recently updated, and random content
* **User Content Management** - Organize your favourites and shares
* **Advanced Avatar Configurator** - Fine-tune your avatar settings
* **Favourites Categories** - Organize your favourites with custom categories
* **And Much More!** - Continuously expanding features for the ultimate CVR experience

## Screenshots
![CVRX Logging In](https://i.imgur.com/ftI2rGu.png)
---
![CVRX Home Page](https://i.imgur.com/snpUoEi.png)
---
![CVRX Details Page](https://i.imgur.com/OJyn3tp.png)
---
![CVRX Search Feature](https://i.imgur.com/ggSqj03.png)

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
> This software is in no way associated with or officially supported by the ChilloutVR Team.
>
> ---
