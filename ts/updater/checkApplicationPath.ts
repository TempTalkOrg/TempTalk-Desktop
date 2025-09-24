import { app, dialog, MessageBoxOptions } from 'electron';
import { LoggerType } from '../logger/types';
import { isMacOS } from '../OS';
import { moveSync, pathExistsSync } from 'fs-extra';

function getCurrentAppPath(logger: LoggerType, installPath: string) {
  const index = installPath.indexOf('.app/') + 4;
  const currentAppPath = installPath.substring(0, index);

  logger.info('current application folder:', currentAppPath);

  return currentAppPath;
}

function getExpectedAppPath(logger: LoggerType, productName: string) {
  const expectedAppPath = `/Applications/${productName}.app`;

  logger.info('expected application folder:', expectedAppPath);

  return expectedAppPath;
}

export function checkApplicationPath(
  logger: LoggerType,
  productName: string,
  installPath: string,
  mainExePath: string
): boolean {
  if (!isMacOS()) {
    logger.info('current is not macOS');
    return true;
  }

  if (!app.isInApplicationsFolder()) {
    logger.info('current is not running under /Applications');
    return true;
  }

  const expectedAppPath = getExpectedAppPath(logger, productName);
  const currentAppPath = getCurrentAppPath(logger, installPath);

  if (expectedAppPath === currentAppPath) {
    return true;
  }

  logger.info('current is running under unexpected app folder');

  let boxOptions: MessageBoxOptions = { type: 'warning', message: '' };

  if (pathExistsSync(expectedAppPath)) {
    // dest already exists, just warning user to move it manually
    boxOptions = {
      type: 'warning',
      buttons: ['Quit'],
      message: 'Operation needed',
      detail:
        `The application is now named ${productName}.\nTo ensure it functions well,` +
        ` please manually moved it from ${currentAppPath}\n to ${expectedAppPath}!`,
    };
  } else {
    // must set relaunch before moving
    const execPath = mainExePath.replace(currentAppPath, expectedAppPath);
    app.relaunch({ execPath });

    // auto rename current app path to expected
    try {
      moveSync(currentAppPath, expectedAppPath, { overwrite: false });

      boxOptions = {
        type: 'warning',
        buttons: ['Restart'],
        message: 'Operation needed',
        detail:
          `The application is now named ${productName}.\nTo ensure it functions well,` +
          ` it has been moved from ${currentAppPath}\n to ${expectedAppPath}!`,
      };
    } catch (error) {
      logger.error('move application failed', error);

      boxOptions = {
        type: 'warning',
        buttons: ['Quit'],
        message: 'Operation failed',
        detail:
          `Can not move application from ${currentAppPath}\n to ${expectedAppPath}!\n` +
          ` The application is now named ${productName},` +
          ` to ensure current application functions well, please manually move it again!`,
      };
    }
  }

  dialog.showMessageBoxSync(boxOptions);

  return false;
}
