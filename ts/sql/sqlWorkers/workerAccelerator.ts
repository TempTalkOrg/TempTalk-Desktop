import { expose } from 'threads/worker';
import { Observable, Subject } from 'threads/observable';
import { LoggerType, LogLevel } from '../../logger/types';
import { DBAccelerator } from '../sqlDatabases/dbAccelerator';
import { parentPort } from 'worker_threads';
import { logSeqId, shouldTrace } from '../../logger/utils';

if (!parentPort) {
  throw new Error('Must run sql worker as a worker thread');
}

export class WorkerAccelerator {
  private logSubject = new Subject();

  private log(level: LogLevel, args: Array<unknown>): void {
    const now = new Date();
    this.logSubject.next({
      type: 'log',
      level,
      args: [now.toISOString(), ...args],
    });
  }

  private getLogger(log: Function): LoggerType {
    return {
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
  }

  constructor() {
    const logger = this.getLogger(this.log.bind(this));
    const dbAcc = new DBAccelerator(logger);

    const workerModule: any = {
      getLogObserver: () => Observable.from(this.logSubject),
      getSQLMethods: () => dbAcc.getMethods().map(method => method.name),
    };

    let seqId = 0;

    dbAcc.getMethods().forEach(method => {
      workerModule[method.name] = async (...args: any) => {
        const id = seqId++;
        const start = Date.now();
        const result = await method.call(dbAcc, ...args);
        const duration = Date.now() - start;

        if (shouldTrace(duration)) {
          logger.info(
            `SQL slow query ${logSeqId(seqId)} ${method.name}`,
            `duration=${duration}ms`
          );
        }

        return {
          seqId: id,
          duration,
          result,
        };
      };
    });

    expose(workerModule);
  }
}
