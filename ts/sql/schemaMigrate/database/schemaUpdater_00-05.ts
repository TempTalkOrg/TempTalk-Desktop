import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';

export function updateToSchemaVersion1(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1) {
    return;
  }

  logger.info('updateToSchemaVersion1: starting...');

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE messages(
        id STRING PRIMARY KEY ASC,
        json TEXT,

        unread INTEGER,
        expires_at INTEGER,
        sent_at INTEGER,
        schemaVersion INTEGER,
        conversationId STRING,
        received_at INTEGER,
        source STRING,
        sourceDevice STRING,
        hasAttachments INTEGER,
        hasFileAttachments INTEGER,
        hasVisualMediaAttachments INTEGER
      );
      CREATE INDEX messages_unread ON messages (
        unread
      );
      CREATE INDEX messages_expires_at ON messages (
        expires_at
      );
      CREATE INDEX messages_receipt ON messages (
        sent_at
      );
      CREATE INDEX messages_schemaVersion ON messages (
        schemaVersion
      );
      CREATE INDEX messages_conversation ON messages (
        conversationId,
        received_at
      );
      CREATE INDEX messages_duplicate_check ON messages (
        source,
        sourceDevice,
        sent_at
      );
      CREATE INDEX messages_hasAttachments ON messages (
        conversationId,
        hasAttachments,
        received_at
      );
      CREATE INDEX messages_hasFileAttachments ON messages (
        conversationId,
        hasFileAttachments,
        received_at
      );
      CREATE INDEX messages_hasVisualMediaAttachments ON messages (
        conversationId,
        hasVisualMediaAttachments,
        received_at
      );
      CREATE TABLE unprocessed(
        id STRING,
        timestamp INTEGER,
        json TEXT
      );
      CREATE INDEX unprocessed_id ON unprocessed (
        id
      );
      CREATE INDEX unprocessed_timestamp ON unprocessed (
        timestamp
      );
      `
    );

    db.pragma('user_version = 1');
  })();

  logger.info('updateToSchemaVersion1: success!');
}

export function updateToSchemaVersion2(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 2) {
    return;
  }

  logger.info('updateToSchemaVersion2: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        ADD COLUMN expireTimer INTEGER;

      ALTER TABLE messages
        ADD COLUMN expirationStartTimestamp INTEGER;

      ALTER TABLE messages
        ADD COLUMN type STRING;

      CREATE INDEX messages_expiring ON messages (
        expireTimer,
        expirationStartTimestamp,
        expires_at
      );

      UPDATE messages SET
        expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
        expireTimer = json_extract(json, '$.expireTimer'),
        type = json_extract(json, '$.type');
      `
    );
    db.pragma('user_version = 2');
  })();

  logger.info('updateToSchemaVersion2: success!');
}

export function updateToSchemaVersion3(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 3) {
    return;
  }

  logger.info('updateToSchemaVersion3: starting...');

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX messages_expiring;
      DROP INDEX messages_unread;

      CREATE INDEX messages_without_timer ON messages (
        expireTimer,
        expires_at,
        type
      ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;

      CREATE INDEX messages_unread ON messages (
        conversationId,
        unread
      ) WHERE unread IS NOT NULL;

      ANALYZE;
      `
    );

    db.pragma('user_version = 3');
  })();

  logger.info('updateToSchemaVersion3: success!');
}

export function updateToSchemaVersion4(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 4) {
    return;
  }

  logger.info('updateToSchemaVersion4: starting...');

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE conversations(
        id STRING PRIMARY KEY ASC,
        json TEXT,

        active_at INTEGER,
        type STRING,
        members TEXT,
        name TEXT,
        profileName TEXT
      );

      CREATE INDEX conversations_active ON conversations (
        active_at
      ) WHERE active_at IS NOT NULL;

      CREATE INDEX conversations_type ON conversations (
        type
      ) WHERE type IS NOT NULL;
      `
    );

    db.pragma('user_version = 4');
  })();

  logger.info('updateToSchemaVersion4: success!');
}
