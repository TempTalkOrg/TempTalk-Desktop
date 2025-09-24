import { LoggerType } from './types';

export const consoleLogger: LoggerType = {
  fatal(...args: Array<unknown>) {
    console.error(...args);
  },
  error(...args: Array<unknown>) {
    console.error(...args);
  },
  warn(...args: Array<unknown>) {
    console.warn(...args);
  },
  info(...args: Array<unknown>) {
    console.info(...args);
  },
  debug(...args: Array<unknown>) {
    console.debug(...args);
  },
  trace(...args: Array<unknown>) {
    console.log(...args);
  },
};
