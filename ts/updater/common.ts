import {
  createWriteStream,
  statSync,
  writeFile as writeFileCallback,
} from 'fs';
import os from 'node:os';
import { join, normalize, resolve as pathResolve, sep } from 'path';

import { FAILSAFE_SCHEMA, safeLoad } from 'js-yaml';
import { gt, lt } from 'semver';
import config from 'config';
import got from 'got';
import { v4 as getGuid } from 'uuid';
import pify from 'pify';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import { app, BrowserWindow, dialog, MessageBoxOptions } from 'electron';

// @ts-ignore
import * as packageJson from '../../package.json';

import { getSignatureFileName } from './signature';
import { toLogFormat } from '../types/errors';
import { getGotOptions } from './gotOptions';
import {
  getUpdatesBase as getInsiderUpdatesBase,
  isInsiderUpdate,
} from './insider';
import { Helpers } from '.';

export type MessagesType = {
  [key: string]: {
    message: string;
    description?: string;
  };
};

type LogFunction = (...args: Array<any>) => void;

export type LoggerType = {
  fatal: LogFunction;
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  trace: LogFunction;
};

export type ChannelType = 'insider' | 'stable';

const writeFile = pify(writeFileCallback);
const rimrafPromise = pify(rimraf);
const { platform } = process;

type UpdateDetail = {
  version: string;
  osVersion: string;
  minOSVersion?: string;
};

type UpdateDetailEx = UpdateDetail & { error?: string };

class UnsupportedOSError extends Error {
  detail: UpdateDetail;

  constructor(message: string, detail: UpdateDetail) {
    super(message);
    this.name = 'UnsupportedOSError';
    this.detail = { ...detail };
  }
}

// abort controller for dialog
const dialogAbort = new AbortController();

export async function checkForUpdates(
  helpers: Helpers,
  logger: LoggerType
): Promise<{
  fileName: string;
  version: string;
  channel: ChannelType;
} | null> {
  const channel = await getUpdateChannel(helpers);
  const yaml = await getUpdateYaml(channel);
  const parsedYaml = parseYaml(yaml);
  const { version, vendor } = parsedYaml || {};

  if (!version) {
    logger.warn('checkForUpdates: no version extracted from downloaded yaml');
    throw new Error('checkForUpdates: no version found from yaml');
  }

  if (isVersionNewer(version)) {
    logger.info(`checkForUpdates: found newer version ${version}`);

    const osVersion = os.release();
    logger.info(`checkForUpdates: current OS version`, osVersion);

    if (vendor) {
      const { minOSVersion } = vendor;

      logger.info(
        'checkForUpdates: minmum supported OS version:',
        minOSVersion || 'NOT SET'
      );

      if (minOSVersion && lt(osVersion, minOSVersion)) {
        logger.warn(
          'checkForUpdates: New version avaliable but current OS is not supported'
        );

        const detail: UpdateDetailEx = {
          version,
          osVersion,
          minOSVersion,
        };

        const error = new UnsupportedOSError(
          'New version avaliable but current OS is not supported',
          detail
        );

        detail.error = error.name;
        helpers.getMainWindow()?.webContents.send('show-update-button', detail);

        throw error;
      }
    }

    return {
      fileName: getUpdateFileName(yaml, platform, getArch()),
      version,
      channel,
    };
  }

  logger.info(
    `checkForUpdates: ${version} is not newer; no new update available`
  );

  return null;
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const childPathResolved = pathResolve(childPath);

  let parentPathResolved = pathResolve(parentPath);
  if (!parentPathResolved.endsWith(sep)) {
    parentPathResolved += sep;
  }

  return (
    childPathResolved !== parentPathResolved &&
    childPathResolved.startsWith(parentPathResolved)
  );
}

function validatePath(basePath: string, targetPath: string): void {
  const normalized = normalize(targetPath);

  if (!isPathInside(normalized, basePath)) {
    throw new Error(
      `validatePath: Path ${normalized} is not under base path ${basePath}`
    );
  }
}

