const { app, BrowserWindow } = require('electron')
const createWindow = () => {
    const win = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        width: 1280,
        height: 720,
        icon: './client/img/ico.ico'
    })

    win.loadFile('index.html')
}
app.whenReady().then(() => {
    createWindow()
})