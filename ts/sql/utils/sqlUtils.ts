import type { Database, Statement } from '@opensource-lib/better-sqlite3';
import { isNumber, groupBy, Dictionary, last } from 'lodash';
import type {
  EmptyQuery,
  ExtendedTableType,
  JSONRows,
  Query,
  SQLType,
  TableType,
} from '../sqlTypes';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

import type { LoggerType } from '../../logger/types';
import { calcFileSize } from './fileUtils';

const INVALID_KEY_REGEX = /[^0-9A-Fa-f]/;
export function isValidDBKey(key: string) {
  return !INVALID_KEY_REGEX.exec(key);
}

export function objectToJSON<T>(data: T): string {
  return JSON.stringify(data);
}

export function jsonToObject<T>(json: string): T {
  return JSON.parse(json);
}

export function mapWithJsonToObject<T>(jsons: Array<string>): Array<T> {
  return jsons.map(json => jsonToObject(json));
}

export function traverseJsonObject(
  key: string,
  obj: any,
  callback: (key: string, value: any, ancestors: any[]) => boolean,
  ancestors: any[] = []
) {
  if (obj && typeof obj === 'object') {
    const nextAncesters = ancestors.concat([{ [key]: obj }]);

    for (const subKey in obj) {
      const subValue = obj[subKey];
      const stop = callback(subKey, subValue, nextAncesters);
      if (stop) {
        return true;
      }

      if (traverseJsonObject(subKey, subValue, callback, nextAncesters)) {
        return true;
      }
    }
  }
  return false;
}

export function pragmaGet(db: Database, pragmaKey: string) {
  return db.pragma(pragmaKey, { simple: true });
}

export function pragmaRun(db: Database, pragmaCmd: string): void {
  return db.pragma(pragmaCmd);
}

export function keyDatabase(db: Database, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  pragmaRun(db, `key = "x'${key}'"`);
}

export function rekeyDatabase(db: Database, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  pragmaRun(db, `rekey = "x'${key}'"`);
}

export function switchToWAL(db: Database): void {
  // https://sqlite.org/wal.html
  pragmaRun(db, 'journal_mode = WAL');
  pragmaRun(db, 'synchronous = FULL');
  pragmaRun(db, 'fullfsync = ON');
}

export function getSQLiteVersion(db: Database): string {
  const { sqlite_version: version } = db
    .prepare<EmptyQuery>('select sqlite_version() AS sqlite_version;')
    .get();

  return version;
}

export function getSchemaVersion(db: Database): number {
  return pragmaGet(db, 'schema_version');
}

export function getSQLCipherVersion(db: Database): string | undefined {
  return pragmaGet(db, 'cipher_version');
}

export function setUserVersion(db: Database, version: number): void {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }

  pragmaRun(db, `user_version = ${version}`);
}

export function getUserVersion(db: Database): number {
  return pragmaGet(db, 'user_version');
}

export function countTableRows(db: Database, table: ExtendedTableType): number {
  const result: null | number = db
    .prepare<EmptyQuery>(`SELECT COUNT(*) FROM ${table};`)
    .pluck()
    .get();

  if (isNumber(result)) {
    return result;
  }

  throw new Error(`countTableRows: Unable to count rows of table ${table}`);
}

// This value needs to be below SQLITE_MAX_VARIABLE_NUMBER.
const MAX_VARIABLE_COUNT = 100;

export function batchQueryWithMultiVar<ValueT, ResultT>(
  db: Database,
  values: Array<ValueT>,
  query:
    | ((batch: Array<ValueT>) => void)
    | ((batch: Array<ValueT>) => Array<ResultT>)
): Array<ResultT> {
  if (values.length > MAX_VARIABLE_COUNT) {
    const result: Array<ResultT> = [];
    db.transaction(() => {
      for (let i = 0; i < values.length; i += MAX_VARIABLE_COUNT) {
        const batch = values.slice(i, i + MAX_VARIABLE_COUNT);
        const batchResult = query(batch);
        if (Array.isArray(batchResult)) {
          result.push(...batchResult);
        }
      }
    })();
    return result;
  }

  const result = query(values);
  return Array.isArray(result) ? result : [];
}

