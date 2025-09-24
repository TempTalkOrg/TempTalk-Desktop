import { Database } from '@signalapp/better-sqlite3';
import {
  ArrayQuery,
  EmptyQuery,
  IdentityKeyDBType,
  ItemDBType,
  PreKeyDBType,
  Query,
  RecordWithId,
  RecordWithIdString,
  SessionDBType,
  SignedPreKeyDBType,
  TableType,
} from '../sqlTypes';
import {
  batchQueryWithMultiVar,
  countTableRows,
  jsonToObject,
  mapWithJsonToObject,
  objectToJSON,
  StatementCache,
} from '../utils/sqlUtils';

export class CommonTable {
  private table: TableType;

  constructor(table: TableType) {
    this.table = table;
  }

  protected createOrUpdate<Key extends string | number>(
    db: Database,
    data: Record<string, unknown> & { id: Key }
  ): void {
    const { id } = data;
    if (!id) {
      throw new Error('createOrUpdate: Provided data did not have valid id');
    }

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR REPLACE INTO ${this.table} (
        id,
        json
      ) VALUES (
        $id,
        $json
      );
      `
    ).run({
      id,
      json: objectToJSON(data),
    });
  }

  protected bulkAdd(db: Database, array: RecordWithId[]): void {
    db.transaction(() => {
      for (const data of array) {
        this.createOrUpdate(db, data);
      }
    })();
  }

  protected getById<Key extends string | number, Result = unknown>(
    db: Database,
    id: Key
  ): Result | undefined {
    const json = StatementCache.prepare<Query>(
      db,
      `SELECT json FROM ${this.table} WHERE id = $id;`
    )
      .pluck()
      .get({ id });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  private removeByIds<Key extends string | number>(
    db: Database,
    ids: Key[]
  ): void {
    if (!ids?.length) {
      throw new Error('removeConversation: No id(s) to delete!');
    }

    db.prepare<ArrayQuery>(
      `
      DELETE FROM ${this.table}
      WHERE
        id IN ( ${ids.map(() => '?').join(', ')} );
      `
    ).run(ids);
  }

  protected removeById<Key extends string | number>(
    db: Database,
    id: Key | Key[]
  ): void {
    const ids = Array.isArray(id) ? id : [id];
    // Sqlite SQLITE_MAX_VARIABLE_NUMBER
    batchQueryWithMultiVar(db, ids, ids => this.removeByIds(db, ids));
  }

  protected removeAllFromTable(db: Database): void {
    db.prepare<EmptyQuery>(`DELETE FROM ${this.table};`).run();
  }

  protected getAllFromTable<T>(db: Database): T[] {
    const jsons = db
      .prepare<EmptyQuery>(`SELECT json FROM ${this.table};`)
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  protected getCountFromTable(db: Database): number {
    return countTableRows(db, this.table);
  }
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
export class TableIdentityKeys extends CommonTable {
  constructor() {
    super(IDENTITY_KEYS_TABLE);
  }

  public createOrUpdateIdentityKey(
    db: Database,
    data: IdentityKeyDBType
  ): void {
    return this.createOrUpdate(db, data);
  }

  public getIdentityKeyById(
    db: Database,
    id: string
  ): IdentityKeyDBType | undefined {
    return this.getById(db, id);
  }

  public bulkAddIdentityKeys(db: Database, array: IdentityKeyDBType[]): void {
    return this.bulkAdd(db, array);
  }

  public removeIdentityKeyById(db: Database, id: string): void {
    return this.removeById(db, id);
  }

  public removeAllIdentityKeys(db: Database): void {
    return this.removeAllFromTable(db);
  }

  public getAllIdentityKeys(db: Database): IdentityKeyDBType[] {
    return this.getAllFromTable<IdentityKeyDBType>(db);
  }
}

const PRE_KEYS_TABLE = 'preKeys';
export class TablePreKeys extends CommonTable {
  constructor() {
    super(PRE_KEYS_TABLE);
  }

  public createOrUpdatePreKey(db: Database, data: PreKeyDBType): void {
    return this.createOrUpdate(db, data);
  }

  public getPreKeyById(db: Database, id: string): PreKeyDBType | undefined {
    return this.getById(db, id);
  }

  public bulkAddPreKeys(db: Database, array: PreKeyDBType[]): void {
    return this.bulkAdd(db, array);
  }

  public removePreKeyById(db: Database, id: string): void {
    return this.removeById(db, id);
  }

  public removeAllPreKeys(db: Database): void {
    return this.removeAllFromTable(db);
  }

  public getAllPreKeys(db: Database): PreKeyDBType[] {
    return this.getAllFromTable<PreKeyDBType>(db);
  }
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
export class TableSignedPreKeys extends CommonTable {
  constructor() {
    super(SIGNED_PRE_KEYS_TABLE);
  }

  public createOrUpdateSignedPreKey(
    db: Database,
    data: RecordWithIdString
  ): void {
    return this.createOrUpdate(db, data);
  }

  public getSignedPreKeyById(
    db: Database,
    id: string
  ): SignedPreKeyDBType | undefined {
    return this.getById(db, id);
  }

  public getAllSignedPreKeys(db: Database): SignedPreKeyDBType[] {
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM signedPreKeys ORDER BY id ASC;`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public bulkAddSignedPreKeys(db: Database, array: SignedPreKeyDBType[]): void {
    return this.bulkAdd(db, array);
  }

  public removeSignedPreKeyById(db: Database, id: string): void {
    return this.removeById(db, id);
  }

  public removeAllSignedPreKeys(db: Database): void {
    return this.removeAllFromTable(db);
  }
}

const ITEMS_TABLE = 'items';
export class TableItems extends CommonTable {
  constructor() {
    super(ITEMS_TABLE);
  }

