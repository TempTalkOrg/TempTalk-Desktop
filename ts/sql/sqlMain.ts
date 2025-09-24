// install sql worker
// and forward messages bettween worker and render

import { consoleLogger } from '../logger/consoleLogger';
import { LoggerType } from '../logger/types';
import { WorkerAccelerator } from './sqlWorkerWrapper/workerAccelerator';
import { WorkerDatabase } from './sqlWorkerWrapper/workerDatabase';
import { WrappedCallResult } from './sqlWorkerWrapper/types';
import { MethodCache } from './utils/methodCache';
import { logSeqId, shouldTrace } from '../logger/utils';
import { InitDBOption, CloseDBOption } from './dbInterface';
import { checkDiskAvailable, copyFileWithLog } from './utils/fileUtils';

import path from 'node:path';
import fsPromise from 'node:fs/promises';

const SQL_JSON = 'sql.json';
const CONFIG_JSON = 'config.json';

export class MainSQL {
  private workerDatabase: WorkerDatabase;
  private workerAccelerator: WorkerAccelerator;

  private methodCache: MethodCache = new MethodCache();

  private isReady = false;
  private onReady: Promise<any> | undefined;

  // // This promise is resolved when any of the queries that we run against the
  // // database reject with a corruption error (see `isCorruptionError`)
  // private readonly onCorruption: Promise<Error>;

  private logger?: LoggerType;

  private configDir?: string;

  constructor() {
    this.workerDatabase = new WorkerDatabase();
    this.workerAccelerator = new WorkerAccelerator();
  }

  private getLogger() {
    return this.logger || consoleLogger;
  }

  private getWorkerByMethod(method: string) {
    return this.methodCache.getByMethod(method) || this.workerDatabase;
  }

  private async migrateFromMainToAcc() {
    const oldCount = await this.workerDatabase.sqlCallEasy(
      'getUnprocessedCount'
    );
    if (!oldCount) {
      return;
    }

    const all = await this.workerDatabase.sqlCallEasy('getAllUnprocessed');
    while (all.length) {
      const items = all.splice(0, 50);
      const options = { forceSave: true };

      await this.workerAccelerator.sqlCallEasy(
        'saveUnprocesseds',
        items,
        options
      );

      await this.workerAccelerator.sqlCallEasy(
        'updateUnprocessedsWithData',
        items.map((item: { id: string }) => ({ id: item.id, data: item }))
      );
    }

    await this.workerDatabase.sqlCallEasy('removeAllUnprocessed');
  }

  private async getSqlFilesSize() {
    const logger = this.getLogger();

    const dbSizes = await Promise.all<number>([
      this.workerDatabase.sqlCallEasy('getFilesSize'),
      this.workerAccelerator.sqlCallEasy('getFilesSize'),
    ]);

    logger.info('get db files size:', dbSizes);

    return dbSizes[0] + dbSizes[1];
  }

  public async initialize(options: InitDBOption): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    const { configDir, logger } = options;
    if (logger) {
      this.logger = logger;
    }

    const realOptions = { ...options, logger: this.getLogger() };

    this.onReady = Promise.all([
      this.workerDatabase.initialize(realOptions),
      this.workerAccelerator.initialize(realOptions),
    ]);
    await this.onReady;

    // migrate old data from main to acc
    await this.migrateFromMainToAcc();

    const methods = await this.workerAccelerator.getSQLMethods();
    this.methodCache.mapAddMethods(this.workerAccelerator, methods);

    this.onReady = undefined;
    this.isReady = true;
    this.configDir = configDir;
  }

  public async close(exit: boolean, options?: CloseDBOption): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    await Promise.all([
      this.workerDatabase.close(exit, options),
      this.workerAccelerator.close(exit, options),
    ]);
  }

  public async removeDB(): Promise<void> {
    await Promise.all([
      this.workerDatabase.removeDB(),
      this.workerAccelerator.removeDB(),
    ]);
  }

  public async rekey(newKey: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    // rekey main db first
    await this.workerDatabase.rekey(newKey);
    await this.workerAccelerator.rekey(newKey);
  }

  public async backup() {
    const logger = this.getLogger();

    const configDir = this.configDir;
    if (!configDir) {
      logger.warn('config directory is not set');
      throw new Error('No config directory');
    }

    const dbSize = await this.getSqlFilesSize();
    await checkDiskAvailable(configDir, dbSize, logger);

    const targetDir = path.join(configDir, 'sql', `sqlBackup-${Date.now()}`);

    try {
      await Promise.all([
        this.workerDatabase.backup(targetDir),
        this.workerAccelerator.backup(targetDir),
      ]);

      await copyFileWithLog(configDir, targetDir, SQL_JSON, false, logger);
      await copyFileWithLog(configDir, targetDir, CONFIG_JSON, true, logger);
    } catch (error) {
      logger.error('backup failed:', error);

      try {
        await fsPromise.rm(targetDir, { recursive: true });
      } catch (error) {
        logger.warn('remove failure backup failed', error);
      }

      throw new Error('backup database error');
    }
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

    const worker = this.getWorkerByMethod(method);
    const result = await worker.sqlCall(method, ...args);

    if (result) {
      result.worker = worker.getLogTag();
    }

    const { duration, seqId } = result || {};
    if (shouldTrace(duration)) {
      this.getLogger().info(
        `[Main-${result?.worker}]: SQL response ${logSeqId(seqId)}`,
        `${method} duration=${duration}ms`
      );
    }

    return result;
  }

  public async sqlCallEasy(method: string, ...args: ReadonlyArray<any>) {
    const wrappedResult = await this.sqlCall(method, ...args);
    return wrappedResult.result;
  }
}
