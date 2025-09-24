import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import { EmptyQuery, TableType } from '../../sqlTypes';
import { getAllCreateSQLs, StatementCache } from '../../utils/sqlUtils';

export function getUnprocessedDuplicatedCountInner(db: Database) {
  return StatementCache.prepare<EmptyQuery>(
    db,
    `
    SELECT count(*) FROM unprocessed
    WHERE unprocessed.ROWID NOT IN (
      SELECT MAX(unprocessed.ROWID) FROM unprocessed
      INDEXED BY unprocessed_duplicate_check
      GROUP BY envelope, source, sourceDevice, external
    );
    `
  )
    .pluck()
    .get();
}

export function updateToSchemaVersion21(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 21) {
    return;
  }

  logger.info('updateToSchemaVersion21: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- #1 index on conversations
      -- conversations_isSticker
      DROP INDEX IF EXISTS conversations_isSticker;
      CREATE INDEX conversations_isSticker
      ON conversations (
        json_extract(json, '$.isStick')
      )
      WHERE json_extract(json, '$.isStick') IS NOT NULL;

      -- #2 index on messages
      -- expiring_message_by_conversation_and_received_at
      DROP INDEX IF EXISTS expiring_message_by_conversation_and_received_at;
      CREATE INDEX expiring_message_by_conversation_and_received_at
      ON messages (
        conversationId,
        received_at
      )
      WHERE pin IS NULL;

      -- messages_conversation
      DROP INDEX IF EXISTS messages_conversation;
      CREATE INDEX messages_conversation
      ON messages (
        conversationId,
        received_at
      )
      WHERE pin IS NULL;

      -- messages_unread
      DROP INDEX IF EXISTS messages_unread;
      CREATE INDEX messages_unread
      ON messages (
        conversationId,
        unread,
        received_at DESC
      )
      WHERE pin IS NULL
        AND unread IS NOT NULL;

      -- messages_thread_unread
      DROP INDEX IF EXISTS messages_thread_unread;
      CREATE INDEX messages_thread_unread
      ON messages (
        conversationId,
        json_extract(json, '$.threadId'),
        unread,
        received_at DESC
      )
      WHERE pin IS NULL
        AND unread IS NOT NULL;

      -- messages_thread_replied
      DROP INDEX IF EXISTS messages_thread_replied;
      CREATE INDEX messages_thread_replied
      ON messages (
        conversationId,
        json_extract(json, '$.threadId'),
        json_extract(json, '$.threadReplied')
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL;

      -- messages_quote_without_threadContext
      DROP INDEX IF EXISTS messages_quote_without_threadContext;
      CREATE INDEX messages_quote_without_threadContext
      ON messages (
        sent_at
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.threadContext') IS NULL
        AND json_extract(json, '$.quote') IS NOT NULL
        AND sent_at IS NOT NULL;

      -- messages_expires_at
      DROP INDEX IF EXISTS messages_expires_at;
      CREATE INDEX messages_expires_at
      ON messages (
        expires_at ASC
      )
      WHERE pin IS NULL;

      -- messages_without_timer
      DROP INDEX IF EXISTS messages_without_timer;
      CREATE INDEX messages_without_timer
      ON messages (
        type,
        expireTimer
      )
      WHERE pin IS NULL
        AND expires_at IS NULL
        AND expireTimer IS NOT NULL;

      -- messages_receipt
      DROP INDEX IF EXISTS messages_receipt;
      CREATE INDEX messages_receipt ON messages (
        sent_at
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- messages_hasFileAttachments
      DROP INDEX IF EXISTS messages_hasFileAttachments;
      CREATE INDEX messages_hasFileAttachments ON messages (
        conversationId,
        hasFileAttachments,
        received_at DESC
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- messages_hasVisualMediaAttachments
      DROP INDEX IF EXISTS messages_hasVisualMediaAttachments;
      CREATE INDEX messages_hasVisualMediaAttachments ON messages (
        conversationId,
        hasVisualMediaAttachments,
        pin,
        received_at DESC
      )
      WHERE json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- messages_pin
      DROP INDEX IF EXISTS messages_pin;
      CREATE INDEX messages_pin ON messages(pin);

      -- messages_conversation_pin
      DROP INDEX IF EXISTS messages_conversation_pin;
      CREATE INDEX messages_conversation_pin
      ON messages (
        conversationId,
        pin
      )
      WHERE pin IS NOT NULL;

      -- messages_duplicate_check
      DROP INDEX IF EXISTS messages_duplicate_check;
      CREATE INDEX messages_duplicate_check
      ON messages (
        source,
        sourceDevice,
        sent_at,
        pin
      );

      -- #3 index on vote_messages
      -- vote_messages_messageId
      DROP INDEX IF EXISTS vote_messages_messageId;
      CREATE INDEX vote_messages_messageId ON vote_messages(messageId);

      -- #4 index on tasks
      -- tasks_taskId_version_readAtVersion
      DROP INDEX IF EXISTS tasks_taskId_version_readAtVersion;
      CREATE INDEX tasks_taskId_version_readAtVersion ON tasks (
        taskId,
        readAtVersion,
        version
      );

      -- tasks_remove
      DROP INDEX IF EXISTS tasks_remove;
      CREATE INDEX tasks_remove ON tasks (
        timestamp DESC
      ) WHERE remove IS NOT 1;
      `
    );

    db.pragma('user_version = 21');
  })();
  logger.info('updateToSchemaVersion21: success!');
}

export function updateToSchemaVersion22(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 22) {
    return;
  }

  logger.info('updateToSchemaVersion22: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- create index unprocessed_duplicate_check
      DROP INDEX IF EXISTS unprocessed_duplicate_check;
      CREATE INDEX unprocessed_duplicate_check ON unprocessed (
        source,
        sourceDevice,
        envelope,
        external
      );
      `
    );

    const duplicateCount = getUnprocessedDuplicatedCountInner(db);
    if (duplicateCount > 0) {
      // get all create sqls of unprocessed
      const createSQLs = getAllCreateSQLs(db, 'unprocessed');
      const { table: tableRows, index: indexRows } = createSQLs;

      if (!tableRows?.length) {
        throw new Error('table unprocessed was not found.');
      }

      // rename unprocessed to unprocessed_old
      db.exec('ALTER TABLE unprocessed RENAME TO unprocessed_old;');

      // recreate unprocessed
      db.exec(tableRows[0].sql);

      // select valid unprocessed
      db.exec(
        `
        INSERT INTO unprocessed
        SELECT * FROM unprocessed_old
        WHERE unprocessed_old.ROWID IN (
          SELECT MAX(unprocessed_old.ROWID) FROM unprocessed_old
          INDEXED BY unprocessed_duplicate_check
          GROUP BY envelope, source, sourceDevice, external
        );
        `
      );

      // drop old table
      db.exec('DROP TABLE unprocessed_old;');

      // re-create all indexes on unprocessed
      for (const row of indexRows) {
        db.exec(row.sql);
      }
    }

    db.pragma('user_version = 22');
  })();
  logger.info('updateToSchemaVersion22: success!');
}

export function updateToSchemaVersion23(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 23) {
    return;
  }

  logger.info('updateToSchemaVersion23: starting...');

  db.transaction(() => {
    const count = db
      .prepare<EmptyQuery>(
        'SELECT count(*) FROM messages WHERE conversationId IS NULL;'
      )
      .pluck()
      .get();

    if (count) {
      // get all create sqls of messages
      const createSQLs = getAllCreateSQLs(db, 'messages');
      const { table: tableRows, index: indexRows } = createSQLs;

      // create indexes for unexpected messages
      db.exec(
        `
        DROP INDEX IF EXISTS messages_unexpected_id;
        CREATE INDEX messages_unexpected_id ON messages (
          id
        )
        WHERE conversationId IS NULL
          AND received_at IS NULL
          AND expireTimer IS NULL
          AND source IS NULL
          AND unread IS NULL
          AND body IS NULL
          AND (sent_at = 0 OR sent_at IS NULL)
          AND (hasAttachments = 0 OR hasAttachments IS NULL);
        `
      );

      const tableCreateSQL = tableRows[0].sql;

      // generate table messages_unexpected create sql
      const tempSQL = tableCreateSQL.replace(
        /(CREATE TABLE) "?messages"?/i,
        '$1 IF NOT EXISTS messages_unexpected'
      );

      db.exec(
        `
        -- create table messages_unexpected
        ${tempSQL}

        -- rename messages to messages_old
        ALTER TABLE messages RENAME TO messages_old;

        -- re-create table messages
        ${tableCreateSQL}

        -- select all unexpect messages insert into table messages_unexpected
        INSERT INTO messages_unexpected
        SELECT * FROM messages_old
        INDEXED BY messages_unexpected_id
        WHERE conversationId IS NULL
          AND received_at IS NULL
          AND expireTimer IS NULL
          AND source IS NULL
          AND unread IS NULL
          AND body IS NULL
          AND (sent_at = 0 OR sent_at IS NULL)
          AND (hasAttachments = 0 OR hasAttachments IS NULL);

        -- select all valid messages into new table messages
        INSERT INTO messages
        SELECT * FROM messages_old
          WHERE messages_old.id
            NOT IN
            (SELECT id FROM messages_unexpected);

        -- drop unused table messages_old
        DROP TABLE messages_old;
        `
      );

      // re-create all indexes on messages
      for (const row of indexRows) {
        db.exec(row.sql);
      }
    }

    // messages_thread_replied
    db.exec(
      `
      DROP INDEX IF EXISTS messages_thread_replied;
      CREATE INDEX messages_thread_replied
      ON messages (
        conversationId,
        json_extract(json, '$.threadId'),
        json_extract(json, '$.threadReplied'),
        json_extract(json, '$.botContext'),
        received_at
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL;
      `
    );

    db.pragma('user_version = 23');
  })();

  logger.info('updateToSchemaVersion23: success!');
}