  public createOrUpdateItem(db: Database, data: ItemDBType): void {
    return this.createOrUpdate(db, data);
  }

  public getItemById(db: Database, id: string): ItemDBType | undefined {
    return this.getById(db, id);
  }

  public getAllItems(db: Database): ItemDBType[] {
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM items ORDER BY id ASC;`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public bulkAddItems(db: Database, array: ItemDBType[]): void {
    return this.bulkAdd(db, array);
  }

  public removeItemById(db: Database, id: string): void {
    return this.removeById(db, id);
  }

  public removeAllItems(db: Database): void {
    return this.removeAllFromTable(db);
  }
}

const SESSIONS_TABLE = 'sessions';

export class TableSessions extends CommonTable {
  constructor() {
    super(SESSIONS_TABLE);
  }

  protected createOrUpdate<Key extends string | number>(
    db: Database,
    data: Record<string, unknown> & { id: Key } & { number: string }
  ): void {
    const { id, number } = data;
    if (!id) {
      throw new Error(
        'createOrUpdateSession: Provided data did not have a truthy id'
      );
    }

    if (!number) {
      throw new Error(
        'createOrUpdateSession: Provided data did not have a truthy number'
      );
    }

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR REPLACE INTO ${SESSIONS_TABLE} (
        id,
        number,
        json
      ) VALUES (
        $id,
        $number,
        $json
      );
      `
    ).run({
      id,
      number,
      json: objectToJSON(data),
    });
  }

  public createOrUpdateSession(db: Database, data: SessionDBType): void {
    return this.createOrUpdate<string>(db, data);
  }

  public getSessionById(db: Database, id: string): SessionDBType | undefined {
    return this.getById(db, id);
  }

  public getSessionsByNumber(db: Database, number: string): SessionDBType[] {
    const jsons = StatementCache.prepare<Query>(
      db,
      `SELECT json FROM ${SESSIONS_TABLE} WHERE number = $number;`
    )
      .pluck()
      .all({ number });

    return mapWithJsonToObject(jsons);
  }

  public bulkAddSessions(db: Database, array: SessionDBType[]): void {
    return this.bulkAdd(db, array);
  }

  public removeSessionById(db: Database, id: string): void {
    return this.removeById(db, id);
  }

  public removeSessionsByNumber(db: Database, number: string): void {
    StatementCache.prepare<Query>(
      db,
      `DELETE FROM ${SESSIONS_TABLE} WHERE number = $number;`
    ).run({ number });
  }

  public removeAllSessions(db: Database): void {
    return this.removeAllFromTable(db);
  }

  public getAllSessions(db: Database): SessionDBType[] {
    return this.getAllFromTable(db);
  }
}
