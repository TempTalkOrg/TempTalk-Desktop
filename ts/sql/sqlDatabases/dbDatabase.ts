// SQL connection and operations

import type { Database } from '@opensource-lib/better-sqlite3';
import type { LoggerType } from '../../logger/types';
import type { ILocalDBDatabase } from '../dbInterface';

import {
  batchQueryWithMultiVar,
  countTableRows,
  generateUUID,
  getAllCreateSQLs,
  jsonToObject,
  mapWithJsonToObject,
  objectToJSON,
  StatementCache,
  TableIterator,
  traverseJsonObject,
} from '../utils/sqlUtils';
import type {
  ArrayQuery,
  ConversationDBType,
  EmptyQuery,
  IdentityKeyDBType,
  ItemDBType,
  MessageDBType,
  PreKeyDBType,
  Query,
  ReadPositionDBType,
  SearchResultDBType,
  SessionDBType,
  SignedPreKeyDBType,
  UnprocessedDBType,
  SessionV2DBType,
  RecordWithIdString,
  TableType,
} from '../sqlTypes';
import { updateSchema } from '../schemaMigrate/database';

import {
  TableIdentityKeys,
  TableItems,
  TablePreKeys,
  TableSessions,
  TableSignedPreKeys,
} from '../sqlTables/sqlCommonTable';
import { join } from 'path';

import { Sqlite3Database } from './sqlite3Database';

import fileSize from 'filesize';
import {
  getExternalFilesForConversation,
  getExternalFilesForMessage,
} from '../utils/fileUtils';
import { toLogFormat } from '../../types/errors';

type NumberPoint = {
  value: number;
  inclusive: boolean;
};

type AscLimit = {
  limit: number;
  begin: NumberPoint;
  max: NumberPoint;
};

