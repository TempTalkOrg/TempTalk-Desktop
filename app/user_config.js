const path = require('path');

const { app } = require('electron');

const { start } = require('./base_config');

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

console.log(`userData: ${userDataPath}`);

const userConfig = start('user', targetPath);

module.exports = userConfig;
