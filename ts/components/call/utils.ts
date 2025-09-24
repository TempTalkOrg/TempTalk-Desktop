import {
  ExternalE2EEKeyProvider,
  KeyProviderOptions,
  LoggerNames as LiveKitLoggerNames,
  getLogger as LiveKitGetLogger,
} from '@cc-livekit/livekit-client';
import * as loglevelLib from 'loglevel';
import { log as LiveKitComponentsLog } from './modules/react';

export class CustomE2EEKeyProvider extends ExternalE2EEKeyProvider {
  constructor(options: Partial<Omit<KeyProviderOptions, 'sharedKey'>> = {}) {
    super(options);
  }

  async setKey(key: ArrayBuffer) {
    const derivedKey = await crypto.subtle.importKey(
      'raw',
      key,
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
      },
      false,
      ['deriveBits', 'deriveKey']
    );

    this.onSetEncryptionKey(derivedKey);
  }
}

export const makeMessageCollapseId = (
  ourNumber: string,
  deviceId: string,
  timestamp?: number
) => {
  const source = ourNumber;
  const sourceDevice = deviceId;

  const combined = `${timestamp ?? Date.now()}${source}${sourceDevice}`;

  const data = new TextEncoder().encode(combined);
  const md5Buffer = (window as any).digestMD5(data);
  const collapseId = md5Buffer.toString('hex');

  // return lower case
  return collapseId;
};

let loggerInstance: loglevelLib.Logger | null = null;

export function getLogger() {
  if (loggerInstance) {
    return loggerInstance;
  }
  const name = 'livekit-meeting';
  const logLevel = 'debug';

  const logger = loglevelLib.getLogger(name);
  logger.setDefaultLevel(logLevel);

  [
    // meeting logger
    logger,
    // livekit-components logger
    LiveKitComponentsLog,
    // livekit-client logger
    ...Object.values(LiveKitLoggerNames).map(name => LiveKitGetLogger(name)),
  ].forEach(logItem => {
    // const originalFactory = logItem.methodFactory;
    logItem.methodFactory = function (
      methodName: any,
      _: any,
      loggerName: any
    ) {
      // const rawMethod = originalFactory(methodName, logLevel, loggerName);

      return function (...args: any[]) {
        console.log(`[${String(methodName)}][${String(loggerName)}]`, ...args);
      };
    };

    logItem.setLevel(logLevel);
    logItem.rebuild();
  });

  loggerInstance = logger;
  return logger;
}

export const formatTime = (count: number) => {
  if (count === 0) {
    return '';
  }
  const hours = Math.floor(count / 3600);
  const minutes = Math.floor((count % 3600) / 60);
  const seconds = count % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
export function encodeText(text: string) {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

export function decodeText(text: ArrayBuffer | Uint8Array) {
  const decoder = new TextDecoder();
  return decoder.decode(text);
}
