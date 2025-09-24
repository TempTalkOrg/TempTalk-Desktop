import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';

export function updateToSchemaVersion6(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 6) {
    return;
  }

  logger.info('updateToSchemaVersion6: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- key-value, ids are strings, one extra column
      CREATE TABLE sessions(
        id STRING PRIMARY KEY ASC,
        number STRING,
        json TEXT
      );

      CREATE INDEX sessions_number ON sessions (
        number
      ) WHERE number IS NOT NULL;

      -- key-value, ids are strings
      CREATE TABLE groups(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );

      CREATE TABLE identityKeys(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );

      CREATE TABLE items(
        id STRING PRIMARY KEY ASC,
        json TEXT
      );

      -- key-value, ids are integers
      CREATE TABLE preKeys(
        id INTEGER PRIMARY KEY ASC,
        json TEXT
      );
      CREATE TABLE signedPreKeys(
        id INTEGER PRIMARY KEY ASC,
        json TEXT
      );
      `
    );

    db.pragma('user_version = 6');
  })();

  logger.info('updateToSchemaVersion6: success!');
}

export function updateToSchemaVersion7(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 7) {
    return;
  }
  logger.info('updateToSchemaVersion7: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
      -- We create a new table then copy the data into it, since we can't modify columns
      DROP INDEX sessions_number;
      ALTER TABLE sessions RENAME TO sessions_old;

      CREATE TABLE sessions(
        id TEXT PRIMARY KEY,
        number TEXT,
        json TEXT
      );

      CREATE INDEX sessions_number ON sessions (
        number
      ) WHERE number IS NOT NULL;

      INSERT INTO sessions(id, number, json)
        SELECT '+' || id, number, json FROM sessions_old;
      DROP TABLE sessions_old;
      `
    );

    db.pragma('user_version = 7');
  })();

  logger.info('updateToSchemaVersion7: success!');
}

export function updateToSchemaVersion8(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 8) {
    return;
  }

  logger.info('updateToSchemaVersion8: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- First, we pull a new body field out of the message table's json blob
      ALTER TABLE messages
        ADD COLUMN body TEXT;
      UPDATE messages SET body = json_extract(json, '$.body');

      -- Then we create our full-text search table and populate it
      CREATE VIRTUAL TABLE messages_fts
        USING fts5(id UNINDEXED, body);

      INSERT INTO messages_fts(id, body)
        SELECT id, body FROM messages;

      -- Then we set up triggers to keep the full-text search table up to date
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
      CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;
      CREATE TRIGGER messages_on_update AFTER UPDATE ON messages BEGIN
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

    // For formatting search results:
    //   https://sqlite.org/fts5.html#the_highlight_function
    //   https://sqlite.org/fts5.html#the_snippet_function

    db.pragma('user_version = 8');
  })();

  logger.info('updateToSchemaVersion8: success!');
}

export function updateToSchemaVersion9(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 9) {
    return;
  }

  logger.info('updateToSchemaVersion9: starting...');

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE attachment_downloads(
        id STRING primary key,
        timestamp INTEGER,
        pending INTEGER,
        json TEXT
      );

      CREATE INDEX attachment_downloads_timestamp
        ON attachment_downloads (
          timestamp
      ) WHERE pending = 0;
      CREATE INDEX attachment_downloads_pending
        ON attachment_downloads (
          pending
      ) WHERE pending != 0;
      `
    );

    db.pragma('user_version = 9');
  })();

  logger.info('updateToSchemaVersion9: success!');
}

export function updateToSchemaVersion10(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 10) {
    return;
  }

  logger.info('updateToSchemaVersion10: starting...');

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX unprocessed_id;
      DROP INDEX unprocessed_timestamp;
      ALTER TABLE unprocessed RENAME TO unprocessed_old;

      CREATE TABLE unprocessed(
        id STRING,
        timestamp INTEGER,
        version INTEGER,
        attempts INTEGER,
        envelope TEXT,
        decrypted TEXT,
        source TEXT,
        sourceDevice TEXT,
        serverTimestamp INTEGER
      );

      CREATE INDEX unprocessed_id ON unprocessed (
        id
      );
      CREATE INDEX unprocessed_timestamp ON unprocessed (
        timestamp
      );

      INSERT INTO unprocessed (
        id,
        timestamp,
        version,
        attempts,
        envelope,
        decrypted,
        source,
        sourceDevice,
        serverTimestamp
      ) SELECT
        id,
        timestamp,
        json_extract(json, '$.version'),
        json_extract(json, '$.attempts'),
        json_extract(json, '$.envelope'),
        json_extract(json, '$.decrypted'),
        json_extract(json, '$.source'),
        json_extract(json, '$.sourceDevice'),
        json_extract(json, '$.serverTimestamp')
      FROM unprocessed_old;

      DROP TABLE unprocessed_old;
      `
    );

    db.pragma('user_version = 10');
  })();

  logger.info('updateToSchemaVersion10: success!');
}
