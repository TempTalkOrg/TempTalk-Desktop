// Note: Zero third-party dependencies allowed. Keep it pure.
import { formatWithOptions } from 'node:util';

const ELECTRON_CLASS_PREFIX = [
  'Browser',
  'WebContents',
  'Ipc',
  'App',
  'Session',
  'Menu',
  'Tray',
  'Process',
  'NativeImage',
];

type ExtendedError = Error & {
  code?: number;
  response?: { status: number; reason: string };
};

function safeSanitize(value: any) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  try {
    if (value === global) {
      return '[Global: Env]';
    }

    if (typeof Node !== 'undefined' && value instanceof Node) {
      return `[HTMLElement: ${value.nodeName}]`;
    }

    if (typeof Event !== 'undefined' && value instanceof Event) {
      return `[Event: ${value.type}]`;
    }

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      return `[Buffer: ${value.length} bytes]`;
    }

    if (value instanceof Error) {
      const { name, code, message, stack, response } = value as ExtendedError;
      const error: ExtendedError = {
        name,
        code,
        message,
      };

      // log more details for HTTPError like errors
      if (response && typeof response === 'object') {
        const { status, reason } = response;
        if (status || reason) {
          error.response = { status, reason };
        }
      }

      // error is printed in insertion order, so we put the stack field at the end
      if (stack) {
        error.stack = stack;
      }

      return error;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const objectName = value.constructor?.name || '';
    if (ELECTRON_CLASS_PREFIX.some(prefix => objectName.startsWith(prefix))) {
      return `[Electron: ${objectName}]`;
    }

    if (['process', 'Window', 'HTMLDocument'].includes(objectName)) {
      return `[Global: ${objectName}]`;
    }

    return value;
  } catch (_e) {
    return '[UnreadableObject]';
  }
}

export function safeFormat(...args: any[]) {
  const inspectOpts = {
    depth: 5,
    breakLength: Infinity,
    compact: true,
    showHidden: false,
    // colors: false,
    // maxArrayLength: 100,
    // maxStringLength: 10000,
  };
  return formatWithOptions(inspectOpts, ...args.map(safeSanitize));
}
