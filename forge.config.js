const { version } = require('./package.json');

module.exports = {
    packagerConfig: {
        icon: 'icon/cvrx-logo',
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                // URL to an ICO file to use as the application icon (displayed in Control Panel > Programs and Features).
                iconUrl: 'https://raw.githubusercontent.com/AstroDogeDX/CVRX/main/icon/cvrx-logo.ico',
                // The ICO file to use as the icon for the generated Setup.exe
                setupIcon: 'icon/cvrx-logo.ico',
                loadingGif: 'icon/loading.gif',
                setupExe: `CVRX-v${version}-Windows.exe`,
            },
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'linux'],
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
                options: {
                    maintainer: 'AstroDoge & Kafeijao',
                    homepage: 'https://github.com/AstroDogeDX/CVRX',
                    icon: 'icon/cvrx-logo.png',
                },
            },
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {
                options: {
                    icon: 'icon/cvrx-logo.png',
                    homepage: 'https://github.com/AstroDogeDX/CVRX',
                },
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                overwrite: true,
                icon: 'icon/cvrx-logo.icns',
            },
        },
    ],
};
