import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import { EmptyQuery } from '../../sqlTypes';

export function updateToSchemaVersion31(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 31) {
    return;
  }

  logger.info('updateToSchemaVersion31: starting...');

  // -- findLastReadMessage
  db.transaction(() => {
    db.exec(
      `
      DROP INDEX IF EXISTS messages_conversation_has_read;
      CREATE INDEX messages_conversation_has_read
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND unread IS NULL
          AND json_extract(json, '$.recall') IS NULL;
      `
    );

    db.pragma('user_version = 31');
  })();

  logger.info('updateToSchemaVersion31: success!');
}

export function updateToSchemaVersion32(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 32) {
    return;
  }

  logger.info('updateToSchemaVersion32: starting...');

  // -- table file_check_result
  // -- table url_check_result
  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE file_risk (
        file_id     INTEGER NOT NULL,
        sha256      TEXT NOT NULL,
        file_size   INTEGER NOT NULL,
        risk_status INTEGER NOT NULL,
        created_at  INTEGER NOT NULL,
        checked_at  INTEGER NOT NULL,
        PRIMARY KEY(file_id AUTOINCREMENT),
        UNIQUE(sha256, file_size)
      );

      CREATE TABLE url_risk (
        url_id      INTEGER NOT NULL,
        url         TEXT NOT NULL UNIQUE,
        risk_status INTEGER NOT NULL,
        created_at  INTEGER NOT NULL,
        checked_at  INTEGER NOT NULL,
        PRIMARY KEY(url_id AUTOINCREMENT)
      );
      `
    );

    db.pragma('user_version = 32');
  })();

  logger.info('updateToSchemaVersion32: success!');
}

export function updateToSchemaVersion33(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 33) {
    return;
  }

  logger.info('updateToSchemaVersion33: starting...');

  db.transaction(() => {
    db.exec(
      `
      DROP TRIGGER messages_on_update;
      CREATE TRIGGER messages_on_update
      AFTER UPDATE ON messages
      WHEN
        old.body IS NOT new.body
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
      `
    );

    db.pragma('user_version = 33');
  })();

  logger.info('updateToSchemaVersion33: success!');
}

export function updateToSchemaVersion34(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 34) {
    return;
  }

  logger.info('updateToSchemaVersion34: starting...');
  db.transaction(() => {
    db.exec(
      `
      -- key-value, ids are strings, one extra column
      CREATE TABLE sessions_v2(
        uid STRING UNIQUE PRIMARY KEY ASC,
        json TEXT
      );
      `
    );

    db.pragma('user_version = 34');
  })();

  logger.info('updateToSchemaVersion34: success!');
}

export function updateToSchemaVersion35(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 35) {
    return;
  }

  logger.info('updateToSchemaVersion35: starting...');

  db.transaction(() => {
    const tableSql = db
      .prepare<EmptyQuery>(
        `
        SELECT
          sql
        FROM
          sqlite_master
        WHERE
          name = 'messages_fts'
          AND type = 'table';
        `
      )
      .pluck()
      .get();

    if (!tableSql || tableSql.includes('id')) {
      db.exec(
        `
        -- recreate virtual table messages_fts
        DROP TABLE IF EXISTS messages_fts;

        CREATE VIRTUAL TABLE messages_fts USING fts5(body);

        DROP TRIGGER IF EXISTS messages_on_insert;
        CREATE TRIGGER messages_on_insert
        AFTER INSERT ON messages
        BEGIN
          INSERT INTO messages_fts(
            rowid,
            body
          ) VALUES (
            new.rowid,
            new.body
          );
        END;

        DROP TRIGGER IF EXISTS messages_on_delete;
        CREATE TRIGGER messages_on_delete
        AFTER DELETE ON messages
        BEGIN
          DELETE FROM messages_fts WHERE rowid = old.rowid;
        END;

        DROP TRIGGER IF EXISTS messages_on_update;
        CREATE TRIGGER messages_on_update
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
    }

    db.exec(`DELETE FROM messages_expired;`);

    db.pragma('user_version = 35');
  })();

  logger.info('updateToSchemaVersion35: success!');
}
