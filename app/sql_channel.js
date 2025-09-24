const electron = require('electron');
const { remove: removeUserConfig } = require('./user_config');
const { remove: removeEphemeralConfig } = require('./ephemeral_config');
const { remove: removeSqlConfig } = require('./sql_config');

const { ipcMain } = electron;

const { shouldTrace } = require('../ts/logger/utils');

module.exports = {
  initialize,
};

let sql = undefined;
let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';

function logJobId(id) {
  return 'c' + id;
}

function logSeqId(id) {
  return 's' + id;
}

function initialize(mainSQL) {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }

  sql = mainSQL;
  initialized = true;

  ipcMain.on(SQL_CHANNEL_KEY, async (event, jobId, callName, ...args) => {
    try {
      const start = Date.now();
      const { result, seqId, duration, worker } = await sql.sqlCall(
        callName,
        ...args
      );

      const delta = Date.now() - start;
      if (shouldTrace(delta)) {
        console.log(
          `SQL job ${logJobId(jobId)} (${callName}) succeeded in ${delta}ms`,
          `with call seq ${worker} ${logSeqId(seqId)} duration ${duration}ms`
        );
      }

      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, null, result);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(
        `sql channel error with call ${callName}: ${errorForDisplay}`
      );

      if (!event.sender.isDestroyed()) {
        event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, errorForDisplay);
      }
    }
  });

  ipcMain.on(ERASE_SQL_KEY, async event => {
    try {
      removeUserConfig();
      removeEphemeralConfig();
      removeSqlConfig();
      event.sender.send(`${ERASE_SQL_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_SQL_KEY}-done`, error);
    }
  });
}
