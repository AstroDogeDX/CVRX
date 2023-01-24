const { app, BrowserWindow } = require('electron')
const createWindow = () => {
    const win = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        icon: './client/img/ico.png'
    })

    win.loadFile('index.html')
}
app.whenReady().then(() => {
    createWindow()
})