export function updateToSchemaVersion24(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 24) {
    return;
  }

  logger.info('updateToSchemaVersion24: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- re-construct messsages_fts
      DELETE FROM messages_fts;
      INSERT INTO messages_fts(id, body)
        SELECT id, body FROM messages;

      -- Then we set up triggers to keep the full-text search table up to date
      CREATE TRIGGER IF NOT EXISTS messages_on_insert
      AFTER INSERT ON messages
      BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;

      CREATE TRIGGER IF NOT EXISTS messages_on_delete
      AFTER DELETE ON messages
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS messages_on_update
      AFTER UPDATE ON messages
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

    db.pragma('user_version = 24');
  })();

  logger.info('updateToSchemaVersion24: success!');
}

function migrateMessagesTable(
  db: Database,
  logger: LoggerType,
  tableName: TableType,
  timestamp: number
) {
  logger.info('starting migrate table', tableName, 'at', timestamp);

  const createSQLs = getAllCreateSQLs(db, tableName);

  const {
    table: tableRows,
    index: indexRows,
    trigger: triggerRows,
  } = createSQLs;

  if (!tableRows?.length) {
    logger.info(`table ${tableName} was not found.`);
    return;
  }

  const tableCreateSQL = tableRows[0].sql;

  // rename table to tempTableName
  const tempTableName = `${tableName}_${timestamp}`;
  db.exec(`ALTER TABLE ${tableName} RENAME TO ${tempTableName};`);

  // re-create table
  db.exec(tableCreateSQL);

  if (tableCreateSQL.includes('serverTimestamp')) {
    db.exec(
      `
      INSERT OR REPLACE INTO ${tableName}
      SELECT
        id,
        json_set(
          json,
          '$.serverTimestamp',
          CASE
            WHEN serverTimestamp THEN serverTimestamp
            WHEN sent_at THEN sent_at
            WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
            WHEN received_at THEN received_at
            WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
            ELSE serverTimestamp
          END
        ) AS json,
        unread,
        expires_at,
        CASE
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          ELSE sent_at
        END AS sent_at,
        schemaVersion,
        conversationId,
        CASE
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          ELSE received_at
        END AS received_at,
        source,
        sourceDevice,
        hasAttachments,
        hasFileAttachments,
        hasVisualMediaAttachments,
        expireTimer,
        expirationStartTimestamp,
        type,
        body,
        atPersons,
        pin,
        CASE
          WHEN serverTimestamp THEN serverTimestamp
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          ELSE serverTimestamp
        END AS serverTimestamp
      FROM ${tempTableName};
      `
    );
  } else {
    db.exec(
      `
      -- alter table messages to add column
      ALTER TABLE ${tableName} ADD COLUMN serverTimestamp INTEGER;

      -- insert messages into new table
      INSERT OR REPLACE INTO ${tableName}
      SELECT
        id,
        json_set(
          json,
          '$.serverTimestamp',
          CASE
            WHEN sent_at THEN sent_at
            WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
            WHEN received_at THEN received_at
            WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
            ELSE sent_at
          END
        ) AS json,
        unread,
        expires_at,
        CASE
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          ELSE sent_at
        END AS sent_at,
        schemaVersion,
        conversationId,
        CASE
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          ELSE received_at
        END AS received_at,
        source,
        sourceDevice,
        hasAttachments,
        hasFileAttachments,
        hasVisualMediaAttachments,
        expireTimer,
        expirationStartTimestamp,
        type,
        body,
        atPersons,
        pin,
        CASE
          WHEN sent_at THEN sent_at
          WHEN json_extract(json, '$.sent_at') THEN json_extract(json, '$.sent_at')
          WHEN received_at THEN received_at
          WHEN json_extract(json, '$.received_at') THEN json_extract(json, '$.received_at')
          ELSE sent_at
        END AS serverTimestamp
      FROM ${tempTableName};
      `
    );
  }

  // drop unused temp table
  db.exec(`DROP TABLE ${tempTableName};`);

  // re-create all indexes on messages
  if (indexRows?.length) {
    for (const row of indexRows) {
      db.exec(row.sql);
    }
  } else {
    logger.info('there is no index in table', tableName);
  }

  // re-create all triggers on messages
  if (triggerRows?.length) {
    for (const row of triggerRows) {
      db.exec(row.sql);
    }
  } else {
    logger.info('there is no triggers in table', tableName);
  }
}