export async function downloadUpdate(
  channel: ChannelType,
  fileName: string,
  logger: LoggerType
): Promise<string> {
  const baseUrl = getUpdatesBase(channel);
  const updateFileUrl = `${baseUrl}/${fileName}`;

  const signatureFileName = getSignatureFileName(fileName);
  const signatureUrl = `${baseUrl}/${signatureFileName}`;

  let tempDir;
  try {
    tempDir = await createTempDir();
    const targetUpdatePath = join(tempDir, fileName);
    const targetSignaturePath = join(tempDir, getSignatureFileName(fileName));

    validatePath(tempDir, targetUpdatePath);
    validatePath(tempDir, targetSignaturePath);

    logger.info(`downloadUpdate: Downloading ${signatureUrl}`);
    const body = await got(signatureUrl, getGotOptions()).buffer();
    await writeFile(targetSignaturePath, body);

    logger.info(`downloadUpdate: Downloading ${updateFileUrl}`);
    const downloadStream = got.stream(updateFileUrl, getGotOptions());
    const writeStream = createWriteStream(targetUpdatePath);

    await new Promise((resolve, reject) => {
      downloadStream.on('error', error => {
        reject(error);
      });
      downloadStream.on('end', () => {
        resolve(true);
      });

      writeStream.on('error', error => {
        reject(error);
      });

      downloadStream.pipe(writeStream);
    });

    return targetUpdatePath;
  } catch (error) {
    if (tempDir) {
      await deleteTempDir(tempDir);
    }
    throw error;
  }
}

export async function showUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
): Promise<boolean> {
  // dismiss other dialog
  dialogAbort.abort();

  const RESTART_BUTTON = 0;
  const LATER_BUTTON = 1;

  const options: MessageBoxOptions = {
    type: 'info',
    buttons: [
      messages.autoUpdateRestartButtonLabel.message,
      messages.autoUpdateLaterButtonLabel.message,
    ],
    title: messages.autoUpdateNewVersionTitle.message,
    message: messages.autoUpdateNewVersionMessage.message,
    detail: messages.autoUpdateNewVersionInstructions.message,
    defaultId: RESTART_BUTTON,
    cancelId: LATER_BUTTON,
  };

  const { response } = await dialog.showMessageBox(mainWindow, options);
  return response === RESTART_BUTTON;
}

export async function showCannotUpdateDialog(
  mainWindow: BrowserWindow,
  messages: MessagesType
) {
  const options: MessageBoxOptions = {
    type: 'error',
    buttons: [messages.ok.message],
    title: messages.cannotUpdate.message,
    message: messages.cannotUpdateDetail.message,
  };

  await dialog.showMessageBox(mainWindow, options);
}

// Helper functions

async function getUpdateChannel(_helpers: Helpers): Promise<ChannelType> {
  if (isInsiderUpdate()) {
    return 'insider';
  }

  return 'stable';
}

function getUpdateCheckUrl(channel: ChannelType): string {
  return `${getUpdatesBase(channel)}/${getUpdatesFileName()}`;
}

export function getUpdatesBase(channel: ChannelType): string {
  // using insider updatesUrl if insider channel is enabled
  if (channel === 'insider') {
    const url = getInsiderUpdatesBase();
    if (url) {
      return url;
    } else {
      // should never come here
      // because isInsiderUpdate called getInsiderUpdatesBase
      // fallback to stable
    }
  }

  return config.get('updatesUrl');
}

export function getUpdatesFileName(): string {
  const prefix = isBetaChannel() ? 'beta' : 'latest';

  if (platform === 'darwin') {
    return `${prefix}-mac.yml`;
  } else {
    return `${prefix}.yml`;
  }
}

const hasBeta = /beta/i;

function isBetaChannel(): boolean {
  return hasBeta.test(packageJson.version);
}

function isVersionNewer(newVersion: string): boolean {
  const { version } = packageJson;

  return gt(newVersion, version);
}

export function getVersion(yaml: string): string | undefined {
  const info = parseYaml(yaml);

  if (info && info.version) {
    return info.version;
  }

  return;
}

export function getArch(): typeof process.arch {
  if (process.platform !== 'darwin' || process.arch === 'arm64') {
    return process.arch;
  }

  if (app.runningUnderARM64Translation) {
    console.log('updater: running under ARM64 translation');
    return 'arm64';
  }

  console.log('updater: NOT running under ARM64 translation');
  return process.arch;
}

const validFile = /^[A-Za-z0-9.-]+$/;
export function isUpdateFileNameValid(name: string): boolean {
  return validFile.test(name);
}

export function getUpdateFileName(
  yaml: string,
  platform: typeof process.platform,
  arch: typeof process.arch
): string {
  const info = parseYaml(yaml);

  let path: string | undefined;
  if (platform === 'darwin') {
    const { files } = info;

    const candidates = files.filter((file: { url: any }) => {
      const url = file?.url;
      if (url?.includes(arch) && url?.endsWith('.zip')) {
        return true;
      }

      return false;
    });

    if (candidates.length === 1) {
      path = candidates[0].url;
    }
  }

  // use default path
  path = path ?? info.path;

  if (!path) {
    throw new Error('no available update file path.');
  }

  if (!isUpdateFileNameValid(path)) {
    throw new Error(
      `getUpdateFileName: Path '${path}' contains invalid characters`
    );
  }

  return path;
}

