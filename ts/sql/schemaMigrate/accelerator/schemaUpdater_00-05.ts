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
      CREATE TABLE attachment_downloads(
        id STRING primary key,
        timestamp INTEGER,
        pending INTEGER,
        json TEXT
      );

      CREATE INDEX attachment_downloads_pending
      ON attachment_downloads (
        pending
      ) WHERE pending != 0;

      CREATE INDEX attachment_downloads_timestamp
      ON attachment_downloads (
        timestamp
      ) WHERE pending = 0;

      CREATE TABLE unprocessed(
        id STRING,
        timestamp INTEGER,
        version INTEGER,
        attempts INTEGER,
        envelope TEXT,
        decrypted TEXT,
        source TEXT,
        sourceDevice INTEGER,
        serverTimestamp INTEGER,
        requiredProtocolVersion INTEGER,
        external TEXT
      );

      CREATE INDEX unprocessed_duplicate_check
      ON unprocessed (
        source,
        sourceDevice,
        envelope,
        external
      );

      CREATE INDEX unprocessed_id
      ON unprocessed (
        id
      );

      CREATE INDEX unprocessed_timestamp
      ON unprocessed (
        timestamp
      );
      `
    );

    db.pragma('user_version = 1');
  })();

  logger.info('updateToSchemaVersion1: success!');
}
