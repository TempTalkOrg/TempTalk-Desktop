import SQL from '@signalapp/better-sqlite3';
import type { Database } from '@signalapp/better-sqlite3';

import { LoggerType } from '../../logger/types';
import { formatError } from '../../logger/utils';
import { consoleLogger } from '../../logger/consoleLogger';

import {
  backup,
  calcFilesSize,
  isValidDBKey,
  keyDatabase,
  pragmaRun,
  rekeyDatabase,
  switchToWAL,
} from '../utils/sqlUtils';

import { isString } from 'lodash';

import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import { join } from 'path';

import { CloseDBOption, ILocalDatabase, InitDBOption } from '../dbInterface';

export class Sqlite3Database implements ILocalDatabase {
  private db: Database | undefined;
  private dbFilePath: string | undefined;
  private logger: LoggerType;

  constructor(logger?: LoggerType) {
    this.db = undefined;

    if (logger) {
      this.logger = logger;
    } else {
      this.logger = consoleLogger;
    }
  }

  protected getLogger() {
    return this.logger;
  }

  protected getConnection(): Database {
    if (!this.db) {
      throw new Error('database is not opened.');
    }

    return this.db;
  }

  // close opened connection
  protected closeConnection(options?: CloseDBOption): void {
    const db = this.db;
    if (!db) {
      this.db = undefined;
      return;
    }

    if (options) {
      const logPerf = (func: Function, description: string) => {
        const start = performance.now();
        func();
        const end = performance.now();
        this.getLogger().info(`db: ${description} takes ${end - start}ms`);
      };

      if (options.optimize) {
        logPerf(
          () => pragmaRun(db, 'wal_checkpoint(TRUNCATE)'),
          'wal_checkpoint'
        );

        logPerf(() => {
          // https://www.sqlite.org/lang_analyze.html
          pragmaRun(db, 'analysis_limit=400');
          pragmaRun(db, 'optimize');
        }, 'optimize');
      }

      if (options.vacuum) {
        logPerf(() => db.exec('VACUUM;'), 'vacuum');
      }
    }

    db.close();
    this.db = undefined;
  }

  // try to open db with default cipher_compatibility = 4
  // and migrate schema version
  private openAndMigrateWithNoCipherChanges(
    filePath: string,
    key: string
  ): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);
    switchToWAL(db);

    return (this.db = db);
  }

  // try to open db with cipher_compatibility = 3
  // and migrate schema version
  private openAndMigrateWithCompatibility3(
    filePath: string,
    key: string
  ): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);

    // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
    pragmaRun(db, 'cipher_compatibility = 3');

    return (this.db = db);
  }

  // migrate cipher_compatibility from 3 to 4
  private openWithCipherMigrate(filePath: string, key: string): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);

    pragmaRun(db, 'cipher_migrate');
    switchToWAL(db);

    return (this.db = db);
  }

  // open db and migrate schema_version and cipher_compatibility
  private openAndMigrateDatabase(filePath: string, key: string): Database {
    // First, we try to open the database without any cipher changes
    try {
      return this.openAndMigrateWithNoCipherChanges(filePath, key);
    } catch (error) {
      this.logger.error(
        'openAndMigrateDatabase: Migration without cipher change failed',
        formatError(error)
      );
    }

    try {
      // If that fails, we try to open the database with 3.x compatibility to extract the
      //   user_version (previously stored in schema_version, blown away by cipher_migrate).
      this.openAndMigrateWithCompatibility3(filePath, key);

      // After migrating user_version -> schema_version, we reopen database, because we can't
      //   migrate to the latest ciphers after we've modified the defaults.
      return this.openWithCipherMigrate(filePath, key);
    } catch (error) {
      this.logger.error(
        'openAndMigrateDatabase: Cipher compatibilty migration failed',
        formatError(error)
      );
      this.closeConnection();

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('openAndMigrateDatabase failed');
      }
    }
  }

  // open db with sql cipher and return db instance
  private openWithSQLCipher(filePath: string, key: string): Database {
    if (!isValidDBKey(key)) {
      throw new Error(`setupSQLCipher: key '${key}' is not valid`);
    }

    return this.openAndMigrateDatabase(filePath, key);
  }

  protected getDBDirPath(configDir: string, sqlFolder?: string): string {
    return join(configDir, typeof sqlFolder === 'string' ? sqlFolder : 'sql');
  }

  protected getDBFilePath(_dbDir: string): string {
    throw new Error('Method not implemented.');
  }

  protected updateSchema(_db: Database, _logger: LoggerType) {
    throw new Error('Method not implemented.');
  }

  protected testWithSQL(_db: Database) {
    throw new Error('Method not implemented.');
  }

  public initialize(options: InitDBOption): void {
    const { configDir, key, logger, sqlFolder } = options || {};

    if (!isString(configDir)) {
      throw new Error('initialize: configDir is required!');
    }

    if (!isString(key)) {
      throw new Error('initialize: key is required!');
    }

    if (logger) {
      this.logger = logger;
    }

    try {
      const dbDirPath = this.getDBDirPath(configDir, sqlFolder);
      mkdirp.sync(dbDirPath);

      const dbFilePath = this.getDBFilePath(dbDirPath);
      const db = this.openWithSQLCipher(dbFilePath, key);

      // For profiling use:
      // pragmaRun(db, "cipher_profile='sqlProfile.log'");

      this.updateSchema(db, this.logger);

      // test database
      this.testWithSQL(db);

      this.dbFilePath = dbFilePath;
    } catch (error) {
      this.logger.error('Database startup error:', formatError(error));

      this.closeConnection();
      throw error;
    }
  }

  public close(options?: CloseDBOption) {
    this.closeConnection(options);
  }

  public removeDB(): void {
    const dbFilePath = this.dbFilePath;
    if (!dbFilePath) {
      throw new Error('removeDB: database filePath was not set!');
    }

    if (this.db) {
      throw new Error('removeDB: Cannot erase database when it is open!');
    }

    rimraf.sync(dbFilePath);
    rimraf.sync(`${dbFilePath}-shm`);
    rimraf.sync(`${dbFilePath}-wal`);
  }

  public rekey(newKey: string) {
    if (!isValidDBKey(newKey)) {
      throw new Error('invalid new db key.');
    }

    const db = this.getConnection();
    rekeyDatabase(db, newKey);
  }

  public backup(backupDir: string) {
    if (!this.dbFilePath) {
      throw new Error('backup: database filePath was not set!');
    }

    backup(backupDir, this.dbFilePath, this.logger);
  }

  public getFilesSize() {
    if (!this.dbFilePath) {
      throw new Error('getFilesSize: database filePath was not set!');
    }

    return calcFilesSize(this.dbFilePath, this.logger);
  }
}
