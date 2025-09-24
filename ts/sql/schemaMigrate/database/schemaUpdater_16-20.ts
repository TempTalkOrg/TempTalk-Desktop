import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';

export function updateToSchemaVersion17(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 17) {
    return;
  }

  logger.info('updateToSchemaVersion17: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        ADD COLUMN pin STRING;

      ALTER TABLE messages_expired
        ADD COLUMN pin STRING;
      `
    );

    db.pragma('user_version = 17');
  })();

  logger.info('updateToSchemaVersion17: success!');
}

export function updateToSchemaVersion18(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 18) {
    return;
  }

  logger.info('updateToSchemaVersion18: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE unprocessed
        ADD COLUMN requiredProtocolVersion INTEGER;

      ALTER TABLE unprocessed
        ADD COLUMN external TEXT;
      `
    );

    db.pragma('user_version = 18');
  })();

  logger.info('updateToSchemaVersion18: success!');
}

export function updateToSchemaVersion19(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 19) {
    return;
  }

  logger.info('updateToSchemaVersion19: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE votes
        ADD COLUMN anonymous INTEGER;
      `
    );

    db.pragma('user_version = 19');
  })();

  logger.info('updateToSchemaVersion19: success!');
}
