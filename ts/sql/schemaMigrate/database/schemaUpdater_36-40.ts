import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import { getCreateSQL } from '../../utils/sqlUtils';
import { EmptyQuery } from '../../sqlTypes';

export function updateToSchemaVersion36(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 36) {
    return;
  }

  logger.info('updateToSchemaVersion36: starting...');

  // -- searchMessages
  // -- searchMessagesInConversation
  // -- getUnreadMessages
  db.transaction(() => {
    db.exec(
      `
      DROP INDEX IF EXISTS messages_conversation;
      CREATE INDEX messages_conversation
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;
      `
    );

    db.pragma('user_version = 36');
  })();

  logger.info('updateToSchemaVersion36: success!');
}

export function updateToSchemaVersion37(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 37) {
    return;
  }

  logger.info('updateToSchemaVersion37: starting...');

  db.transaction(() => {
    const indexes = getCreateSQL(db, 'index', 'read_positions');

    db.exec(`
      CREATE TABLE IF NOT EXISTS read_positions_new (
        sourceDevice INTEGER NOT NULL,
        conversationId TEXT NOT NULL,
        maxServerTimestamp INTEGER NOT NULL,
        readAt INTEGER,
        sender TEXT,
        sentAt INTEGER,
        maxNotifySequenceId INTEGER,
        PRIMARY KEY(sourceDevice, conversationId, maxServerTimestamp)
      );
    `);

    db.exec(
      `
      INSERT INTO read_positions_new
        (
          sourceDevice,
          conversationId,
          maxServerTimestamp,
          readAt,
          sender,
          sentAt,
          maxNotifySequenceId
        )
      SELECT
        COALESCE(CAST(sourceDevice AS INTEGER), 999) AS dId,
        conversationId,
        COALESCE(maxServerTimestamp, 0) AS maxServerTimestamp,
        readAt,
        sender,
        sentAt,
        maxNotifySequenceId
      FROM
        read_positions
      WHERE
        TRUE
      GROUP BY dId, conversationId, maxServerTimestamp, readAt
      ON CONFLICT(sourceDevice, conversationId, maxServerTimestamp)
      DO UPDATE
        SET
          readAt =
            CASE
              WHEN readAt > excluded.readAt THEN excluded.readAt
              ELSE readAt
            END,
          sender = excluded.sender,
          sentAt = excluded.sentAt,
          maxNotifySequenceId = excluded.maxNotifySequenceId
        WHERE readAt > excluded.readAt
          OR sentAt IS NULL
          OR maxNotifySequenceId IS NULL;
      `
    );

    db.exec(`ALTER TABLE read_positions RENAME TO read_positions_old;`);
    db.exec(`ALTER TABLE read_positions_new RENAME TO read_positions;`);

    // rebuild indexes
    for (const index of indexes) {
      const { name, sql } = index;
      db.prepare<EmptyQuery>(`DROP INDEX IF EXISTS ${name}`).run();
      db.prepare<EmptyQuery>(sql).run();
    }

    db.pragma('user_version = 37');
  })();

  logger.info('updateToSchemaVersion37: success!');
}
