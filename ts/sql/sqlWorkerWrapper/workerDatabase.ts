import { Worker } from 'worker_threads';

import { join } from 'path';
import { LoggerType } from '../../logger/types';
import { consoleLogger } from '../../logger/consoleLogger';
import { WorkerData, WrappedCallResult } from './types';
import { CallRequest, CallResponse, WorkerResponse } from '../sqlWorkers/types';
import { logSeqId } from '../../logger/utils';
import { handleLog } from './logger';
import { CloseDBOption, InitDBOption } from '../dbInterface';

// type of worker
type WorkerJob = {
  request: CallRequest;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
};

export class WorkerDatabase {
  private readonly worker: Worker;

  private key: string | undefined;

  private isReady = false;

  private onReady: Promise<void> | undefined;

  private readonly onExit: Promise<void>;

  // // This promise is resolved when any of the queries that we run against the
  // // database reject with a corruption error (see `isCorruptionError`)
  // private readonly onCorruption: Promise<Error>;

  private seqId = 0;

  private logger?: LoggerType;

  private workerJobs = new Map<number, WorkerJob>();

  private getLogger() {
    return this.logger || consoleLogger;
  }

  public getLogTag() {
    return 'SIG';
  }

  constructor() {
    const workerPath = join(__dirname, '../sqlWorker.js');
    const workerData: WorkerData = { workerType: 'sql_worker_main' };

    this.worker = new Worker(workerPath, { workerData });

    this.worker.on('message', response => {
      try {
        return this.onMessage(response);
      } catch (error) {
        this.getLogger().error('on message error', error);
      }
    });

    this.onExit = new Promise<void>(resolve => {
      this.worker.once('exit', resolve);
    });
  }

  private send<Response>(request: CallRequest): Promise<Response> {
    const { seqId } = this;
    this.seqId += 1;

    const promise = new Promise<Response>((resolve, reject) => {
      this.workerJobs.set(seqId, { resolve, reject, request });
    });

    this.worker.postMessage({ ...request, seqId });

    return promise;
  }

  private onMessage(workerResponse: WorkerResponse) {
    switch (workerResponse.type) {
      case 'log':
        handleLog(this.getLogger(), workerResponse, this.getLogTag());
        break;
      case 'response':
        this.handleResponse(workerResponse);
        break;
      default:
        break;
    }
  }

  private async dbCall(
    method: string,
    ...args: ReadonlyArray<any>
  ): Promise<void> {
    if (!method) {
      throw new Error('method can not be empty');
    }

    return this.send({ type: 'dbCall', method, args });
  }

  public async sqlCall(
    method: string,
    ...args: ReadonlyArray<any>
  ): Promise<WrappedCallResult> {
    if (this.onReady) {
      await this.onReady;
    }

    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    return await this.send<WrappedCallResult>({
      type: 'sqlCall',
      method,
      args,
    });
  }

  public async sqlCallEasy(method: string, ...args: ReadonlyArray<any>) {
    const wrappedResult = await this.sqlCall(method, ...args);
    return wrappedResult.result;
  }

  private handleResponse(response: CallResponse) {
    const { seqId } = response;

    const job = this.workerJobs.get(seqId);
    this.workerJobs.delete(seqId);
    if (!job) {
      throw new Error('Unexpected worker response for:' + logSeqId(seqId));
    }

    const { resolve, reject } = job;
    const { result, error } = response;
    if (error) {
      const errObj = new Error(error);
      reject(errObj);
    } else {
      resolve({ ...result, seqId });
    }
  }

  public async initialize(options: InitDBOption): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    const { configDir, key, logger, sqlFolder } = options;
    if (logger) {
      this.logger = logger;
    }

    this.onReady = this.send({
      type: 'dbCall',
      method: 'initialize',
      args: [{ configDir, key, sqlFolder }],
    });

    await this.onReady;

    this.onReady = undefined;
    this.isReady = true;
    this.key = key;
  }

  public async close(exit: boolean, options?: CloseDBOption): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    await this.sqlCall('close', options);

    if (exit) {
      this.worker.terminate();
      await this.onExit;
    }
  }

  public async removeDB(): Promise<void> {
    return this.dbCall('removeDB');
  }

  public async rekey(newKey: string): Promise<void> {
    await this.sqlCall('rekey', newKey);
    this.key = newKey;
  }

  public async backup(backupDir: string, newKey?: string) {
    if (!this.key) {
      throw Error(`[${this.getLogTag()}]backup failed: db was not opened`);
    }

    await this.dbCall('backup', backupDir);

    //strip backed database
    try {
      const worker = new WorkerDatabase();
      await worker.initialize({
        configDir: backupDir,
        key: this.key,
        logger: this.getLogger(),
        sqlFolder: '.', // use current configDir folder as sql folder
      });

      if (newKey) {
        // clear password
        await worker.sqlCall('removeItemById', 'password');
        await worker.rekey(newKey);
      }

      await worker.close(true, { optimize: true, vacuum: true });
    } catch (error) {
      this.getLogger().error(error);
      throw Error(
        `[${this.getLogTag()}]backup failed: strip backed db failed.`
      );
    }
  }
}
