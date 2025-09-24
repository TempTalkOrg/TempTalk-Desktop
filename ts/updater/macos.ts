import { createReadStream, statSync } from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { dirname } from 'path';

import { v4 as getGuid } from 'uuid';
import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  MessageBoxOptions,
} from 'electron';
import config from 'config';
import { gt } from 'semver';
import got from 'got';

import {
  checkForUpdates,
  deleteTempDir,
  doManualCheckForUpdates,
  downloadUpdate,
  LoggerType,
  MessagesType,
  showCannotUpdateDialog,
  showUpdateDialog,
} from './common';
import { hexToBinary, verifySignature } from './signature';
import { markShouldQuit } from '../../app/window_state';

// @ts-ignore
import * as packageJson from '../../package.json';
import { toLogFormat } from '../types/errors';
import { Helpers } from '.';

let isChecking = false;
const SECOND = 1000;
const MINUTE = SECOND * 60;
const INTERVAL = MINUTE * 30;

export async function start(
  helpers: Helpers,
  messages: MessagesType,
  logger: LoggerType
) {
  logger.info('macos/start: starting checks...');

  loggerForQuitHandler = logger;
  app.once('quit', quitHandler);

  setInterval(async () => {
    try {
      await checkDownloadAndInstall(helpers, messages, logger);
    } catch (error) {
      logger.error('macos/start: error:', toLogFormat(error));
    }
  }, INTERVAL);

  await checkDownloadAndInstall(helpers, messages, logger);
}

let fileName: string | undefined;
let version: string | undefined;
let updateFilePath: string | undefined;
let loggerForQuitHandler: LoggerType;
let markUpdateFinished: boolean;

async function checkDownloadAndInstall(
  helpers: Helpers,
  messages: MessagesType,
  logger: LoggerType
) {
  if (isChecking) {
    return;
  }

  if (markUpdateFinished) {
    return;
  }

  logger.info('checkDownloadAndInstall: checking for update...');
  try {
    isChecking = true;

    const result = await checkForUpdates(helpers, logger);
    if (!result) {
      return;
    }

    logger.info(
      `checkDownloadAndInstall: will downloadUpdate fileName=${fileName}, version=${version}`
    );
    const { fileName: newFileName, version: newVersion, channel } = result;
    if (fileName !== newFileName || !version || gt(newVersion, version)) {
      logger.info('checkDownloadAndInstall: will downloadUpdate inside if');
      deleteCache(updateFilePath, logger);
      fileName = newFileName;
      version = newVersion;
      updateFilePath = await downloadUpdate(channel, fileName, logger);
    }

    if (!updateFilePath) {
      throw new Error(
        `checkDownloadAndInstall: Downloaded update no return value: '${version}'; fileName: '${fileName}')`
      );
    }

    logger.info('checkDownloadAndInstall: will verifySignature');
    const publicKey = hexToBinary(config.get('updatesPublicKey'));
    const verified = await verifySignature(updateFilePath, version, publicKey);
    if (!verified) {
      // Note: We don't delete the cache here, because we don't want to continually
      //   re-download the broken release. We will download it only once per launch.
      throw new Error(
        `checkDownloadAndInstall: Downloaded update did not pass signature verification (version: '${version}'; fileName: '${fileName}')`
      );
    }

    logger.info('checkDownloadAndInstall: will handToAutoUpdate');
    try {
      await handToAutoUpdate(updateFilePath, logger);
    } catch (error) {
      logger.info(
        // @ts-ignore
        'checkDownloadAndInstall: handToAutoUpdate error=' + error.message
      );

      const { getMainWindow } = helpers;

      const readOnly = 'Cannot update while running on a read-only volume';
      // @ts-ignore
      const message: string = error.message || '';
      if (message.includes(readOnly)) {
        logger.info('checkDownloadAndInstall: showing read-only dialog...');
        await showReadOnlyDialog(getMainWindow(), messages);
      } else {
        logger.info(
          'checkDownloadAndInstall: showing general update failure dialog...'
        );
        await showCannotUpdateDialog(getMainWindow(), messages);
      }

      throw error;
    }

    // At this point, closing the app will cause the update to be installed automatically
    //   because Squirrel has cached the update file and will do the right thing.

    logger.info('checkDownloadAndInstall: showing update dialog...');
    markUpdateFinished = true;

    const confirmRestart = async () => {
      const mainWindow = helpers.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('show-update-button');
      }
      const shouldUpdate = await showUpdateDialog(mainWindow, messages);
      if (!shouldUpdate) {
        logger.info('checkDownloadAndInstall: user select updating later');
        setTimeout(() => confirmRestart(), 30 * 60 * 1000);
        return;
      }
      logger.info('checkDownloadAndInstall: calling quitAndInstall...');
      markShouldQuit();
      setImmediate(() => {
        app.removeAllListeners('window-all-closed');
        autoUpdater.quitAndInstall();
      });
    };

    await confirmRestart();
  } catch (error) {
    logger.error('checkDownloadAndInstall: error', toLogFormat(error));
  } finally {
    fileName = undefined;
    version = undefined;
    if (updateFilePath) {
      deleteCache(updateFilePath, logger);
      updateFilePath = undefined;
    }

    isChecking = false;
  }
}

