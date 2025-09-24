export type LogFunction = (...args: Array<unknown>) => void;

export type LoggerType = {
  fatal: LogFunction;
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  trace: LogFunction;
};

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