export function updateToSchemaVersion25(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 25) {
    return;
  }

  logger.info('updateToSchemaVersion25: starting...');

  db.transaction(() => {
    const now = Date.now();

    migrateMessagesTable(db, logger, 'messages', now);
    migrateMessagesTable(db, logger, 'messages_expired', now);

    db.exec(
      `
      -- expiring_message_by_conversation_and_received_at
      DROP INDEX IF EXISTS expiring_message_by_conversation_and_received_at;

      -- messages_conversation
      DROP INDEX IF EXISTS messages_conversation;
      CREATE INDEX messages_conversation
      ON messages (
        conversationId,
        type,
        serverTimestamp
      )
      WHERE pin IS NULL;

      -- messages_unread
      DROP INDEX IF EXISTS messages_unread;
      CREATE INDEX messages_unread
      ON messages (
        conversationId,
        unread,
        serverTimestamp DESC
      )
      WHERE pin IS NULL
        AND unread IS NOT NULL;

      -- messages_thread_unread
      DROP INDEX IF EXISTS messages_thread_unread;
      CREATE INDEX messages_thread_unread
      ON messages (
        conversationId,
        json_extract(json, '$.threadId'),
        unread,
        serverTimestamp DESC
      )
      WHERE pin IS NULL
        AND unread IS NOT NULL;

      -- messages_thread_replied
      DROP INDEX IF EXISTS messages_thread_replied;
      CREATE INDEX messages_thread_replied
      ON messages (
        conversationId,
        json_extract(json, '$.threadId'),
        json_extract(json, '$.threadReplied'),
        json_extract(json, '$.botContext'),
        serverTimestamp
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL;

      -- messages_hasAttachments
      DROP INDEX IF EXISTS messages_hasAttachments;
      CREATE INDEX messages_hasAttachments ON messages (
        conversationId,
        hasAttachments,
        serverTimestamp
      );

      -- messages_hasFileAttachments
      DROP INDEX IF EXISTS messages_hasFileAttachments;
      CREATE INDEX messages_hasFileAttachments ON messages (
        conversationId,
        hasFileAttachments,
        serverTimestamp DESC
      )
      WHERE pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- messages_hasVisualMediaAttachments
      DROP INDEX IF EXISTS messages_hasVisualMediaAttachments;
      CREATE INDEX messages_hasVisualMediaAttachments ON messages (
        conversationId,
        hasVisualMediaAttachments,
        pin,
        serverTimestamp DESC
      )
      WHERE json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- create table for ourselves' read positions
      CREATE TABLE IF NOT EXISTS read_positions(
        sourceDevice TEXT,
        conversationId TEXT,
        maxServerTimestamp INTEGER,
        readAt INTEGER,
        sender TEXT,
        sentAt INTEGER,
        PRIMARY KEY(sourceDevice, conversationId, maxServerTimestamp)
      );

      -- read_position_conversation
      DROP INDEX IF EXISTS read_position_conversation;
      CREATE INDEX read_position_conversation ON read_positions (
        conversationId,
        maxServerTimestamp
      );
      `
    );

    db.pragma('user_version = 25');
  })();

  logger.info('updateToSchemaVersion25: success!');
}