function quitHandler() {
  deleteCache(updateFilePath, loggerForQuitHandler);
}

// Helpers

function deleteCache(filePath: string | undefined, logger: LoggerType) {
  if (filePath) {
    const tempDir = dirname(filePath);
    deleteTempDir(tempDir).catch(error => {
      logger.error(
        'quitHandler: error deleting temporary directory:',
        toLogFormat(error)
      );
    });
  }
}

async function handToAutoUpdate(
  filePath: string,
  logger: LoggerType
): Promise<void> {
  return new Promise((resolve, reject) => {
    const token = getGuid();
    const updateFileUrl = generateFileUrl();
    const server = createServer();
    let serverUrl: string;

    server.on('error', (error: Error) => {
      logger.error('handToAutoUpdate: server had error', toLogFormat(error));
      shutdown(server, logger);
      reject(error);
    });

    server.on(
      'request',
      (request: IncomingMessage, response: ServerResponse) => {
        const { url } = request;

        if (url === '/') {
          const absoluteUrl = `${serverUrl}${updateFileUrl}`;
          writeJSONResponse(absoluteUrl, response);

          return;
        }

        if (url === '/token') {
          writeTokenResponse(token, response);

          return;
        }

        if (!url || !url.startsWith(updateFileUrl)) {
          write404(url, response, logger);

          return;
        }

        pipeUpdateToSquirrel(filePath, server, response, logger, reject);
      }
    );

    server.listen(0, '127.0.0.1', async () => {
      serverUrl = getServerUrl(server);

      autoUpdater.on('error', (error: Error) => {
        logger.error('autoUpdater: error', toLogFormat(error));
        reject(error);
      });
      autoUpdater.on('update-downloaded', () => {
        logger.info('autoUpdater: update-downloaded event fired');
        shutdown(server, logger);
        resolve();
      });

      const response = await got.get(`${serverUrl}/token`);
      if (JSON.parse(response.body).token !== token) {
        throw new Error(
          'autoUpdater: did not receive token back from updates server'
        );
      }

      autoUpdater.setFeedURL({
        url: serverUrl,
        headers: { 'Cache-Control': 'no-cache' },
      });
      autoUpdater.checkForUpdates();
    });
  });
}

function pipeUpdateToSquirrel(
  filePath: string,
  server: Server,
  response: ServerResponse,
  logger: LoggerType,
  reject: (error: Error) => void
) {
  const updateFileSize = getFileSize(filePath);
  const readStream = createReadStream(filePath);

  response.on('error', (error: Error) => {
    logger.error(
      'pipeUpdateToSquirrel: update file download request had an error',
      toLogFormat(error)
    );
    shutdown(server, logger);
    reject(error);
  });

  readStream.on('error', (error: Error) => {
    logger.error(
      'pipeUpdateToSquirrel: read stream error response:',
      toLogFormat(error)
    );
    shutdown(server, logger, response);
    reject(error);
  });

  response.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': updateFileSize,
  });

  readStream.pipe(response);
}

function writeJSONResponse(url: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      url,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function writeTokenResponse(token: string, response: ServerResponse) {
  const data = Buffer.from(
    JSON.stringify({
      token,
    })
  );
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.byteLength,
  });
  response.end(data);
}

function write404(
  url: string | undefined,
  response: ServerResponse,
  logger: LoggerType
) {
  logger.error(`write404: Squirrel requested unexpected url '${url}'`);
  response.writeHead(404);
  response.end();
}

function getServerUrl(server: Server) {
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
}

function generateFileUrl(): string {
  return `/${getGuid()}.zip`;
}

function getFileSize(targetPath: string): number {
  const { size } = statSync(targetPath);

  return size;
}

function shutdown(
  server: Server,
  logger: LoggerType,
  response?: ServerResponse
) {
  try {
    if (server) {
      server.close();
    }
  } catch (error) {
    logger.error('shutdown: Error closing server', toLogFormat(error));
  }

  try {
    if (response) {
      response.end();
    }
  } catch (error) {
    logger.error("shutdown: couldn't end response", toLogFormat(error));
  }
}

async function showReadOnlyDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
) {
  const options: MessageBoxOptions = {
    type: 'warning',
    buttons: [messages.ok.message],
    title: messages.cannotUpdate.message,
    message: messages.readOnlyVolume.message,
  };
  await dialog.showMessageBox(mainWindow, options);
}

export async function manualCheckForUpdates(
  helpers: Helpers,
  messages: MessagesType,
  logger: LoggerType
) {
  return doManualCheckForUpdates(
    helpers,
    messages,
    logger,
    checkDownloadAndInstall
  );
}