function parseYaml(yaml: string): any {
  return safeLoad(yaml, { schema: FAILSAFE_SCHEMA, json: true });
}

async function getUpdateYaml(channel: ChannelType): Promise<string> {
  const targetUrl = getUpdateCheckUrl(channel);
  const body = await got(targetUrl, getGotOptions()).text();
  if (!body) {
    throw new Error('Got unexpected response back from update check');
  }

  return body;
}

function getBaseTempDir() {
  // We only use tmpdir() when this code is run outside of an Electron app (as in: tests)
  return app ? join(app.getPath('userData'), 'temp') : os.tmpdir();
}

export async function createTempDir() {
  const baseTempDir = getBaseTempDir();
  const uniqueName = getGuid();
  const targetDir = join(baseTempDir, uniqueName);
  await mkdirp(targetDir);

  return targetDir;
}

export async function deleteTempDir(targetDir: string) {
  const pathInfo = statSync(targetDir);
  if (!pathInfo.isDirectory()) {
    throw new Error(
      `deleteTempDir: Cannot delete path '${targetDir}' because it is not a directory`
    );
  }

  const baseTempDir = getBaseTempDir();
  if (!targetDir.startsWith(baseTempDir)) {
    throw new Error(
      `deleteTempDir: Cannot delete path '${targetDir}' since it is not within base temp dir`
    );
  }

  await rimrafPromise(targetDir);
}

export async function deleteBaseTempDir() {
  const baseTempDir = getBaseTempDir();
  await rimrafPromise(baseTempDir);
}

// Manual check for updates

async function showUpToDateDialog(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType
) {
  const detail = messages.update_up_to_date_detail.message;
  const options: MessageBoxOptions = {
    type: 'info',
    buttons: [messages.ok.message],
    message: messages.update_up_to_date_title.message,
    detail: detail.replace('$a$', packageJson.version),
  };

  await dialog.showMessageBox(getMainWindow(), options);
}

async function showFoundUpdateDialog(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  newVersion: string
) {
  const title = messages.update_new_version_found_title.message;
  const options: MessageBoxOptions = {
    type: 'info',
    buttons: [messages.ok.message],
    message: title.replace('$a$', newVersion),
    detail: messages.update_new_version_found_detail.message,
    // signal: dialogAbort.signal,
  };

  await dialog.showMessageBox(getMainWindow(), options);
}

async function showUpdateErrorDialog(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType
) {
  const options: MessageBoxOptions = {
    type: 'info',
    buttons: [messages.ok.message],
    message: messages.update_error_title.message,
    detail: messages.update_error_detail.message,
    // signal: dialogAbort.signal,
  };

  await dialog.showMessageBox(getMainWindow(), options);
}

async function showNotSupportedOSErrorDialog(
  getMainWindow: () => BrowserWindow,
  messages: MessagesType,
  updateDetail: UpdateDetail
) {
  const title = messages.update_new_version_found_title.message;

  const options: MessageBoxOptions = {
    type: 'info',
    buttons: [messages.ok.message],
    message: title.replace('$a$', updateDetail.version),
    detail: messages.cannotUpdateDueToUnsupportedOS.message,
    // signal: dialogAbort.signal,
  };

  await dialog.showMessageBox(getMainWindow(), options);
}

export async function doManualCheckForUpdates(
  helpers: Helpers,
  messages: MessagesType,
  logger: LoggerType,
  checkDownloadAndInstall: (
    helpers: Helpers,
    messages: MessagesType,
    logger: LoggerType
  ) => Promise<void>
) {
  const { getMainWindow } = helpers;

  try {
    const result = await checkForUpdates(helpers, logger);
    if (result) {
      // run check download and install
      setImmediate(checkDownloadAndInstall, helpers, messages, logger);

      // show found updates dialog
      await showFoundUpdateDialog(getMainWindow, messages, result.version);
    } else {
      // show up-to-date dialog
      await showUpToDateDialog(getMainWindow, messages);
    }
  } catch (error) {
    logger.error('manualCheckForUpdates: ', toLogFormat(error));

    if (error instanceof UnsupportedOSError) {
      await showNotSupportedOSErrorDialog(
        getMainWindow,
        messages,
        error.detail
      );
      return;
    }

    // show update error dialog
    await showUpdateErrorDialog(getMainWindow, messages);
  }
}