export function getCreateSQL(db: Database, type: SQLType, tableName: string) {
  const rows = StatementCache.prepare<Query>(
    db,
    `
    SELECT name, sql FROM sqlite_master
    WHERE type=$type
      AND tbl_name=$tbl_name;
    `
  ).all({ type, tbl_name: tableName });

  return rows.filter(r => r.sql);
}

export function getAllCreateSQLs(
  db: Database,
  tableName: TableType
): Dictionary<any[]> {
  const rows = StatementCache.prepare<Query>(
    db,
    `SELECT type, name, sql FROM sqlite_master WHERE tbl_name=$tbl_name;`
  ).all({ tbl_name: tableName });

  return groupBy(
    rows.filter(r => r.sql),
    r => r.type
  );
}

export function generateUUID() {
  return uuidv4();
}

export function calcFilesSize(dbFilePath: string, logger: LoggerType) {
  let totalSize = 0;

  totalSize += calcFileSize(dbFilePath, true, logger);
  totalSize += calcFileSize(`${dbFilePath}-shm`, false, logger);
  totalSize += calcFileSize(`${dbFilePath}-wal`, false, logger);

  return totalSize;
}

// backup db files to target folder
export function backup(
  backupDir: string,
  dbFilePath: string,
  logger: LoggerType
) {
  if (!backupDir) {
    throw new Error('backup: invalid backup dir path');
  }

  mkdirp.sync(backupDir);

  if (!fs.existsSync(dbFilePath)) {
    logger.info('backup: database file does not exists', dbFilePath);
    throw new Error('backup: database file does not exists');
  }

  const dbFile = path.basename(dbFilePath);
  const dbFolder = path.dirname(dbFilePath);

  // must be synchronous copy to avoid db changed during copying
  fs.copyFileSync(
    dbFilePath,
    path.join(backupDir, dbFile),
    fs.constants.COPYFILE_EXCL
  );

  logger.info('backup: success copy', dbFile);

  const copyCache = (name: string) => {
    const cacheFile = `${dbFile}-${name}`;
    const cachePath = path.join(dbFolder, cacheFile);
    if (fs.existsSync(cachePath)) {
      fs.copyFileSync(
        cachePath,
        path.join(backupDir, cacheFile),
        fs.constants.COPYFILE_EXCL
      );

      logger.info('backup: success copy', cacheFile);
    }
  };

  copyCache('shm');
  copyCache('wal');
}

type QueryStatementMap = Map<string, Statement<Array<unknown>>>;
export class StatementCache {
  private static readonly stmCache = new WeakMap<Database, QueryStatementMap>();

  static prepare<T extends Array<unknown> | Record<string, unknown>>(
    db: Database,
    query: string
  ): Statement<T> {
    let statement;
    let cachedStms = this.stmCache.get(db);

    if (cachedStms) {
      statement = cachedStms.get(query) as Statement<T>;
    } else {
      cachedStms = new Map();
      this.stmCache.set(db, cachedStms);
    }

    if (!statement) {
      statement = db.prepare<T>(query);
      cachedStms.set(query, statement);
    }

    return statement;
  }
}

export class TableIterator<ObjectType extends { id: string }> {
  constructor(
    private readonly db: Database,
    private readonly table: TableType,
    private readonly pageSize = 100
  ) {}

  *[Symbol.iterator](): Iterator<ObjectType> {
    const minIdRow: { id: string; json: string } = this.db
      .prepare(`SELECT MIN(id) AS id, json FROM ${this.table};`)
      .get();

    if (minIdRow === undefined) {
      // there is no records in the table
      return;
    }

    const minIdObject = jsonToObject<ObjectType>(minIdRow.json);
    let id = minIdObject.id;
    let pageSize = this.pageSize - 1;
    const objects: ObjectType[] = [minIdObject];

    const fetchStmt = this.db.prepare(
      `
      SELECT
        json
      FROM
        ${this.table}
      WHERE
        id > $id
      ORDER BY id ASC
      LIMIT $pageSize;
      `
    );

    while (true) {
      const rows: JSONRows = fetchStmt.all({ id, pageSize });

      rows.forEach(row => objects.push(jsonToObject(row.json)));

      const lastObject: ObjectType | undefined = last(objects);
      if (!lastObject) {
        break;
      }

      ({ id } = lastObject);

      yield* objects;

      if (objects.length < pageSize) {
        // iterate to the end
        break;
      }

      objects.length = 0;
      pageSize = this.pageSize;
    }
  }
}
