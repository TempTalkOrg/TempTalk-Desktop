// worker file
// must be called run as a worker thread

import { parentPort } from 'worker_threads';
if (!parentPort) {
  throw new Error('Must run sql worker as a worker thread');
}

import { LoggerType, LogLevel } from '../../logger/types';
import { formatError, logSeqId, shouldTrace } from '../../logger/utils';
import { ILocalDBDatabase } from '../dbInterface';
import { SqliteDatabase } from '../sqlDatabases/dbDatabase';
import { WorkerRequest } from './types';

const port = parentPort;

// logger
const log = (level: LogLevel, args: Array<unknown>): void => {
  const now = new Date();
  port.postMessage({ type: 'log', level, args: [now.toISOString(), ...args] });
};

const logger: LoggerType = {
  fatal(...args: Array<unknown>) {
    log('fatal', args);
  },
  error(...args: Array<unknown>) {
    log('error', args);
  },
  warn(...args: Array<unknown>) {
    log('warn', args);
  },
  info(...args: Array<unknown>) {
    log('info', args);
  },
  debug(...args: Array<unknown>) {
    log('debug', args);
  },
  trace(...args: Array<unknown>) {
    log('trace', args);
  },
};

function respond(seqId: number, error: Error | undefined, result?: any) {
  port.postMessage({
    type: 'response',
    seqId,
    error: error?.message || error?.stack,
    result,
  });
}

async function handleWorkRequest(
  { seqId, type, method, args }: WorkerRequest,
  db: ILocalDBDatabase
) {
  const start = Date.now();
  const getDuration = () => Date.now() - start;

  try {
    let result = undefined;

    switch (type) {
      case 'dbCall':
        const dbMethod = (db as any)[method];
        if (typeof dbMethod !== 'function') {
          throw new Error(`Invalid db method: ${method}`);
        }

        dbMethod.apply(db, args);
        break;
      case 'sqlCall':
        const sqlMethod = (db as any)[method];
        if (typeof sqlMethod !== 'function') {
          throw new Error(`Invalid sql method: ${method}`);
        }

        result = sqlMethod.apply(db, args);
        break;
      default:
        throw new Error(`Unexpected request type: ${type}`);
    }

    const duration = getDuration();
    if (shouldTrace(duration)) {
      logger.info(
        `SQL slow query ${logSeqId(seqId)} ${method}`,
        `duration=${duration}ms`
      );
    }

    respond(seqId, undefined, { result, duration });
  } catch (error: any) {
    logger.error(
      `SQL error query ${logSeqId(seqId)} ${method}`,
      `duration=${getDuration()}ms`,
      formatError(error)
    );

    respond(seqId, error);
  }
}

export class WorkerDatabase {
  constructor() {
    const db: ILocalDBDatabase = new SqliteDatabase(logger);

    port.on('message', async (request: WorkerRequest) =>
      handleWorkRequest(request, db)
    );
  }
}
