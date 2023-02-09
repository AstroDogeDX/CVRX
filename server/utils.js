const { app } = require('electron');

// Todo: Make use of our user agent
exports.GetUserAgent = () => `CVRX/${app.getVersion()} (deployment:${app.isPackaged ? 'production' : 'development'})`;
