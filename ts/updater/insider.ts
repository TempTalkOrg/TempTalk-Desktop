import config from 'config';
import insiderConfig from '../../app/insider_config';
import { isLinux } from '../OS';
import { hexToBinary, verifyUrlSig } from './signature';

// @ts-ignore
import * as packageJson from '../../package.json';
import { toLogFormat } from '../types/errors';

function getInsiderUpdatesBase(): string | null {
  try {
    if (!insiderConfig.get('channelEnabled')) {
      console.log('updater: using production updates channel.');
      return null;
    }

    const url = insiderConfig.get('updatesUrl') as string;
    if (!url) {
      throw new Error('updater: insider no valid url');
    }

    const sig = insiderConfig.get('urlSig') as string;
    if (!sig) {
      throw new Error('updater: insider no valid sig');
    }

    const publicKey = hexToBinary(config.get('updatesPublicKey'));

    const appId = `org.difft.${packageJson.name.replace('yelling', 'chative')}`;

    if (!verifyUrlSig(publicKey, appId, url, sig)) {
      throw new Error('updater: insider failed to verify url signature');
    }

    console.log('updater: using insider updates channel.');

    return url;
  } catch (error) {
    console.log('updater: insider getUpdatesBase failed', toLogFormat(error));
    console.log('updater: fallback to use production updates channel.');
  }

  return null;
}

let insiderUpdatesUrl: string | undefined | null = undefined;

export function getUpdatesBase(): string | null {
  if (insiderUpdatesUrl === undefined) {
    // do not support update on linux
    if (isLinux()) {
      insiderUpdatesUrl = null;
    } else {
      insiderUpdatesUrl = getInsiderUpdatesBase();
    }
  }
  return insiderUpdatesUrl;
}

export function isInsiderUpdate() {
  return !!getUpdatesBase();
}
