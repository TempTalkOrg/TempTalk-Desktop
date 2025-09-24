import { existsSync, statSync } from 'node:fs';
import fsPromise from 'node:fs/promises';
import path from 'node:path';

import { LoggerType } from '../../logger/types';

export function getExternalFilesForMessage(message: any): Array<string> {
  const { attachments, contacts, quote, forwardContext } = message;
  const files: Array<string> = [];

  if (attachments?.length) {
    attachments.forEach(
      (attachment: { path: any; thumbnail: any; screenshot: any }) => {
        const { path: file, thumbnail, screenshot } = attachment;
        if (file) {
          files.push(file);
        }

        if (thumbnail && thumbnail.path) {
          files.push(thumbnail.path);
        }

        if (screenshot && screenshot.path) {
          files.push(screenshot.path);
        }
      }
    );
  }

  if (quote?.attachments?.length) {
    quote.attachments.forEach((attachment: { thumbnail: any }) => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (contacts?.length) {
    contacts.forEach((item: { avatar: any }) => {
      const { avatar } = item;

      if (avatar && avatar.avatar && avatar.avatar.path) {
        files.push(avatar.avatar.path);
      }
    });
  }

  const walkForward = (forwards: any) => {
    if (forwards instanceof Array) {
      forwards.forEach((forward: { forwards?: any; attachments?: any }) => {
        const { attachments: forwardAttachments } = forward;

        if (forwardAttachments instanceof Array) {
          forwardAttachments.forEach((attachment: any) => {
            const { path: file, thumbnail, screenshot } = attachment;
            if (file) {
              files.push(file);
            }

            if (thumbnail && thumbnail.path) {
              files.push(thumbnail.path);
            }

            if (screenshot && screenshot.path) {
              files.push(screenshot.path);
            }
          });
        }

        walkForward(forward.forwards);
      });
    }
  };

  const { forwards } = forwardContext || {};
  walkForward(forwards);

  return files;
}

export function getExternalFilesForConversation(
  conversation: any
): Array<string> {
  const { avatar, profileAvatar } = conversation;
  const files: Array<string> = [];

  if (avatar?.path) {
    files.push(avatar.path);
  }

  if (profileAvatar?.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

export async function getDiskFreeSpace(targetDir: string) {
  const statFs = await fsPromise.statfs(targetDir);
  return statFs.bavail * statFs.bsize;
}

export function calcFileSize(
  filePath: string,
  throwWhenNotExists: boolean = false,
  logger: LoggerType
) {
  if (!existsSync(filePath)) {
    logger.info('file does not exists', filePath);

    if (throwWhenNotExists) {
      throw new Error('db file not found');
    }

    return 0;
  }

  const stat = statSync(filePath);
  return stat.size;
}

export async function checkDiskAvailable(
  targetDir: string,
  testSize: number,
  logger: LoggerType
) {
  try {
    const availSize = await getDiskFreeSpace(targetDir);

    // minor free space size 100M
    const minFreeSpace = 100 * 1024 * 1024;

    logger.info(
      'available size:',
      availSize,
      'test size:',
      testSize,
      'min free:',
      minFreeSpace
    );

    if (availSize - testSize < minFreeSpace) {
      throw new Error('No enough avalible space on disk!');
    }
  } catch (error) {
    logger.warn('calc available disk size failed', error);
    throw new Error('Can not calculate disk avalible size!');
  }
}

export async function copyFileWithLog(
  sourceDir: string,
  targetDir: string,
  name: string,
  throwErrOnNonExist: boolean,
  logger: LoggerType
) {
  if (!existsSync(path.join(sourceDir, name))) {
    logger.warn('file not exists', name);
    if (throwErrOnNonExist) {
      throw new Error('file not exists');
    } else {
      return;
    }
  }

  try {
    await fsPromise.copyFile(
      path.join(sourceDir, name),
      path.join(targetDir, name),
      fsPromise.constants.COPYFILE_EXCL
    );
    logger.info('copy success', name);
  } catch (error) {
    logger.warn('copy failed', name, error);
    throw new Error('Copy file error');
  }
}
