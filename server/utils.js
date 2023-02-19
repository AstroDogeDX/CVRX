// const { app } = require('electron');

const APIUserAgent = 'ChilloutVR API-Requests';

// Todo: Make use of our user agent
//exports.GetUserAgent = () => `CVRX/${app.getVersion()} (deployment:${app.isPackaged ? 'production' : 'development'})`;
exports.GetUserAgent = () => APIUserAgent;
