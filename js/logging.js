/* eslint-env node */

/* eslint strict: ['error', 'never'] */
/* eslint-disable no-console */

const electron = require('electron');
const ipc = electron.ipcRenderer;

// Backwards-compatible logging, simple strings and no level (defaulted to INFO)
function now() {
  const date = new Date();
  return date.toJSON();
}

const jsonReplacer = (objectCache, value) => {
  const type = typeof value;

  // These basic types should be passed through and let JSON handle them by default
  // undefined, symbol, and function values will be dropped during JSON serialization
  if (['boolean', 'string', 'undefined', 'symbol', 'function'].includes(type)) {
    return value;
  }

  if (type === 'bigint') {
    return `${value.toString()}n`;
  }

  if (type === 'number') {
    if (Number.isNaN(value)) {
      return 'NaN';
    } else if (!Number.isFinite(value)) {
      return value.toString();
    } else {
      return value;
    }
  }

  // typeof null === 'object'
  if (value === null) {
    return value;
  }

  if (value instanceof Map) {
    return Array.from(value.entries());
  }

  if (value instanceof Set) {
    return Array.from(value.values());
  }

  if (value instanceof Error) {
    const { name, code, message, stack, response } = value;
    const error = {
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

  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer(${value.byteLength})]`;
  }

  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor?.name || 'UnkownView'}(${value.byteLength})]`;
  }

  if (value === global) {
    return '[Global: Env]';
  }

  if (typeof Node !== 'undefined' && value instanceof Node) {
    return `[HTMLElement: ${value.nodeName}]`;
  }

  if (typeof Event !== 'undefined' && value instanceof Event) {
    return `[Event: ${value.type}]`;
  }

  if (type === 'object') {
    if (objectCache.has(value)) {
      return '[Circular]';
    }

    objectCache.add(value);

    const objectName = value.constructor?.name || '';
    if (['process', 'Window', 'HTMLDocument'].includes(objectName)) {
      return `[Global: ${objectName}]`;
    }
  }

  return value;
};

function cleanArgsForIPC(args) {
  const objectCache = new WeakSet();

  return args.map(arg => {
    if (arg === null) {
      return arg;
    }

    const type = typeof arg;
    if (['boolean', 'string', 'undefined'].includes(type)) {
      return arg;
    }

    if (type === 'bigint') {
      return `${arg.toString()}n`;
    }

    if (type === 'number') {
      if (Number.isNaN(arg)) {
        return 'NaN';
      } else if (!Number.isFinite(arg)) {
        return arg.toString();
      } else {
        return arg;
      }
    }

    if (type === 'symbol') {
      return '[Symbol]';
    }

    if (type === 'function') {
      return '[Function]';
    }

    // if (type === 'object') {
    //   // to JSON stringify + parse
    // }

    try {
      return JSON.parse(
        JSON.stringify(arg, (_, value) => {
          try {
            return jsonReplacer(objectCache, value);
          } catch (error) {
            return '[UnreadableValue]';
          }
        })
      );
    } catch (error) {
      return `[Unserializable]: ${Object.prototype.toString.call(arg)}`;
    }
  });
}

function log(...args) {
  logAtLevel('info', 'INFO ', ...args);
}

if (window.console) {
  console._log = console.log;
  console.log = log;
}

// A modern logging interface for the browser

// The Bunyan API: https://github.com/trentm/node-bunyan#log-method-api
function logAtLevel(level, prefix, ...args) {
  console._log(prefix, now(), ...args);

  const cleanedArgs = cleanArgsForIPC(args);
  ipc.send(`log-${level}`, ...cleanedArgs);
}

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

window.log = levels.reduce((acc, level) => {
  acc[level] = (...args) =>
    logAtLevel(level, level.toUpperCase().padEnd(5), ...args);
  return acc;
}, {});

window.onerror = (message, script, line, col, error) => {
  const errorInfo = error && error.stack ? error.stack : JSON.stringify(error);
  window.log.error(`Top-level unhandled error: ${errorInfo}`);
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorString =
    error && error.stack ? error.stack : JSON.stringify(error);
  window.log.error(`Top-level unhandled promise rejection: ${errorString}`);
});
