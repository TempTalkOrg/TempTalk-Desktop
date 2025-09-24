import type { Database } from '@signalapp/better-sqlite3';
import { getUnprocessedDuplicatedCountInner } from '../schemaMigrate/database/schemaUpdater_21-25';
import { ArrayQuery, EmptyQuery, Query, UnprocessedDBType } from '../sqlTypes';
import {
  batchQueryWithMultiVar,
  countTableRows,
  jsonToObject,
  objectToJSON,
  StatementCache,
} from '../utils/sqlUtils';

export class TableUnprocessed {
  // unprocessed
  public saveUnprocessed(
    db: Database,
    data: UnprocessedDBType,
    { forceSave }: { forceSave?: boolean } = {}
  ): string {
    const { id } = data;
    if (!id) {
      throw new Error('saveUnprocessed: id was falsey');
    }

    const { timestamp, version, attempts, envelope, external = null } = data;

    if (forceSave) {
      StatementCache.prepare<Query>(
        db,
        `
        INSERT INTO unprocessed (
          id,
          timestamp,
          version,
          attempts,
          envelope,
          external
        ) VALUES (
          $id,
          $timestamp,
          $version,
          $attempts,
          $envelope,
          $external
        );
        `
      ).run({
        id,
        timestamp,
        version,
        attempts,
        envelope,
        external: external ? objectToJSON(external) : null,
      });
    } else {
      StatementCache.prepare<Query>(
        db,
        `
        UPDATE unprocessed SET
          timestamp = $timestamp,
          version = $version,
          attempts = $attempts,
          envelope = $envelope,
          external = $external
        WHERE id = $id;
        `
      ).run({
        id,
        timestamp,
        version,
        attempts,
        envelope,
        external: external ? objectToJSON(external) : null,
      });
    }

    return id;
  }

  public saveUnprocesseds(
    db: Database,
    arrayOfUnprocessed: UnprocessedDBType[],
    { forceSave }: { forceSave?: boolean } = {}
  ): void {
    db.transaction(() => {
      for (const unprocessed of arrayOfUnprocessed) {
        this.saveUnprocessed(db, unprocessed, { forceSave });
      }
    })();
  }

  public updateUnprocessedWithData(
    db: Database,
    id: string,
    data: UnprocessedDBType
  ): void {
    const {
      source = null,
      sourceDevice = null,
      serverTimestamp = null,
      decrypted = null,
      external,
      attempts,
      requiredProtocolVersion = null,
    } = data;

    StatementCache.prepare<Query>(
      db,
      `
      UPDATE unprocessed SET
        source = $source,
        sourceDevice = $sourceDevice,
        serverTimestamp = $serverTimestamp,
        decrypted = $decrypted,
        external = $external,
        attempts = $attempts,
        requiredProtocolVersion = $requiredProtocolVersion
      WHERE id = $id;
      `
    ).run({
      id,
      source,
      sourceDevice,
      serverTimestamp,
      decrypted,
      external: external ? objectToJSON(external) : null,
      attempts,
      requiredProtocolVersion,
    });
  }

  public updateUnprocessedsWithData(
    db: Database,
    arrayOfUnprocessed: { id: string; data: UnprocessedDBType }[]
  ): void {
    db.transaction(() => {
      for (const unprocessed of arrayOfUnprocessed) {
        const { id, data } = unprocessed;
        this.updateUnprocessedWithData(db, id, data);
      }
    })();
  }

  public getUnprocessedById(
    db: Database,
    id: string
  ): UnprocessedDBType | undefined {
    const row = StatementCache.prepare<Query>(
      db,
      'SELECT * FROM unprocessed WHERE id = $id;'
    ).get({ id });

    if (!row) {
      return undefined;
    }

    if (row.external) {
      row.external = jsonToObject(row.external);
    }

    return row;
  }

  public getUnprocessedCount(db: Database): number {
    return countTableRows(db, 'unprocessed');
  }

  public getUnprocessedDuplicatedCount(db: Database): number {
    return getUnprocessedDuplicatedCountInner(db);
  }

  public getAllUnprocessed(db: Database): UnprocessedDBType[] {
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

  private removeUnprocesseds(db: Database, ids: string[]): void {
    if (!ids.length) {
      throw new Error('removeConversation: No id(s) to delete!');
    }

    // Our node interface doesn't seem to allow you to replace one single ? with an array
    db.prepare<ArrayQuery>(
      `
        DELETE FROM unprocessed
        WHERE id IN ( ${ids.map(() => '?').join(', ')} );
        `
    ).run(ids);
  }

  public removeUnprocessed(db: Database, id: string[] | string): void {
    // prettier-ignore
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      (ids: string[]) => this.removeUnprocesseds(db, ids)
    );
  }

  public removeAllUnprocessed(db: Database): void {
    db.exec('DELETE FROM unprocessed;');
  }

  public deduplicateUnprocessed(db: Database): void {
    StatementCache.prepare<EmptyQuery>(
      db,
      `
      DELETE FROM unprocessed
      WHERE unprocessed.ROWID NOT IN (
        SELECT MAX(unprocessed.ROWID) FROM unprocessed
        GROUP BY envelope, source, sourceDevice, external
      );
      `
    ).run();
  }
}
