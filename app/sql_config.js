const path = require('path');

const { app } = require('electron');

const { start } = require('./base_config');

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'sql.json');

const sqlConfig = start('sql', targetPath, {
  allowMalformedOnStartup: true,
});

module.exports = sqlConfig;
