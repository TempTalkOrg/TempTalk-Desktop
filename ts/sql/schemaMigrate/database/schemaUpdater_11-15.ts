import type { Database } from '@opensource-lib/better-sqlite3';
import type { LoggerType } from '../../../logger/types';

export function updateToSchemaVersion11(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 11) {
    return;
  }

  logger.info('updateToSchemaVersion11: starting...');

  db.transaction(() => {
    db.exec('DROP TABLE groups;');
    db.pragma('user_version = 11');
  })();

  logger.info('updateToSchemaVersion11: success!');
}

export function updateToSchemaVersion12(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 12) {
    return;
  }

  logger.info('updateToSchemaVersion12: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        ADD COLUMN atPersons STRING;

      UPDATE messages SET
        atPersons = json_extract(json, '$.atPersons');
      `
    );

    db.pragma('user_version = 12');
  })();

  logger.info('updateToSchemaVersion12: success!');
}

export function updateToSchemaVersion13(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 13) {
    return;
  }

  logger.info('updateToSchemaVersion13: starting...');

  db.transaction(() => {
    db.pragma('user_version = 13');
  })();

  logger.info('updateToSchemaVersion13: success!');
}

export function updateToSchemaVersion14(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 14) {
    return;
  }

  logger.info('updateToSchemaVersion14: starting...');

  db.transaction(() => {
    db.pragma('user_version = 14');
  })();

  logger.info('updateToSchemaVersion14: success!');
}

export function updateToSchemaVersion15(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 15) {
    return;
  }

  logger.info('updateToSchemaVersion15: starting...');

  db.transaction(() => {
    db.pragma('user_version = 15');
  })();

  logger.info('updateToSchemaVersion15: success!');
}
