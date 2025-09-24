const path = require('path');
const { app } = require('electron');

const { start } = require('./base_config');

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'insider.json');

const insiderConfig = start('insider', targetPath, {
  allowMalformedOnStartup: true,
});

module.exports = insiderConfig;
