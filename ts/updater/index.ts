// 因为一下连接的原因，我们修改了config库的引入方式
// https://github.com/lorenwest/node-config/issues/657
// https://github.com/lorenwest/node-config/issues/617

// import { get as getFromConfig } from 'config';
import config from 'config';
import { BrowserWindow } from 'electron';

import {
  manualCheckForUpdates as manualCheckForUpdatesMacOS,
  start as startMacOS,
} from './macos';
import {
  manualCheckForUpdates as manualCheckForUpdatesWindows,
  start as startWindows,
} from './windows';
import { deleteBaseTempDir, getArch, LoggerType, MessagesType } from './common';
import { toLogFormat } from '../types/errors';
import { isInsiderUpdate } from './insider';

let initialized = false;

export type Helpers = {
  getMainWindow: () => BrowserWindow;
};
export async function start(
  helpers: Helpers,
  messages?: MessagesType,
  logger?: LoggerType
) {
  const { platform } = process;

  if (initialized) {
    throw new Error('updater/start: Updates have already been initialized!');
  }
  initialized = true;

  if (!messages) {
    throw new Error('updater/start: Must provide messages!');
  }
  if (!logger) {
    throw new Error('updater/start: Must provide logger!');
  }

  if (autoUpdateDisabled()) {
    logger.info(
      'updater/start: Updates disabled - not starting new version checks'
    );

    return;
  }

  try {
    await deleteBaseTempDir();
  } catch (error) {
    logger.error('updater/start: Error deleting temp dir:', toLogFormat(error));
  }

  if (platform === 'win32') {
    await startWindows(helpers, messages, logger);
  } else if (platform === 'darwin') {
    await startMacOS(helpers, messages, logger);
  } else {
    throw new Error('updater/start: Unsupported platform');
  }
}

function autoUpdateDisabled() {
  return (
    process.platform === 'linux' || process.mas || !config.get('updatesEnabled')
  );
}

export async function manualCheckForUpdates(
  helpers: Helpers,
  messages?: MessagesType,
  logger?: LoggerType
) {
  if (!messages) {
    throw new Error(
      'updater/start: manualCheckForUpdates Must provide messages!'
    );
  }
  if (!logger) {
    throw new Error(
      'updater/start: manualCheckForUpdates Must provide logger!'
    );
  }

  const { platform } = process;
  if (platform === 'darwin') {
    await manualCheckForUpdatesMacOS(helpers, messages, logger);
  } else if (platform === 'win32') {
    await manualCheckForUpdatesWindows(helpers, messages, logger);
  } else {
    throw new Error(
      'updater/start: manualCheckForUpdates Unsupported platform'
    );
  }
}

export function getRunningUnderArch() {
  return getArch();
}

export { isInsiderUpdate };
