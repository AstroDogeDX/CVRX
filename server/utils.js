const { app } = require('electron');

exports.GetUserAgent = () => `CVRX/${app.getVersion()} (deployment:${app.isPackaged ? 'production' : 'development'})`;
