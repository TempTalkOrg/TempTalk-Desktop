import type { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import {
  getSQLCipherVersion,
  getSQLiteVersion,
  getUserVersion,
} from '../../utils/sqlUtils';
import { updateToSchemaVersion1 } from './schemaUpdater_00-05';

const SCHEMA_VERSIONS: Array<
  (currentVersion: number, db: Database, logger: LoggerType) => void
> = [updateToSchemaVersion1];

export function updateSchema(db: Database, logger: LoggerType) {
  const userVersion = getUserVersion(db);
  const sqliteVersion = getSQLiteVersion(db);
  const cipherVersion = getSQLCipherVersion(db);
  const maxUserVersion = SCHEMA_VERSIONS.length;

  logger.info(
    'accelerator updateSchema:',
    `Current user_version: ${userVersion};\n`,
    `Most recent schema version: ${maxUserVersion};`,
    `SQLite version: ${sqliteVersion};`,
    `SQLCipher version: ${cipherVersion};\n`
  );

  if (userVersion > maxUserVersion) {
    throw new Error(
      `SQL: User version is ${userVersion} but the expected maximum version ` +
        `is ${maxUserVersion}. Did you try to start an old version of TempTalk?`
    );
  }

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];
    runSchemaUpdate(userVersion, db, logger);
  }
}
