import type { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import {
  getSchemaVersion,
  getSQLCipherVersion,
  getSQLiteVersion,
  getUserVersion,
  setUserVersion,
} from '../../utils/sqlUtils';
import {
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
} from './schemaUpdater_00-05';
import {
  updateToSchemaVersion6,
  updateToSchemaVersion7,
  updateToSchemaVersion8,
  updateToSchemaVersion9,
  updateToSchemaVersion10,
} from './schemaUpdater_06-10';
import {
  updateToSchemaVersion11,
  updateToSchemaVersion12,
  updateToSchemaVersion13,
  updateToSchemaVersion14,
  updateToSchemaVersion15,
} from './schemaUpdater_11-15';
import {
  updateToSchemaVersion17,
  updateToSchemaVersion18,
  updateToSchemaVersion19,
} from './schemaUpdater_16-20';
import {
  updateToSchemaVersion21,
  updateToSchemaVersion22,
  updateToSchemaVersion23,
  updateToSchemaVersion24,
  updateToSchemaVersion25,
} from './schemaUpdater_21-25';
import {
  updateToSchemaVersion26,
  updateToSchemaVersion27,
  updateToSchemaVersion28,
  updateToSchemaVersion29,
  updateToSchemaVersion30,
} from './schemaUpdater_26-30';
import {
  updateToSchemaVersion31,
  updateToSchemaVersion32,
  updateToSchemaVersion33,
  updateToSchemaVersion34,
  updateToSchemaVersion35,
} from './schemaUpdater_31-35';

import {
  updateToSchemaVersion36,
  updateToSchemaVersion37,
} from './schemaUpdater_36-40';

const SCHEMA_VERSIONS: Array<
  (currentVersion: number, db: Database, logger: LoggerType) => void
> = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  (_v: number, _i: Database, _l: LoggerType): void => undefined, // version 5 was dropped
  updateToSchemaVersion6,
  updateToSchemaVersion7,
  updateToSchemaVersion8,
  updateToSchemaVersion9,
  updateToSchemaVersion10,
  updateToSchemaVersion11,
  updateToSchemaVersion12,
  updateToSchemaVersion13,
  updateToSchemaVersion14,
  updateToSchemaVersion15,
  (_v: number, _i: Database, _l: LoggerType): void => undefined, // version 16 was dropped
  updateToSchemaVersion17,
  updateToSchemaVersion18,
  updateToSchemaVersion19,
  (_v: number, _i: Database, _l: LoggerType): void => undefined, // version 20 was dropped
  updateToSchemaVersion21,
  updateToSchemaVersion22,
  updateToSchemaVersion23,
  updateToSchemaVersion24,
  updateToSchemaVersion25,
  updateToSchemaVersion26,
  updateToSchemaVersion27,
  updateToSchemaVersion28,
  updateToSchemaVersion29,
  updateToSchemaVersion30,
  updateToSchemaVersion31,
  updateToSchemaVersion32,
  updateToSchemaVersion33,
  updateToSchemaVersion34,
  updateToSchemaVersion35,
  updateToSchemaVersion36,
  updateToSchemaVersion37,
];

export const maxUserSchemaVersion = SCHEMA_VERSIONS.length;

export function updateSchema(db: Database, logger: LoggerType) {
  let userVersion = getUserVersion(db);
  const sqliteVersion = getSQLiteVersion(db);
  const schemaVersion = getSchemaVersion(db);
  const cipherVersion = getSQLCipherVersion(db);
  const maxUserVersion = SCHEMA_VERSIONS.length;

  // migrate schema_version to user_version if needed
  if (!(userVersion > 0) && schemaVersion > 0) {
    userVersion = schemaVersion > 24 ? 24 : schemaVersion;

    logger.info(
      'updateSchema: Migrating from schema_version ' +
        `${schemaVersion} to user_version ${userVersion}`
    );

    setUserVersion(db, userVersion);
  }

  logger.info(
    'updateSchema:',
    `Current user_version: ${userVersion};\n`,
    `Most recent schema version: ${maxUserVersion};`,
    `SQLite version: ${sqliteVersion};`,
    `SQLCipher version: ${cipherVersion};`,
    `(deprecated) schema_version: ${schemaVersion};\n`
  );

  if (userVersion > maxUserVersion) {
    throw new Error(
      `SQL: User version is ${userVersion} but the expected maximum version ` +
        `is ${maxUserVersion}. Did you try to start an old version of the app?`
    );
  }

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];
    runSchemaUpdate(userVersion, db, logger);
  }
}