export class SqliteDatabase
  extends Sqlite3Database
  implements ILocalDBDatabase
{
  private tablePreKeys: TablePreKeys;
  private tableIdentityKeys: TableIdentityKeys;
  private tableSignedPreKeys: TableSignedPreKeys;
  private tableItems: TableItems;
  private tableSessions: TableSessions;
  private clearableIterator?: Generator<MessageDBType[]>;

  constructor(logger?: LoggerType) {
    super(logger);

    this.tablePreKeys = new TablePreKeys();
    this.tableIdentityKeys = new TableIdentityKeys();
    this.tableSignedPreKeys = new TableSignedPreKeys();
    this.tableItems = new TableItems();
    this.tableSessions = new TableSessions();
  }

  protected checkTimeout({
    prevStart,
    maxWait,
  }: {
    prevStart: number;
    maxWait: number;
  }) {
    const elapsed = Date.now() - prevStart;
    if (elapsed > maxWait) {
      this.getLogger().info('checkTimeout timed out', elapsed, maxWait);
      return true;
    }
    return false;
  }

  protected getAscConditions(
    limit: AscLimit,
    field: string = 'serverTimestamp'
  ) {
    const { begin, max } = limit;
    const params: number[] = [];
    const conditions = [];

    conditions.push(`${field} ${begin.inclusive ? '>=' : '>'} ?`);
    params.push(begin.value);

    conditions.push(`${field} ${max.inclusive ? '<=' : '<'} ?`);
    params.push(max.value);

    return {
      ascConditions: conditions.join(' AND '),
      ascParams: params,
    };
  }

  protected getDBFilePath(dbDir: string): string {
    return join(dbDir, 'db.sqlite');
  }

  protected updateSchema(db: Database, logger: LoggerType) {
    return updateSchema(db, logger);
  }

  protected testWithSQL(db: Database) {
    return countTableRows(db, 'messages');
  }

  protected getOurNumberDevice():
    | { ourNumber: string; ourDeviceId: number }
    | undefined {
    const logger = this.getLogger();

    const number_id = this.getItemById('number_id');
    if (!number_id) {
      logger.warn('There is no number id');
      return undefined;
    }

    const { value } = number_id;
    if (!value || typeof value !== 'string') {
      logger.warn('Invalid number id value 1');
      return undefined;
    }

    const values = value.split('.');
    if (values.length !== 2) {
      logger.warn('Invalid number id value 2');
      return undefined;
    }

    const ourNumber = values[0];
    const deviceIdStr = values[1];

    const ourDeviceId = Number(deviceIdStr);
    if (Number.isNaN(ourDeviceId) || String(ourDeviceId) !== deviceIdStr) {
      logger.warn('Invalid id value');
      return undefined;
    }

    return { ourNumber, ourDeviceId };
  }

  // 'identityKeys'
  public createOrUpdateIdentityKey(data: IdentityKeyDBType): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.createOrUpdateIdentityKey(db, data);
  }

  public getIdentityKeyById(id: string): IdentityKeyDBType | undefined {
    const db = this.getConnection();
    return this.tableIdentityKeys.getIdentityKeyById(db, id);
  }

  public bulkAddIdentityKeys(array: IdentityKeyDBType[]): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.bulkAddIdentityKeys(db, array);
  }

  public removeIdentityKeyById(id: string): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.removeIdentityKeyById(db, id);
  }

  public removeAllIdentityKeys(): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.removeAllIdentityKeys(db);
  }

  public getAllIdentityKeys(): IdentityKeyDBType[] {
    const db = this.getConnection();
    return this.tableIdentityKeys.getAllIdentityKeys(db);
  }

  // 'preKeys'
  public createOrUpdatePreKey(data: PreKeyDBType): void {
    const db = this.getConnection();
    return this.tablePreKeys.createOrUpdatePreKey(db, data);
  }

  public getPreKeyById(id: string): PreKeyDBType | undefined {
    const db = this.getConnection();
    return this.tablePreKeys.getPreKeyById(db, id);
  }

  public bulkAddPreKeys(array: PreKeyDBType[]): void {
    const db = this.getConnection();
    return this.tablePreKeys.bulkAddPreKeys(db, array);
  }

  public removePreKeyById(id: string): void {
    const db = this.getConnection();
    return this.tablePreKeys.removePreKeyById(db, id);
  }

  public removeAllPreKeys(): void {
    const db = this.getConnection();
    return this.tablePreKeys.removeAllPreKeys(db);
  }

  public getAllPreKeys(): PreKeyDBType[] {
    const db = this.getConnection();
    return this.tablePreKeys.getAllPreKeys(db);
  }

  // 'signedPreKeys'
  public createOrUpdateSignedPreKey(data: SignedPreKeyDBType): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.createOrUpdateSignedPreKey(db, data);
  }

  public getSignedPreKeyById(id: string): SignedPreKeyDBType | undefined {
    const db = this.getConnection();
    return this.tableSignedPreKeys.getSignedPreKeyById(db, id);
  }

  public getAllSignedPreKeys(): SignedPreKeyDBType[] {
    const db = this.getConnection();
    return this.tableSignedPreKeys.getAllSignedPreKeys(db);
  }

  public bulkAddSignedPreKeys(array: SignedPreKeyDBType[]): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.bulkAddSignedPreKeys(db, array);
  }

  public removeSignedPreKeyById(id: string): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.removeSignedPreKeyById(db, id);
  }

  public removeAllSignedPreKeys(): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.removeAllSignedPreKeys(db);
  }

  // 'items'
  public createOrUpdateItem(data: ItemDBType): void {
    const db = this.getConnection();
    return this.tableItems.createOrUpdateItem(db, data);
  }

  public getItemById(id: string): ItemDBType | undefined {
    const db = this.getConnection();
    return this.tableItems.getItemById(db, id);
  }

  public getAllItems(): ItemDBType[] {
    const db = this.getConnection();
    return this.tableItems.getAllItems(db);
  }

  public bulkAddItems(array: ItemDBType[]): void {
    const db = this.getConnection();
    return this.tableItems.bulkAddItems(db, array);
  }

  public removeItemById(id: string): void {
    const db = this.getConnection();
    return this.tableItems.removeItemById(db, id);
  }

  public removeAllItems(): void {
    const db = this.getConnection();
    return this.tableItems.removeAllItems(db);
  }

  // 'sessions'
  public createOrUpdateSession(data: SessionDBType): void {
    const db = this.getConnection();
    return this.tableSessions.createOrUpdateSession(db, data);
  }

  public getSessionById(id: string): SessionDBType | undefined {
    const db = this.getConnection();
    return this.tableSessions.getSessionById(db, id);
  }

  public getSessionsByNumber(number: string): SessionDBType[] {
    const db = this.getConnection();
    return this.tableSessions.getSessionsByNumber(db, number);
  }

  public bulkAddSessions(array: SessionDBType[]): void {
    const db = this.getConnection();
    return this.tableSessions.bulkAddSessions(db, array);
  }

  public removeSessionById(id: string): void {
    const db = this.getConnection();
    return this.tableSessions.removeSessionById(db, id);
  }

  public removeSessionsByNumber(number: string): void {
    const db = this.getConnection();
    return this.tableSessions.removeSessionsByNumber(db, number);
  }

  public removeAllSessions(): void {
    const db = this.getConnection();
    return this.tableSessions.removeAllSessions(db);
  }

  public getAllSessions(): SessionDBType[] {
    const db = this.getConnection();
    return this.tableSessions.getAllSessions(db);
  }

  // "conversations"
  public getConversationCount(): number {
    const db = this.getConnection();
    return countTableRows(db, 'conversations');
  }

  public getStickConversationCount(): number {
    const db = this.getConnection();

    // use index conversation_isSticker
    return StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT
        COUNT(*)
      FROM
        conversations
      WHERE
        json_extract(json, '$.isStick') = true;
      `
    )
      .pluck()
      .get();
  }

  public saveConversation(data: ConversationDBType): void {
    const {
      id,
      active_at = null,
      type,
      members,
      name = null,
      profileName = null,
    } = data;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO conversations (
        id,
        json,

        active_at,
        type,
        members,
        name,
        profileName
      ) values (
        $id,
        $json,

        $active_at,
        $type,
        $members,
        $name,
        $profileName
      );
      `
    ).run({
      id,
      json: objectToJSON(data),

      active_at,
      type,
      members: members ? members.join(' ') : null,
      name,
      profileName,
    });
  }

  public saveConversations(arrayOfConversations: ConversationDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const conversation of arrayOfConversations) {
        this.saveConversation(conversation);
      }
    })();
  }

  public updateConversation(data: ConversationDBType): void {
    const {
      id,
      active_at = null,
      type,
      members,
      name = null,
      profileName = null,
    } = data;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      UPDATE
        conversations
      SET
        json = $json,
        active_at = $active_at,
        type = $type,
        members = $members,
        name = $name,
        profileName = $profileName
      WHERE
        id = $id;
      `
    ).run({
      id,
      json: objectToJSON(data),

      active_at,
      type,
      members: members ? members.join(' ') : null,
      name,
      profileName,
    });
  }

  public updateConversations(arrayOfConversations: ConversationDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const conversation of arrayOfConversations) {
        this.updateConversation(conversation);
      }
    })();
  }

  private removeConversations(ids: string[]): void {
    if (!ids?.length) {
      throw new Error('removeConversation: No id(s) to delete!');
    }

    const db = this.getConnection();
    // Our node interface doesn't seem to allow you to replace one single ? with an array
    db.prepare<ArrayQuery>(
      `
      DELETE FROM conversations
      WHERE id IN ( ${ids.map(() => '?').join(', ')} );
      `
    ).run(ids);
  }

  public removeConversation(id: string[] | string): void {
    const db = this.getConnection();
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      this.removeConversations.bind(this)
    );
  }

  public getConversationById(id: string): ConversationDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      'SELECT json FROM conversations WHERE id = $id;'
    )
      .pluck()
      .get({ id });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getAllConversations(): ConversationDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT json FROM conversations ORDER BY id ASC;'
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllConversationIds(): string[] {
    const db = this.getConnection();
    return StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT id FROM conversations ORDER BY id ASC;'
    )
      .pluck()
      .all();
  }

  public getAllPrivateConversations(): ConversationDBType[] {
    // USING INDEX conversations_type (type=?)
    // no need order by
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM conversations WHERE type = 'private';`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllGroupsInvolvingId(id: string): ConversationDBType[] {
    // USING INDEX conversations_type (type=?)
    // no need order by id.
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        conversations
      WHERE
        type = 'group'
        AND (members LIKE $idInner OR members LIKE $idEnd);
      `
    )
      .pluck()
      .all({
        idInner: `%${id} %`,
        idEnd: `%${id}`,
      });

    return mapWithJsonToObject(jsons);
  }

  public searchConversations(
    query: string,
    { limit }: { limit?: number } = {}
  ): ConversationDBType[] {
    // using index conversations_names
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM conversations
      WHERE
        (
          id LIKE $id escape $escape OR
          name LIKE $name escape $escape OR
          profileName LIKE $profileName escape $escape OR
          (json_extract(json, '$.email') LIKE $email escape $escape) OR
          (json_extract(json, '$.signature') LIKE $signature escape $escape) OR
          (
            (name IS NULL OR name = '') AND
            (json_extract(json, '$.groupDisplayName') LIKE $name escape $escape)
          ) OR members LIKE $members escape $escape
        )
        AND
        (
          active_at IS NOT NULL OR
          json_extract(json, '$.directoryUser') IS TRUE OR
          (
            type = 'group' AND
            json_extract(json, '$.left') IS NOT TRUE AND
            json_extract(json, '$.disbanded') IS NOT TRUE
          )
        )
      ORDER BY active_at DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        id: `%${query}%`,
        name: `%${query}%`,
        profileName: `%${query}%`,
        email: `%${query}%`,
        signature: `%${query}%`,
        members: `%${query}%`,
        limit: limit || 500,
        escape: '\\',
      });

    return mapWithJsonToObject(jsons);
  }

  protected _getContactsWithKeyReset(db: Database) {
    const rows = db
      .prepare<EmptyQuery>(
        `
        SELECT
          id,
          json_extract(json, '$.identityKeyResetAt') AS keyResetAt
        FROM
          conversations
        INDEXED BY conversation_key_reset_at
        WHERE
          type = 'private'
          AND keyResetAt > 0;
        `
      )
      .all();

    return rows as { id: string; keyResetAt: number }[];
  }

  protected _getConversationsWithClearAnchor(db: Database) {
    const rows = db
      .prepare<EmptyQuery>(
        `
        SELECT
          id,
          json_extract(json, '$.messageClearAnchor') AS clearAnchor
        FROM
          conversations
        INDEXED BY conversation_clear_anchor
        WHERE
          clearAnchor > 0;
        `
      )
      .all();

    return rows as { id: string; clearAnchor: number }[];
  }

  protected _getAllReadConversationSummaries(db: Database): {
    conversationId: string;
    totalMessages: number;
  }[] {
    return StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT
        CASE
          WHEN typeof(conversationId) IS 'integer' THEN '+' || CAST(conversationId AS TEXT)
          ELSE conversationId
        END conversationId,
        COUNT(*) AS totalMessages
      FROM
        messages
      WHERE
        conversationId IN (
          SELECT
            DISTINCT conversationId
          FROM
            read_positions
        )
        AND pin IS NULL
      GROUP BY
        conversationId
      ORDER BY totalMessages ASC;
      `
    ).all();
  }

  // 'messages'
  public getAllMessageCount(conversationId?: string): number {
    const db = this.getConnection();

    if (conversationId === undefined) {
      return countTableRows(db, 'messages');
    } else {
      return StatementCache.prepare<Query>(
        db,
        `
        SELECT COUNT(*)
        FROM messages
        WHERE conversationId = $conversationId;
        `
      )
        .pluck()
        .get({ conversationId });
    }
  }

  public getMessageCountWithoutPin(conversationId: string): number {
    if (!conversationId) {
      throw new Error('conversationId is empty');
    }

    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
        SELECT COUNT(*)
        FROM messages
        WHERE conversationId = $conversationId
          AND pin IS NULL;
        `
    )
      .pluck()
      .get({ conversationId });
  }

  public searchMessages(
    query: string,
    { conversationId, limit = 100 }: { conversationId?: string; limit?: number }
  ): SearchResultDBType[] {
    const db = this.getConnection();
    let rows: Array<{ json: string; snippet: string }> = [];

    const normalizedQuery = db
      .signalTokenize(query)
      .map(token => `"${token.replace(/"/g, '""')}"*`)
      .join(' ');

    if (!normalizedQuery) {
      return [];
    }

    db.transaction(() => {
      db.exec(`
        CREATE TEMP TABLE tmp_matched(rowid INTEGER PRIMARY KEY ASC);
        CREATE TEMP TABLE tmp_filtered(rowid INTEGER PRIMARY KEY ASC);
      `);

      // insert all matched into temp table
      StatementCache.prepare<Query>(
        db,
        `
        INSERT INTO tmp_matched (rowid)
        SELECT
          rowid
        FROM
          messages_fts
        WHERE
          messages_fts.body MATCH $query;
        `
      ).run({ query: normalizedQuery });

      let conditions;
      const queryParams: Query = { limit: limit };
      if (conversationId) {
        Object.assign(queryParams, { conversationId });
        conditions = 'conversationId = $conversationId';
      } else {
        conditions = `conversationId <> ''`;
      }

      // insert filter rows into temp table on condition of limit with order by
      // indexed by messages_conversation
      // messages_serverTimestamp may be quicker for searching in all messages
      // but it has limited improvement，so we don't create it for now.
      StatementCache.prepare<Query>(
        db,
        `
        INSERT INTO tmp_filtered (rowid)
        SELECT
          tmp_matched.rowid
        FROM
          tmp_matched
        INNER JOIN messages INDEXED BY messages_conversation
          ON messages.rowid = tmp_matched.rowid
        WHERE
          ${conditions} AND
          messages.pin is NULL AND
          json_extract(messages.json, '$.hasBeenRecalled') IS NOT TRUE
        ORDER BY
          messages.serverTimestamp DESC
        LIMIT $limit;
        `
      ).run(queryParams);

      rows = StatementCache.prepare<Query>(
        db,
        `
        SELECT
          messages.json,
          snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15)
            AS snippet
        FROM tmp_filtered
        INNER JOIN messages_fts
          ON messages_fts.rowid = tmp_filtered.rowid
        INNER JOIN messages
          ON messages.rowid = tmp_filtered.rowid
        WHERE
          messages_fts.body MATCH $query
        ORDER BY messages.serverTimestamp DESC;
        `
      ).all({ query: normalizedQuery });

      db.exec(
        `
        DROP TABLE tmp_matched;
        DROP TABLE tmp_filtered;
        `
      );
    })();

    return rows.map(row => ({
      ...jsonToObject<MessageDBType>(row.json),
      snippet: row.snippet,
    }));
  }

  public searchMessagesInConversation(
    query: string,
    conversationId: string,
    { limit }: { limit?: number } = {}
  ): SearchResultDBType[] {
    return this.searchMessages(query, { conversationId, limit });
  }

  public saveMessage(
    data: MessageDBType,
    { forceSave }: { forceSave?: boolean } = {}
  ): string {
    const {
      body = null,
      conversationId,
      expires_at = null,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      id = null,
      received_at,
      schemaVersion,
      sent_at,
      source = null,
      sourceDevice = null,
      type,
      unread,
      atPersons,
      expireTimer = null,
      expirationStartTimestamp = null,
      pin = null,
    } = data;

    const serverTimestamp = data.serverTimestamp || sent_at;

    // update serverTimestamp
    Object.assign(data, { serverTimestamp });

    const payload = {
      body,
      conversationId,
      expires_at,
      hasAttachments: hasAttachments ? 1 : 0,
      hasFileAttachments: hasFileAttachments ? 1 : 0,
      hasVisualMediaAttachments: hasVisualMediaAttachments ? 1 : 0,
      id,
      received_at,
      schemaVersion,
      sent_at,
      source,
      sourceDevice,
      type,
      unread,
      atPersons,
      expireTimer,
      expirationStartTimestamp,
      pin,
      serverTimestamp,
    };

    const db = this.getConnection();
    if (id && !forceSave) {
      StatementCache.prepare<Query>(
        db,
        `
        UPDATE messages SET
          json = $json,
          body = $body,
          conversationId = $conversationId,
          expirationStartTimestamp = $expirationStartTimestamp,
          expires_at = $expires_at,
          expireTimer = $expireTimer,
          hasAttachments = $hasAttachments,
          hasFileAttachments = $hasFileAttachments,
          hasVisualMediaAttachments = $hasVisualMediaAttachments,
          id = $id,
          received_at = $received_at,
          schemaVersion = $schemaVersion,
          sent_at = $sent_at,
          source = $source,
          sourceDevice = $sourceDevice,
          type = $type,
          unread = $unread,
          atPersons = $atPersons,
          pin = $pin,
          serverTimestamp = $serverTimestamp
        WHERE id = $id;
        `
      ).run({
        ...payload,
        json: objectToJSON(data),
      });

      return id;
    }

    const toCreate = {
      ...data,
      id: id || generateUUID(),
    };

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR IGNORE INTO messages (
        id,
        json,

        body,
        conversationId,
        expirationStartTimestamp,
        expires_at,
        expireTimer,
        hasAttachments,
        hasFileAttachments,
        hasVisualMediaAttachments,
        received_at,
        schemaVersion,
        sent_at,
        source,
        sourceDevice,
        type,
        unread,
        atPersons,
        pin,
        serverTimestamp
      ) VALUES (
        $id,
        $json,

        $body,
        $conversationId,
        $expirationStartTimestamp,
        $expires_at,
        $expireTimer,
        $hasAttachments,
        $hasFileAttachments,
        $hasVisualMediaAttachments,
        $received_at,
        $schemaVersion,
        $sent_at,
        $source,
        $sourceDevice,
        $type,
        $unread,
        $atPersons,
        $pin,
        $serverTimestamp
      );
      `
    ).run({
      ...payload,
      id: toCreate.id,
      json: objectToJSON(toCreate),
    });

    return toCreate.id;
  }

  public saveMessages(
    arrayOfMessages: MessageDBType[],
    { forceSave }: { forceSave?: boolean } = {}
  ): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const message of arrayOfMessages) {
        this.saveMessage(message, { forceSave });
      }
    })();
  }

  private removeMessages(ids: string[]): void {
    if (!ids.length) {
      throw new Error('removeMessages: No id(s) to delete!');
    }

    const db = this.getConnection();
    db.transaction(() => {
      db.prepare<ArrayQuery>(
        `
        DELETE FROM messages
        WHERE id IN ( ${ids.map(() => '?').join(', ')} );
        `
      ).run(ids);
    })();
  }

  public removeMessage(id: string[] | string): void {
    const db = this.getConnection();
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      this.removeMessages.bind(this)
    );
  }

  public getMessageById(id: string): MessageDBType | undefined {
    const db = this.getConnection();
    const json = StatementCache.prepare<Query>(
      db,
      'SELECT json FROM messages WHERE id = $id;'
    )
      .pluck()
      .get({ id });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getAllMessages(): MessageDBType[] {
    // USING INDEX messages_pin (pin=?)
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM messages WHERE pin is NULL;`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllMessageIds(): string[] {
    // USING INDEX messages_pin (pin=?)
    const db = this.getConnection();
    return StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT id FROM messages WHERE pin is NULL;`
    )
      .pluck()
      .all();
  }

  public getMessageBySender({
    source,
    sourceDevice,
    sent_at,
    fromCurrentDevice,
  }: {
    source: string;
    sourceDevice: number;
    sent_at: number;
    fromCurrentDevice?: boolean;
  }): MessageDBType[] {
    // USING INDEX messages_duplicate_check
    let jsons: any[] = [];

    const db = this.getConnection();

    db.transaction(() => {
      jsons = StatementCache.prepare<Query>(
        db,
        `
        SELECT json FROM messages
        WHERE
          source = $source AND
          sourceDevice = $sourceDevice AND
          sent_at = $sent_at AND
          pin is NULL;
        `
      )
        .pluck()
        .all({ source, sourceDevice, sent_at });

      if (fromCurrentDevice && !jsons?.length) {
        jsons = StatementCache.prepare<Query>(
          db,
          `
          SELECT json FROM messages
          WHERE
            source IS NULL AND
            sourceDevice IS NULL AND
            sent_at = $sent_at AND
            pin is NULL;
          `
        )
          .pluck()
          .all({ sent_at });
      }
    })();

    return mapWithJsonToObject(jsons);
  }

  // upward = true, load messages older than serverTimestamp,
  // these messages showed over current messages of serverTimestamp
  // upward = false, load messages newer than serverTimestamp
  // these messages showed blow current messages of serverTimestamp
  // default: load neweset 50 messages
  public getMessagesByConversation(
    conversationId: string,
    {
      limit = 50,
      serverTimestamp = Number.MAX_VALUE,
      upward = true,
      equal = false,
      threadId,
      onlyUnread = false,
    }: {
      limit?: number;
      serverTimestamp?: number;
      upward?: boolean;
      equal?: boolean;
      threadId?: string;
      onlyUnread?: boolean;
    } = {}
  ): MessageDBType[] {
    const db = this.getConnection();

    let upwardOperator = upward ? '<' : '>';
    if (equal) {
      upwardOperator = upward ? '<=' : '>=';
    }
    const orderBy = upward ? 'DESC' : 'ASC';

    const queryParams = {
      conversationId,
      serverTimestamp,
      limit,
    };

    if (threadId) {
      Object.assign(queryParams, { threadId });
    }

    // USING INDEX messages_conversation_visible
    // USING INDEX messages_conversation_visible_unread
    // USING INDEX messages_conversation_thread_visible
    // USING INDEX messages_conversation_thread_visible_unread
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM messages
      WHERE conversationId = $conversationId
        AND pin is NULL
        AND ${threadId ? `json_extract(json, '$.threadId') = $threadId` : '1=1'}
        AND ${onlyUnread ? 'unread = 1' : '1=1'}
        AND serverTimestamp ${upwardOperator} $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND
          (
            type IS NULL OR
            type NOT IN ('keychange', 'verified-change')
          )
        ORDER BY serverTimestamp ${orderBy}
        LIMIT $limit;
      `
    )
      .pluck()
      .all(queryParams);

    return mapWithJsonToObject(jsons);
  }

  public getMessagesBySentAt(sentAt: number): MessageDBType[] {
    // USING INDEX messages_receipt (sent_at=?)
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_receipt
      WHERE sent_at = $sent_at
        AND pin is NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC;
      `
    )
      .pluck()
      .all({ sent_at: sentAt });

    return mapWithJsonToObject(jsons);
  }

  public getExpiredMessagesCount(expiresAt?: number): number {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
      SELECT COUNT(*)
      FROM messages
      INDEXED BY messages_expires_at
      WHERE
        pin is NULL AND
        expires_at <= $expires_at;
      `
    )
      .pluck()
      .get({ expires_at: expiresAt || Date.now() });
  }

  public getExpiredMessages(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM messages
      INDEXED BY messages_expires_at
      WHERE
        pin is NULL AND
        expires_at <= $expires_at
      ORDER BY expires_at ASC
      LIMIT 50;
      `
    )
      .pluck()
      .all({ expires_at: Date.now() });

    return mapWithJsonToObject(jsons);
  }

  public getOutgoingWithoutExpiresAt(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_without_timer
      WHERE
        pin is NULL AND
        expireTimer > 0 AND
        expires_at IS NULL AND
        type IS 'outgoing';
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getNextExpiringMessage(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_expires_at
      WHERE expires_at > 0
        AND pin is NULL
      ORDER BY expires_at ASC
      LIMIT 1;
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  // get expired messages, scanning up to a maximum count
  protected _getExpiredMessagesByStep(
    db: Database,
    options: AscLimit & {
      conversationId: string;
      defaultMessageExpiry: number;
      scanLimit: number;
    }
  ): {
    messages: MessageDBType[];
    maxServerTimestamp: number;
  } {
    const { limit, scanLimit } = options;

    if (limit <= 0 || scanLimit <= 0) {
      throw new Error('limit must be bigger than 0');
    }

    const { conversationId, begin, defaultMessageExpiry } = options;

    let messages: MessageDBType[] = [];
    let maxServerTimestamp = begin.value;

    const logger = this.getLogger();

    db.transaction(() => {
      const messageExpiry = db
        .prepare<Query>(
          `
          SELECT
            json_extract(json, '$.messageExpiry')
          FROM
            conversations
          WHERE
            id = $conversationId;
          `
        )
        .pluck()
        .get({ conversationId });

      const expireTimer =
        typeof messageExpiry === 'number' && messageExpiry >= 0
          ? messageExpiry
          : defaultMessageExpiry;

      db.exec(
        `
        DROP TABLE IF EXISTS tmp_scaned;
        DROP INDEX IF EXISTS tmp_scaned_serverTimestamp;

        CREATE TEMP TABLE tmp_scaned(
          id STRING PRIMARY KEY,
          serverTimestamp INTEGER
        );

        CREATE INDEX tmp_scaned_serverTimestamp
        ON tmp_scaned (
          serverTimestamp ASC,
          id
        );
        `
      );

      const { ascConditions, ascParams } = this.getAscConditions(options);
      const params = [conversationId, ...ascParams, scanLimit];

      const { changes } = StatementCache.prepare<ArrayQuery>(
        db,
        `
        INSERT INTO tmp_scaned (
          id,
          serverTimestamp
        )
        SELECT
          id,
          serverTimestamp
        FROM
          messages
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND conversationId = ?
          AND ${ascConditions}
        ORDER BY serverTimestamp ASC
        LIMIT ?;
        `
      ).run(params);

      do {
        if (changes === 0) {
          // no messages selected, already scan to the latest
          maxServerTimestamp = Number.MAX_VALUE;
          logger.info('there is no more messages', {
            conversationId,
            scanLimit,
            limit,
          });
          break;
        }

        const realLimit = Math.min(limit, changes);

        const expiredRows = StatementCache.prepare<Query>(
          db,
          `
          SELECT
            id,
            serverTimestamp
          FROM
            tmp_scaned s
          WHERE
            EXISTS (
              SELECT
                1
              FROM
                read_positions p
              WHERE
                p.conversationId = $conversationId
                AND p.maxServerTimestamp >= s.serverTimestamp
                AND MAX(p.readAt, p.maxServerTimestamp) < $maxReadAt
            )
          ORDER BY
            serverTimestamp ASC
          LIMIT
            $limit;
          `
        ).all({
          limit: realLimit,
          conversationId,
          maxReadAt: Date.now() - expireTimer * 1000,
        });

        const expiredLen = expiredRows.length;
        if (changes < scanLimit) {
          // scanning the last $changes messages in the conversation
          if (expiredLen < realLimit || expiredLen === changes) {
            // has scaned all
            maxServerTimestamp = Number.MAX_VALUE;
          } else {
            // has more to scan
            maxServerTimestamp = expiredRows[expiredLen - 1].serverTimestamp;
          }
        } else {
          // scanning in the middle of messages
          if (expiredLen < realLimit) {
            // has scaned the current $changes messages
            maxServerTimestamp = StatementCache.prepare<EmptyQuery>(
              db,
              `
              SELECT serverTimestamp
              FROM tmp_scaned
              ORDER BY serverTimestamp DESC
              LIMIT 1;
              `
            )
              .pluck()
              .get();
          } else {
            // has more to scan
            maxServerTimestamp = expiredRows[expiredLen - 1].serverTimestamp;
          }
        }

        if (expiredLen === 0) {
          logger.debug('[expiring] there is no expired messages', {
            conversationId,
            scanLimit,
            limit,
          });
          break;
        }

        const ids = expiredRows.map(row => row.id);
        const jsons = StatementCache.prepare<ArrayQuery>(
          db,
          `
          SELECT
            json
          FROM
            messages
          WHERE
            id IN(${ids.map(() => '?').join(', ')});
          `
        )
          .pluck()
          .all(ids);

        messages = mapWithJsonToObject(jsons);

        break;
        // eslint-disable-next-line no-constant-condition
      } while (true);

      db.exec(`DROP TABLE tmp_scaned;`);
    })();

    return { messages, maxServerTimestamp };
  }

  protected _getMessagesByConversationId(
    db: Database,
    options: AscLimit & { conversationId: string }
  ) {
    const { conversationId, limit } = options;
    const { ascConditions, ascParams } = this.getAscConditions(options);
    const params = [conversationId, ...ascParams, limit];

    const jsons = db
      .prepare<ArrayQuery>(
        `
        SELECT
          json
        FROM
          messages
        WHERE
          pin IS NULL
          AND conversationId = ?
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND ${ascConditions}
        ORDER BY serverTimestamp ASC
        LIMIT ?;
        `
      )
      .pluck()
      .all(params);

    return mapWithJsonToObject<MessageDBType>(jsons);
  }

  protected _getMessagesByNumberSource(
    db: Database,
    options: AscLimit & { conversationId: string; source: string }
  ) {
    const { conversationId, source, limit } = options;
    const { ascConditions, ascParams } = this.getAscConditions(options);
    const params = [conversationId, source, ...ascParams, limit];

    const jsons = db
      .prepare<ArrayQuery>(
        `
        SELECT
          json
        FROM
          messages
        INDEXED BY messages_conversation_source_st
        WHERE
          pin IS NULL
          AND conversationId = ?
          AND source = ?
          AND ${ascConditions}
        ORDER BY serverTimestamp ASC
        LIMIT ?;
        `
      )
      .pluck()
      .all(params);

    return mapWithJsonToObject<MessageDBType>(jsons);
  }

  // be carefull with self Number
  protected _getMessagesByNullSource(
    db: Database,
    options: AscLimit & { conversationId: string }
  ) {
    const { conversationId, limit } = options || {};
    const { ascConditions, ascParams } = this.getAscConditions(options);
    const params = [conversationId, ...ascParams, limit];

    const jsons = db
      .prepare<ArrayQuery>(
        `
        SELECT
          json
        FROM
          messages
        INDEXED BY messages_conversation_source_st
        WHERE
          pin IS NULL
          AND conversationId = ?
          AND source IS NULL
          AND ${ascConditions}
        ORDER BY serverTimestamp ASC
        LIMIT ?;
        `
      )
      .pluck()
      .all(params);

    return mapWithJsonToObject<MessageDBType>(jsons);
  }

  protected _getConversationsByNumberSource(db: Database, source: string) {
    return db
      .prepare<Query>(
        `
        SELECT
          DISTINCT conversationId
        FROM
          messages
        WHERE
          source = $source
          AND pin IS NULL;
        `
      )
      .pluck()
      .all({ source });
  }

  protected _getConversationsByNullSource(db: Database) {
    return db
      .prepare<EmptyQuery>(
        `
        SELECT
          DISTINCT conversationId
        FROM
          messages
        WHERE
          source IS NULL
          AND pin IS NULL;
        `
      )
      .pluck()
      .all();
  }

  protected _wrapGetMessages<T extends object>(
    getMessages: (options: AscLimit & T) => MessageDBType[]
  ) {
    return (options: AscLimit & T) => {
      const messages = getMessages(options);
      if (messages.length < options.limit) {
        return { messages, maxServerTimestamp: Number.MAX_VALUE };
      } else {
        const last = messages[messages.length - 1];
        return {
          messages,
          maxServerTimestamp: last.serverTimestamp || last.sent_at,
        };
      }
    };
  }

  protected *_createGetMessagesIterator<T extends object>(
    getMessages: (options: AscLimit & T) => {
      messages: MessageDBType[];
      maxServerTimestamp: number;
    },
    options: AscLimit & T,
    acc: { prevStart: number; maxWait: number }
  ) {
    const logger = this.getLogger();
    const { begin } = options;

    logger.debug('getMessagesIterator begin');

    if (this.checkTimeout(acc)) {
      yield [];
      acc.prevStart = Date.now();
    }

    do {
      const { messages, maxServerTimestamp } = getMessages(options);

      logger.debug(
        'getMessagesIterator got messages',
        messages?.length,
        maxServerTimestamp
      );

      if (messages.length) {
        yield messages;
        acc.prevStart = Date.now();
      } else {
        if (this.checkTimeout(acc)) {
          yield [];
          acc.prevStart = Date.now();
        }
      }

      begin.value = maxServerTimestamp;

      if (maxServerTimestamp === Number.MAX_VALUE) {
        break;
      }
    } while (true);

    logger.debug('getMessagesIterator end');
  }

  protected *_createKeyResetExpireIteratorByContact(
    keyResetContact: {
      id: string;
      keyResetAt: number;
    },
    conversationIds: string[],
    getMessages: (
      options: AscLimit & { conversationId: string; source: string }
    ) => {
      messages: MessageDBType[];
      maxServerTimestamp: number;
    },
    acc: { prevStart: number; maxWait: number }
  ) {
    const { id: source, keyResetAt } = keyResetContact;
    const max: NumberPoint = { value: keyResetAt, inclusive: false };

    const logger = this.getLogger();

    logger.debug(
      '[expiring] resetExpireIteratorByContact begin',
      `+${source}`,
      keyResetAt,
      conversationIds.length
    );

    for (const conversationId of conversationIds) {
      const begin: NumberPoint = { value: 0, inclusive: true };

      const options = {
        source,
        max,
        begin,
        limit: 50,
        conversationId,
      };

      yield* this._createGetMessagesIterator(getMessages, options, acc);
    }

    logger.debug('[expiring] resetExpireIteratorByContact end');
  }

  protected *_createKeyResetExpireIterator(
    ourNumber: string,
    acc: {
      prevStart: number;
      maxWait: number;
    }
  ) {
    const logger = this.getLogger();
    const db = this.getConnection();

    const isMe = (id: string) => id === ourNumber;
    const isNotMe = (id: string) => !isMe(id);

    const keyResetContacts = this._getContactsWithKeyReset(db);

    logger.debug('[expiring] resetExpireIterator begin');

    const selfContact = keyResetContacts.find(c => isMe(c.id));
    if (selfContact) {
      const getMessages = this._wrapGetMessages<{
        conversationId: string;
        source: string;
      }>(this._getMessagesByNullSource.bind(this, db));

      // me conversation do not expired
      yield* this._createKeyResetExpireIteratorByContact(
        selfContact,
        this._getConversationsByNullSource(db).filter(isNotMe),
        getMessages,
        acc
      );
    }

    const getMessages = this._wrapGetMessages<{
      conversationId: string;
      source: string;
    }>(this._getMessagesByNumberSource.bind(this, db));

    for (const contact of keyResetContacts) {
      // getting conversations takes time,
      // we should check timeout here
      if (this.checkTimeout(acc)) {
        yield [];
        acc.prevStart = Date.now();
      }

      // me conversation do not expired
      yield* this._createKeyResetExpireIteratorByContact(
        contact,
        this._getConversationsByNumberSource(db, contact.id).filter(isNotMe),
        getMessages,
        acc
      );
    }

    logger.debug('[expiring] resetExpireIterator end');
  }

  protected *_createExpireForClearAnchorIterator(
    ourNumber: string,
    acc: {
      prevStart: number;
      maxWait: number;
    }
  ) {
    const logger = this.getLogger();
    const db = this.getConnection();

    const getMessages = this._wrapGetMessages<{ conversationId: string }>(
      this._getMessagesByConversationId.bind(this, db)
    );

    logger.debug('[expiring] clearAnchorIterator begin');

    const rows = this._getConversationsWithClearAnchor(db);
    for (const row of rows) {
      const { id: conversationId, clearAnchor } = row;

      // me conversation do not expired
      if (conversationId === ourNumber) {
        continue;
      }

      logger.debug(
        '[expiring] clearAnchorIterator',
        conversationId,
        clearAnchor
      );

      const maxServerTimestamp = this._getMaxPositionBeforeAnchor(db, {
        conversationId,
        timestampAnchor: clearAnchor,
      });

      if (!maxServerTimestamp) {
        logger.debug('[expiring] clearAnchorIterator no position');

        // getting max position takes time,
        // we should check timeout here
        if (this.checkTimeout(acc)) {
          yield [];
          acc.prevStart = Date.now();
        }

        continue;
      }

      const max: NumberPoint = { value: maxServerTimestamp, inclusive: true };
      const begin: NumberPoint = { value: 0, inclusive: true };
      const options = { conversationId, begin, max, limit: 50 };

      yield* this._createGetMessagesIterator(getMessages, options, acc);
    }

    logger.debug('[expiring] clearAnchorIterator end');
  }

  protected *_createExpireForReadPositionIterator(
    ourNumber: string,
    acc: {
      prevStart: number;
      maxWait: number;
    },
    defaultMessageExpiry: number
  ) {
    const logger = this.getLogger();
    const db = this.getConnection();

    const getMessages = this._getExpiredMessagesByStep.bind(this, db);

    logger.debug('[expiring] readPositionIterator begin');

    const summaries = this._getAllReadConversationSummaries(db);

    logger.debug('[expiring] readPositionIterator summaries', summaries.length);

    for (const { conversationId, totalMessages } of summaries) {
      // skip empty conversation
      if (!totalMessages) {
        continue;
      }

      // me conversation do not expired
      if (ourNumber === conversationId) {
        continue;
      }

      const begin: NumberPoint = { value: 0, inclusive: true };
      const max: NumberPoint = { value: Number.MAX_VALUE, inclusive: false };

      const options = {
        conversationId,
        defaultMessageExpiry,
        begin,
        max,
        limit: 50,
        scanLimit: 1000,
      };

      yield* this._createGetMessagesIterator(getMessages, options, acc);
    }

    logger.debug('[expiring] readPositionIterator end');
  }

  protected *_createRecalledIterator(acc: {
    prevStart: number;
    maxWait: number;
  }) {
    const logger = this.getLogger();
    const db = this.getConnection();

    logger.debug('[recalled] recalledIterator begin');

    const getMessages = this._wrapGetMessages(
      this._getRecalleds.bind(this, db)
    );

    const begin: NumberPoint = { value: 0, inclusive: true };
    const max: NumberPoint = { value: Number.MAX_VALUE, inclusive: false };

    const options = {
      begin,
      max,
      limit: 50,
    };

    yield* this._createGetMessagesIterator(getMessages, options, acc);

    logger.debug('[recalled] recalledIterator end');
  }

  protected *_createClearableMessagesIterator(defaultMessageExpiry: number) {
    const { ourNumber } = this.getOurNumberDevice() || {};
    if (!ourNumber) {
      throw new Error('our number is not available');
    }

    const acc = { prevStart: Date.now(), maxWait: 100, ourNumber };

    yield* this._createRecalledIterator(acc);
    yield* this._createKeyResetExpireIterator(ourNumber, acc);
    yield* this._createExpireForClearAnchorIterator(ourNumber, acc);
    yield* this._createExpireForReadPositionIterator(
      ourNumber,
      acc,
      defaultMessageExpiry
    );
  }

  public getClearableMessages(defaultMessageExpiry: number) {
    const logger = this.getLogger();

    logger.info('[clearable] getClearableMessages begin');

    if (!defaultMessageExpiry) {
      logger.error('defaultMessageExpiry was not passed in');
      throw new Error('defaultMessageExpiry was not passed in');
    }

    if (!this.clearableIterator) {
      logger.info('[clearable] clearableIterator start ');
      this.clearableIterator =
        this._createClearableMessagesIterator(defaultMessageExpiry);
    }

    const res = this.clearableIterator.next();
    if (res.done) {
      logger.info('[clearable] clearableIterator done');
      this.clearableIterator = undefined;
    }

    logger.info('[clearable] getClearableMessages end');

    return { messages: res.value || [], done: !!res.done };
  }

  // unprocessed
  public getUnprocessedCount(): number {
    return countTableRows(this.getConnection(), 'unprocessed');
  }

  public getAllUnprocessed(): UnprocessedDBType[] {
    const db = this.getConnection();
    const rows = StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT * FROM unprocessed ORDER BY timestamp ASC;'
    ).all();

    return rows.map<UnprocessedDBType>(row => {
      if (row.external) {
        row.external = jsonToObject(row.external);
      }

      return row;
    });
  }

  public removeAllUnprocessed(): void {
    this.getConnection().exec('DELETE FROM unprocessed;');
  }

  // All data in database
  public removeAll(): void {
    const db = this.getConnection();
    const logger = this.getLogger();

    db.transaction(() => {
      db.exec(
        `
        DELETE FROM identityKeys;
        DELETE FROM items;
        DELETE FROM preKeys;
        DELETE FROM sessions;
        DELETE FROM signedPreKeys;
        DELETE FROM unprocessed;

        DELETE FROM attachment_downloads;
        DELETE FROM conversations;

        -- DELETE FROM messages;
        DELETE FROM messages_fts;
        DELETE FROM read_positions;
        `
      );

      if (countTableRows(db, 'messages') > 0) {
        const createSQLs = getAllCreateSQLs(db, 'messages');
        const {
          table: tableRows,
          index: indexRows,
          trigger: triggerRows,
        } = createSQLs;

        if (!tableRows?.length) {
          logger.info('empty table 1 sql');
        }

        const sqls: string[] = [];

        // drop all indexes
        if (indexRows?.length) {
          for (const row of indexRows) {
            const { name, sql } = row;
            db.prepare<EmptyQuery>(`DROP INDEX IF EXISTS ${name}`).run();
            sqls.push(sql);
          }
        } else {
          logger.info(`there is no table index sql.`);
        }

        // drop all triggers
        if (triggerRows?.length) {
          for (const row of triggerRows) {
            const { name, sql } = row;
            db.prepare<EmptyQuery>(`DROP TRIGGER IF EXISTS ${name};`).run();
            sqls.push(sql);
          }
        } else {
          logger.info(`there is no table trigger sql.`);
        }

        // clear records
        db.exec(`DELETE FROM messages;`);

        //recreate indexes and triggers
        for (const sql of sqls) {
          db.exec(sql);
        }
      }
    })();
  }

  // Anything that isn't user-visible data
  public removeAllConfiguration(): void {
    const db = this.getConnection();

    db.exec(
      `
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM preKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
      `
    );
  }

  public getMessagesNeedingUpgrade(
    limit: number,
    { maxVersion }: { maxVersion: number }
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_schemaVersion
      WHERE
        schemaVersion IS NULL
        OR schemaVersion < $maxVersion
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        maxVersion,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMessagesWithVisualMediaAttachments(
    conversationId: string,
    { limit, isPin }: { limit: number; isPin: boolean }
  ): MessageDBType[] {
    // USING INDEX messages_hasVisualMediaAttachments
    // OR USING INDEX messages_hasVisualMediaAttachments_pin
    const indexName = isPin
      ? 'messages_hasVisualMediaAttachments_pin'
      : 'messages_hasVisualMediaAttachments';

    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY ${indexName}
      WHERE conversationId = $conversationId
        AND hasVisualMediaAttachments = 1
        AND pin IS ${isPin ? `NOT NULL` : 'NULL'}
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({ conversationId, limit });

    return mapWithJsonToObject(jsons);
  }

  public getMessagesWithFileAttachments(
    conversationId: string,
    { limit }: { limit: number }
  ): MessageDBType[] {
    // USING INDEX messages_hasFileAttachments
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_hasFileAttachments
      WHERE pin IS NULL
        AND conversationId = $conversationId
        AND hasFileAttachments = 1
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({ conversationId, limit });

    return mapWithJsonToObject(jsons);
  }

  private doubleCheckOrphanedAttachments(fileSet: Set<string>) {
    const db = this.getConnection();
    const logger = this.getLogger();

    const getFtsName = (table: string) => `temp.${table}_fts`;
    const getTmpFtsSqls = (table: string) => {
      const ftsName = getFtsName(table);
      return `
        CREATE VIRTUAL TABLE ${ftsName}
        USING fts5(
          json,
          content='${table}',
          tokenize = 'signal_tokenizer'
        );

        INSERT INTO
          ${ftsName}(rowid, json)
        SELECT
          rowid,
          json
        FROM
          ${table};
      `;
    };

    const getSearchSql = (table: string) => {
      const ftsName = getFtsName(table);
      return `
        SELECT
          ${table}.id AS id,
          ${table}.json AS json
        FROM
          ${table}
        INNER JOIN ${ftsName}
          ON ${ftsName}.rowid = ${table}.rowid
        WHERE
          ${ftsName}.json MATCH $query;
      `;
    };

    const foundSet = new Set<string>();

    const checkFile = (
      key: string,
      value: any,
      ancestors: any[],
      object: RecordWithIdString,
      file: string,
      table: string
    ) => {
      if (typeof value === 'string' && value.includes(file)) {
        const paths = ancestors.map(a => Object.keys(a)).flat(3);
        paths.push(key);

        logger.info(
          `removeKnownAttachments: found useful attachment ${value}`,
          `in ${table}.${object.id}.${paths.join('/')}`
        );

        // refered by somewhere
        foundSet.add(file);
      }
      return false;
    };

    const files = Array.from(fileSet);
    const tables = ['messages', 'conversations'];

    // use transaction for all db operations
    db.transaction(() => {
      try {
        const stmts = tables.map(table => {
          db.exec(getTmpFtsSqls(table));
          return db.prepare<Query>(getSearchSql(table));
        });

        for (const file of files) {
          const query = file.split('/').at(-1) || '';

          stmts.forEach((stmt, index) => {
            const rows = stmt.all({ query });
            if (!rows?.length) {
              return;
            }

            for (const row of rows) {
              const { id, json } = row;

              try {
                const obj: RecordWithIdString = jsonToObject(json);

                const check = (key: string, value: any, ancestors: any[]) =>
                  checkFile(key, value, ancestors, obj, file, tables[index]);

                traverseJsonObject('/root', obj, check, []);
              } catch (error) {
                logger.info(
                  `removeKnownAttachments: found useful attachment ${file}` +
                    `in ${tables[index]}.${id}, but traverse json error`,
                  toLogFormat(error)
                );
              }
            }
          });
        }
      } catch (error) {
        logger.error(
          'removeKnownAttachments: iterate double check error:',
          toLogFormat(error)
        );
      } finally {
        tables.forEach(table =>
          db.exec(`DROP TABLE IF EXISTS ${getFtsName(table)};`)
        );
      }
    })();

    return foundSet;
  }

  public removeKnownAttachments(
    allAttachments: string[],
    requireDoubleCheck: boolean = false
  ): string[] {
    const logger = this.getLogger();
    const db = this.getConnection();

    const fileSet = new Set(allAttachments);

    logger.info(`removeKnownAttachments: About ${fileSet.size} attachments`);
    logger.info(
      `removeKnownAttachments: About to iterate through db:`,
      this.getReport()
    );

    function iterateFiles(
      table: TableType,
      getExternalFiles: (item: any) => string[]
    ): { itemCount: number; fileCount: number } {
      const count = { itemCount: 0, fileCount: 0, uniqueCount: 0 };

      for (const item of new TableIterator(db, table)) {
        count.itemCount += 1;

        const files = getExternalFiles(item);
        count.fileCount += files.length;

        files.forEach(file => {
          if (fileSet.delete(file)) {
            count.uniqueCount += 1;
          }
        });
      }
      return count;
    }

    //
    // iterate messages
    let total = iterateFiles('messages', getExternalFilesForMessage);
    logger.info(`removeKnownAttachments: Processed m`, total);

    //
    // iterate conversations
    total = iterateFiles('conversations', getExternalFilesForConversation);
    logger.info(`removeKnownAttachments: Processed c`, total);

    //
    logger.info(
      `removeKnownAttachments: About ${fileSet.size} orphaned attachments`
    );

    if (requireDoubleCheck && fileSet.size > 0) {
      const foundSet = this.doubleCheckOrphanedAttachments(fileSet);
      foundSet.forEach(found => fileSet.delete(found));
      logger.info(
        `removeKnownAttachments: Found ${foundSet.size} false-positives`
      );
    }

    return Array.from(fileSet);
  }

  public getThreadMessagesUnreplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number = Number.MAX_VALUE,
    limit: number = 50
  ): MessageDBType[] {
    // USING INDEX messages_thread_unreplied
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_thread_unreplied
      WHERE pin IS NULL
      AND conversationId = $conversationId
      AND json_extract(json, '$.threadId') = $threadId
      AND json_extract(json, '$.threadReplied') IS NOT TRUE
      AND serverTimestamp <= $serverTimestamp
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        threadId,
        serverTimestamp,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public findNewerThreadReplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number = Number.MAX_VALUE
  ): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_thread_replied
      WHERE pin IS NULL
      AND conversationId = $conversationId
      AND json_extract(json, '$.threadId') = $threadId
      AND (
        json_extract(json, '$.threadReplied') IS TRUE
        OR json_extract(json, '$.botContext') IS NULL
      )
      AND serverTimestamp > $serverTimestamp
      LIMIT 1;
      `
    )
      .pluck()
      .all({
        conversationId,
        threadId,
        serverTimestamp,
      });

    return mapWithJsonToObject(jsons);
  }

  public deletePinMessagesByConversationId(conversationId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      DELETE FROM messages
        INDEXED BY messages_conversation_pin
      WHERE conversationId = $conversationId AND pin > '';
      `
    ).run({ conversationId });
  }

  public getPinMessagesByConversationId(
    conversationId: string
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation_pin
        WHERE conversationId = $conversationId AND pin > '';
      `
    )
      .pluck()
      .all({ conversationId });

    return mapWithJsonToObject(jsons);
  }

  public getPinMessageById(pinId: string): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_pin
      WHERE pin = $pinId;
      `
    )
      .pluck()
      .get({ pinId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  // 1 generated by local read
  //   sourceDevice, conversationId, maxServerTimestamp, readAt, sender, sentAt
  // 2 generated by synced form other devices
  //   sourceDevice, conversationId, maxServerTimestamp, readAt sender, sentAt

  // how to deal with readAt when local record conflicting with synced ?
  public saveReadPosition(readPosition: ReadPositionDBType): void {
    const {
      sourceDevice,
      conversationId,
      maxServerTimestamp,
      readAt,
      sender = null,
      sentAt = null,
      maxNotifySequenceId = null,
    } = readPosition;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO read_positions(
        sourceDevice,
        conversationId,
        maxServerTimestamp,
        readAt,
        sender,
        sentAt,
        maxNotifySequenceId
      ) VALUES (
        $sourceDevice,
        $conversationId,
        $maxServerTimestamp,
        $readAt,
        $sender,
        $sentAt,
        $maxNotifySequenceId
      )
      ON CONFLICT(sourceDevice, conversationId, maxServerTimestamp) DO UPDATE
        SET
          readAt =
            CASE
              WHEN readAt > $readAt THEN $readAt
              ELSE readAt
            END,
          sentAt = $sentAt,
          maxNotifySequenceId = $maxNotifySequenceId
        WHERE readAt > $readAt
          OR sentAt IS NULL
          OR maxNotifySequenceId IS NULL
          OR maxNotifySequenceId > (POWER(2, 53) - 1);
      `
    ).run({
      sourceDevice,
      conversationId,
      maxServerTimestamp,
      readAt,
      sender,
      sentAt,
      maxNotifySequenceId,
    });
  }

  public saveReadPositions(readPositions: ReadPositionDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const position of readPositions) {
        this.saveReadPosition(position);
      }
    })();
  }

  // get top read position in conversation
  // using index read_position_conversation
  public topReadPosition(
    conversationId: string
  ): ReadPositionDBType | undefined {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
      SELECT * FROM read_positions
      INDEXED BY read_position_conversation
      WHERE conversationId = $conversationId
      ORDER BY maxServerTimestamp DESC
      LIMIT 1;
      `
    ).get({ conversationId });
  }

  // using index read_position_conversation
  public getReadPositions(
    conversationId: string,
    {
      begin = 0,
      end = Number.MAX_VALUE,
      includeBegin = false,
      includeEnd = false,
      limit = 50,
    }: {
      begin?: number;
      end?: number;
      includeBegin?: boolean;
      includeEnd?: boolean;
      limit?: number;
    } = {}
  ): ReadPositionDBType[] {
    const db = this.getConnection();

    const beginCompare = includeBegin ? '>=' : '>';
    const endCompare = includeEnd ? '<=' : '<';

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT * FROM read_positions
      INDEXED BY read_position_conversation
      WHERE
        conversationId = $conversationId
        AND maxServerTimestamp ${beginCompare} $begin
        AND maxServerTimestamp ${endCompare} $end
      ORDER BY maxServerTimestamp ASC
      LIMIT $limit;
      `
    ).all({
      conversationId,
      begin,
      end,
      limit,
    });
  }

  protected _getMaxPositionBeforeAnchor(
    db: Database,
    options: { conversationId: string; timestampAnchor: number }
  ) {
    const { conversationId, timestampAnchor } = options;

    const maxServerTimestamp = db
      .prepare<Query>(
        `
        SELECT
          MAX(maxServerTimestamp)
        FROM
          read_positions
        INDEXED BY read_position_conversation_read_at
        WHERE
          conversationId = $conversationId
          AND readAt <= $timestampAnchor;
        `
      )
      .pluck()
      .get({ conversationId, timestampAnchor });

    if (!maxServerTimestamp) {
      return null;
    }

    return maxServerTimestamp as number;
  }

  // using index messages_conversation
  public getUnreadMessages(
    conversationId: string,
    start: number,
    end: number,
    limit: number = 50
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation
      WHERE
        conversationId = $conversationId AND
        serverTimestamp > $start AND
        serverTimestamp <= $end AND
        pin is NULL AND
        json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        start,
        end,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  // using index messages_conversation_unread_count
  public getUnreadMessageCount(
    conversationId: string,
    start: number,
    end: number
  ): number {
    const db = this.getConnection();

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT COUNT(*) FROM messages
      INDEXED BY messages_conversation_unread_count
      WHERE
        conversationId = $conversationId AND
        type IS 'incoming' AND
        serverTimestamp > $start AND
        serverTimestamp <= $end AND
        json_extract(json, '$.hasBeenRecalled') IS NOT TRUE AND
        json_extract(json, '$.recall') IS NULL AND
        pin is NULL;
      `
    )
      .pluck()
      .get({
        conversationId,
        start,
        end,
      });
  }

  // using index messages_conversation_has_read
  public findLastReadMessage(
    conversationId: string
  ): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation_has_read
      WHERE
        conversationId = $conversationId
        AND unread IS NULL
        AND pin IS NULL
        AND json_extract(json, '$.recall') IS NULL
      ORDER BY serverTimestamp DESC
      LIMIT 1;
      `
    )
      .pluck()
      .get({ conversationId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public findLastMessageForMarkRead(
    conversationId: string,
    serverTimestamp: number = Number.MAX_VALUE
  ): (MessageDBType | undefined)[] {
    const db = this.getConnection();

    const lastMessages: Array<MessageDBType | undefined> = [];
    db.transaction(() => {
      const first = StatementCache.prepare<Query>(
        db,
        `
        SELECT json
        FROM
          messages INDEXED BY messages_conversation_unread_count
        WHERE
          conversationId = $conversationId
          AND type IS 'incoming'
          AND serverTimestamp <= $serverTimestamp
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.recall') IS NULL
          AND pin is NULL
        ORDER BY serverTimestamp DESC
        LIMIT 1;
        `
      )
        .pluck()
        .get({
          conversationId,
          serverTimestamp,
        });

      lastMessages.push(first ? jsonToObject(first) : undefined);

      const second = StatementCache.prepare<Query>(
        db,
        `
        SELECT json
        FROM
          messages INDEXED BY messages_conversation_non_outgoing
        WHERE
          conversationId = $conversationId
          AND serverTimestamp <= $serverTimestamp
          AND type IS NOT 'outgoing'
          AND pin is NULL
        ORDER BY serverTimestamp DESC
        LIMIT 1;
        `
      )
        .pluck()
        .get({
          conversationId,
          serverTimestamp,
        });

      lastMessages.push(second ? jsonToObject(second) : undefined);
    })();

    return lastMessages;
  }

  public findLastUserMessage(
    conversationId: string
  ): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM
        messages INDEXED BY messages_conversation_unread_count
      WHERE
        conversationId = $conversationId
        AND (type IS 'incoming' OR type IS 'outgoing')
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
      ORDER BY serverTimestamp DESC
      LIMIT 1;
      `
    )
      .pluck()
      .get({ conversationId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getMentionsYouMessageCount(
    conversationId: string,
    startTimestamp: number,
    endTimestamp: number
  ): number {
    const db = this.getConnection();

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT
        COUNT(*)
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $startTimestamp
        AND serverTimestamp <= $endTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND (
          json_extract(json, '$.mentionsQuoteFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x2
        );
      `
    )
      .pluck()
      .get({
        conversationId,
        startTimestamp,
        endTimestamp,
      });
  }

  public getMentionsYouMessage(
    conversationId: string,
    serverTimestamp: number,
    limit: number = 50
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND (
          json_extract(json, '$.mentionsQuoteFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x2
        )
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        serverTimestamp,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMentionsAtMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    who: 'YOU' | 'ALL',
    limit: number = 50
  ): MessageDBType[] {
    let flag = 0x1;

    if (who === 'YOU') {
      flag = 0x1;
    } else if (who === 'ALL') {
      flag = 0x2;
    } else {
      throw new Error(`Unsupported at flag for ${who}`);
    }

    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND json_extract(json, '$.mentionsAtFlags') & $flag
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        serverTimestamp,
        limit,
        flag,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMentionsAtYouMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    limit: number = 50
  ): MessageDBType[] {
    return this.getMentionsAtMessage(
      conversationId,
      serverTimestamp,
      'YOU',
      limit
    );
  }

  public getMentionsAtAllMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    limit: number = 50
  ): MessageDBType[] {
    return this.getMentionsAtMessage(
      conversationId,
      serverTimestamp,
      'ALL',
      limit
    );
  }

  public rebuildIndexesIfNotExists(): void {
    const db = this.getConnection();

    const logger = this.getLogger();

    logger.info('rebuildIndexesIfNotExists begin ...');

    db.exec(
      `
      DROP INDEX IF EXISTS messages_quote_temp;
      DROP INDEX IF EXISTS messages_atpersons_temp;

      CREATE INDEX IF NOT EXISTS messages_schemaVersion
        ON messages (
          schemaVersion
        );

      DROP INDEX IF EXISTS messages_quote_without_threadContext;
      -- CREATE INDEX IF NOT EXISTS messages_quote_without_threadContext
      --   ON messages (
      --     sent_at
      --   )
      --   WHERE pin IS NULL
      --     AND json_extract(json, '$.threadContext') IS NULL
      --     AND json_extract(json, '$.quote') IS NOT NULL
      --     AND sent_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_expires_at
        ON messages (
          expires_at ASC
        )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_without_timer
        ON messages (
          type,
          expireTimer
        )
        WHERE pin IS NULL
          AND expires_at IS NULL
          AND expireTimer IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_pin
        ON messages (
          conversationId,
          pin
        )
        WHERE pin IS NOT NULL;

      DROP INDEX IF EXISTS messages_unread;
      -- CREATE INDEX IF NOT EXISTS messages_unread
      --   ON messages (
      --     conversationId,
      --     unread,
      --     serverTimestamp DESC
      --   )
      --   WHERE pin IS NULL
      --     AND unread IS NOT NULL;

      DROP INDEX IF EXISTS messages_thread_unread;
      -- CREATE INDEX IF NOT EXISTS messages_thread_unread
      --   ON messages (
      --     conversationId,
      --     json_extract(json, '$.threadId'),
      --     unread,
      --     serverTimestamp DESC
      --   )
      --   WHERE pin IS NULL
      --     AND unread IS NOT NULL;

      DROP INDEX IF EXISTS messages_hasAttachments;
      -- CREATE INDEX IF NOT EXISTS messages_hasAttachments
      --   ON messages (
      --     conversationId,
      --     hasAttachments,
      --     serverTimestamp
      --   );

      CREATE INDEX IF NOT EXISTS messages_conversation
        ON messages (
            conversationId,
            serverTimestamp ASC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_conversation_source
        ON messages (
            conversationId,
            source,
            type,
            serverTimestamp ASC
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_source_st
        ON messages (
            conversationId,
            source,
            serverTimestamp ASC
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_hasVisualMediaAttachments
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND hasVisualMediaAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_hasVisualMediaAttachments_pin
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NOT NULL
          AND hasVisualMediaAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_hasFileAttachments
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND hasFileAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_thread_replied
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND (
            json_extract(json, '$.threadReplied') IS TRUE
            OR json_extract(json, '$.botContext') IS NULL
          );

      CREATE INDEX IF NOT EXISTS messages_thread_unreplied
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.threadReplied') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_conversation_visible
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          );

      CREATE INDEX IF NOT EXISTS messages_conversation_visible_unread
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          )
          AND unread = 1;

      CREATE INDEX IF NOT EXISTS messages_conversation_thread_visible
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          );

      CREATE INDEX IF NOT EXISTS messages_conversation_thread_visible_unread
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          )
          AND unread = 1;

      CREATE INDEX IF NOT EXISTS messages_duplicate_check
        ON messages (
            source,
            sourceDevice,
            sent_at
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_pin
        ON messages (
            pin
          )
        WHERE pin IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_receipt
        ON messages (
            sent_at,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      DROP INDEX IF EXISTS message_quote_without_thread;
      -- CREATE INDEX IF NOT EXISTS message_quote_without_thread
      --   ON messages (
      --       serverTimestamp DESC
      --     )
      --   WHERE
      --     pin IS NULL
      --     AND json_extract(json, '$.quote') IS NOT NULL
      --     AND json_extract(json, '$.threadContext') IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_has_read
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND unread IS NULL
          AND json_extract(json, '$.recall') IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_unread_count
        ON messages (
            conversationId,
            type,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.recall') IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_conversation_non_outgoing
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND type IS NOT 'outgoing';

      CREATE INDEX IF NOT EXISTS messages_mentions_you
        ON messages (
          conversationId,
          type,
          serverTimestamp
        )
        WHERE
          json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.recall') IS NULL
          AND pin IS NULL
          AND (
            json_extract(json, '$.mentionsQuoteFlags') & 0x1
            OR json_extract(json, '$.mentionsAtFlags') & 0x1
            OR json_extract(json, '$.mentionsAtFlags') & 0x2
          );

      CREATE INDEX IF NOT EXISTS messages_recall_source
        ON messages (
          serverTimestamp ASC
        )
        WHERE
          json_type(json, '$.recall') = 'object'
          AND json_extract(json, '$.recall.target') IS NULL;

      CREATE INDEX IF NOT EXISTS messages_recalled
        ON messages (
          serverTimestamp ASC
        )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS TRUE;

      CREATE INDEX IF NOT EXISTS read_position_conversation_read_at
        ON read_positions (
          conversationId,
          readAt ASC,
          maxServerTimestamp DESC
        );

      CREATE INDEX IF NOT EXISTS conversation_key_reset_at
        ON conversations (
          json_extract(json, '$.identityKeyResetAt')
        )
        WHERE
          type = 'private'
          AND json_extract(json, '$.identityKeyResetAt') IS NOT NULL;

      CREATE INDEX IF NOT EXISTS conversation_clear_anchor
        ON conversations (
          json_extract(json, '$.messageClearAnchor')
        )
        WHERE
          json_extract(json, '$.messageClearAnchor') IS NOT NULL;
      `
    );

    logger.info('rebuildIndexesIfNotExists end ...');
  }

  public rebuildTriggersIfNotExists(): void {
    const db = this.getConnection();
    const logger = this.getLogger();

    logger.info('rebuildTriggersIfNotExists start ...');

    db.transaction(() => {
      const maxRowId = db
        .prepare<EmptyQuery>(`SELECT MAX(rowid) from messages_fts;`)
        .pluck()
        .get();

      if (!maxRowId) {
        db.exec(
          `
          -- fill in fts table
          INSERT INTO messages_fts(rowid, body) SELECT rowid, body FROM messages;
          `
        );
      }

      db.exec(
        `
        CREATE TRIGGER IF NOT EXISTS messages_on_insert
        AFTER INSERT ON messages
        BEGIN
          INSERT INTO messages_fts (
            rowid,
            body
          ) VALUES (
            new.rowid,
            new.body
          );
        END;

        CREATE TRIGGER IF NOT EXISTS messages_on_delete
        AFTER DELETE ON messages
        BEGIN
          DELETE FROM messages_fts WHERE rowid = old.rowid;
        END;

        CREATE TRIGGER IF NOT EXISTS messages_on_update
        AFTER UPDATE ON messages
        BEGIN
          DELETE FROM messages_fts WHERE rowid = old.rowid;
          INSERT INTO messages_fts(
            rowid,
            body
          ) VALUES (
            new.rowid,
            new.body
          );
        END;
        `
      );
    })();

    logger.info('rebuildTriggersIfNotExists end ...');
  }

  public getGroupMemberLastActiveList(
    conversationId: string
  ): { number: string; lastActive: number }[] {
    const db = this.getConnection();
    const rows = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        source,
        MAX(serverTimestamp)
      FROM
        messages INDEXED BY messages_conversation_source
      WHERE
        pin IS NULL
        AND conversationId = $conversationId
        AND type = 'incoming'
        AND source IN (
          SELECT
            value
          FROM
            (
              SELECT
                json_extract(json, '$.members') AS members
              FROM
                conversations
              WHERE
                id = $conversationId
            ) AS temp,
            json_each(temp.members)
        )
      GROUP BY
        source;
      `
    ).all({ conversationId });

    return rows.map(row => ({
      number: '+' + row.source,
      lastActive: row['MAX(serverTimestamp)'],
    }));
  }

  // list all threads in conversation and return newest message in each of them
  public listThreadsWithNewestMessage(conversationId: string): MessageDBType[] {
    const conditions = conversationId
      ? 'AND conversationId = $conversationId'
      : `AND conversationId <> ''`;

    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json,
        MAX(serverTimestamp)
      FROM messages
      INDEXED BY messages_conversation_thread_visible
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        )
        ${conditions}
      GROUP BY
        json_extract(json, '$.threadId'),
        conversationId;
      `
    )
      .pluck()
      .all({ conversationId });

    return mapWithJsonToObject(jsons);
  }

  public getUnhandledRecalls(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        json_type(json, '$.recall') = 'object'
        AND json_extract(json, '$.recall.target') IS NULL
      ORDER BY serverTimestamp ASC;
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  protected _getRecalleds(db: Database, options: AscLimit) {
    const { ascConditions, ascParams } = this.getAscConditions(options);
    const params = [...ascParams, options.limit];

    const jsons = StatementCache.prepare<ArrayQuery>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS TRUE
        AND ${ascConditions}
      ORDER BY serverTimestamp ASC
      LIMIT ?;
      `
    )
      .pluck()
      .all(params);

    return mapWithJsonToObject<MessageDBType>(jsons);
  }

  public getNextMessagesToCorrectTimer(limit: number = 50): MessageDBType[] {
    const { ourNumber } = this.getOurNumberDevice() || {};
    if (!ourNumber) {
      throw new Error('invalid our number');
    }

    const db = this.getConnection();

    const jsons = db
      .prepare<Query>(
        `
        SELECT
          json
        FROM
          messages
        INDEXED BY messages_expires_at
        WHERE
          pin IS NULL
          AND expires_at IS NULL
          AND ( expireTimer IS NULL OR expireTimer = 0 )
          AND conversationId != $ourNumber
        LIMIT $limit;
        `
      )
      .pluck()
      .all({ ourNumber, limit });

    return mapWithJsonToObject(jsons);
  }

  // sessions v2
  public createOrUpdateSessionV2(data: SessionV2DBType): void {
    const { uid, identityKey, registrationId, msgEncVersion } = data;

    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR REPLACE INTO sessions_v2 (
        uid,
        json
      ) VALUES (
        $uid,
        $json
      );
      `
    ).run({
      uid,
      json: objectToJSON({
        identityKey,
        registrationId,
        msgEncVersion,
      }),
    });
  }

  public getSessionV2ById(uid: string): SessionV2DBType | undefined {
    const db = this.getConnection();
    const row = StatementCache.prepare<Query>(
      db,
      'SELECT * FROM sessions_v2 WHERE uid = $uid;'
    ).get({ uid });
    if (!row) {
      return undefined;
    }
    const { identityKey, registrationId, msgEncVersion } = JSON.parse(row.json);

    return {
      uid: row.uid + '', // should be string
      identityKey,
      registrationId,
      msgEncVersion,
    };
  }

  getReport(): Record<string, unknown> {
    const report = { name: 'main' };

    try {
      Object.assign(report, { size: fileSize(this.getFilesSize()) });

      const db = this.getConnection();

      Object.assign(report, {
        summary: [
          countTableRows(db, 'messages'),
          countTableRows(db, 'conversations'),
          countTableRows(db, 'read_positions'),
        ],
      });
    } catch (_error) {
      Object.assign(report, { error: 'database is not initialized.' });
    }

    return report;
  }
}
