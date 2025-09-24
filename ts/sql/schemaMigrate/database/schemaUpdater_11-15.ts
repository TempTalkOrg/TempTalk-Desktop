import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';
import { getCreateSQL } from '../../utils/sqlUtils';

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
    const createSQL = getCreateSQL(db, 'table', 'messages');

    const newSql = createSQL[0].sql.replace(
      /(CREATE TABLE) "?messages"?/i,
      '$1 IF NOT EXISTS messages_expired'
    );

    db.exec(newSql);

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
    db.exec(
      `
      CREATE TABLE tasks(
        taskId TEXT PRIMARY KEY,
        uid TEXT,
        gid TEXT,
        version INTEGER,
        readAtTime INTEGER,
        readAtVersion INTEGER,
        creator TEXT,
        timestamp INTEGER,
        updater TEXT,
        updateTime INTEGER,
        name TEXT,
        notes TEXT,
        message TEXT,
        dueTime INTEGER,
        priority INTEGER,
        status INTEGER,
        remove INTEGER,
        ext TEXT
      );

      -- task <--> conversation
      CREATE TABLE task_conversations (
        taskId TEXT,
        conversationId TEXT,
        PRIMARY KEY(taskId, conversationId)
      );

      -- task <--> messages
      CREATE TABLE task_messages(
        taskId TEXT,
        messageId TEXT,
        PRIMARY KEY(taskId, messageId)
      );

      -- task -> user role: 2-executor, 3-follower
      CREATE TABLE task_roles (
        taskId TEXT,
        uid TEXT,
        role INTEGER,
        PRIMARY KEY(taskId, uid, role)
      );
      `
    );

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
    db.exec(
      `
      CREATE TABLE votes(
        voteId TEXT PRIMARY KEY,
        gid TEXT,
        creator TEXT,
        version INTEGER,
        name TEXT,
        multiple INTEGER,
        options TEXT,
        selected TEXT,
        optionsCount TEXT,
        votersCount INTEGER,
        totalVotes INTEGER,
        dueTime INTEGER,
        status INTEGER
      );

      -- vote <--> messages
      CREATE TABLE vote_messages(
        voteId TEXT,
        messageId TEXT,
        PRIMARY KEY(voteId, messageId)
      );
      `
    );

    db.pragma('user_version = 15');
  })();

  logger.info('updateToSchemaVersion15: success!');
}
