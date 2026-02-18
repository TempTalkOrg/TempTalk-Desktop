import { MainSQL } from './sqlMain';
import attachments from '../../app/attachments';
import sqlChannels from '../../app/sql_channel';
import attachmentChannel from '../../app/attachment_channel';
import { app, clipboard, dialog } from 'electron';
import { redactAll } from '../../js/modules/privacy';
import { formatError } from '../logger/utils';
import type { LoggerType } from '../logger/types';
import { consoleLogger } from '../logger/consoleLogger';

export class SqlManagement {
  private sql: MainSQL;
  private initialized: boolean;
  private logger?: LoggerType;

  constructor() {
    this.sql = new MainSQL();
    this.initialized = false;
  }

  private getLogger() {
    return this.logger || consoleLogger;
  }

  async initialize(options: {
    configDir: string;
    key: string;
    logger?: LoggerType;
  }) {
    if (options.logger) {
      this.logger = options.logger;
    }

    try {
      await this.sql.initialize(options);
    } catch (error) {
      this.getLogger().error(
        'sqlMain.initialize was unsuccessful; returning early',
        formatError(error)
      );
      throw error;
    }

    sqlChannels.initialize(this.sql);

    const { configDir } = options;

    await attachmentChannel.initialize({
      configDir,
      cleanupOrphanedAttachments: () =>
        this.cleanupOrphanedAttachments(configDir, true),
    });

    this.initialized = true;
  }

  public isInitialized() {
    return this.initialized;
  }

  async cleanupOrphanedAttachments(
    configDir: string,
    requireDoubleCheck: boolean = false
  ) {
    const logger = this.getLogger();
    const allAttachments = await attachments.getAllAttachments(configDir);

    const regex = /^[0-9a-f]{2}\/[0-9a-f]{64}$/;
    const [unmatchedSet, matchedSet] = allAttachments.reduce(
      (acc, value) => {
        acc[Number(regex.test(value))].add(value);
        return acc;
      },
      [new Set<string>(), new Set<string>()]
    );

    logger.info(
      `cleanupOrphanedAttachments: About ${matchedSet.size},${unmatchedSet.size} attachments`
    );

    const orphanedAttachments: string[] = await this.sql.sqlCallEasy(
      'removeKnownAttachments',
      Array.from(matchedSet),
      requireDoubleCheck
    );

    await attachments.deleteAll({
      userDataPath: configDir,
      attachments: orphanedAttachments,
    });

    this.getLogger().info(
      'cleanupOrphanedAttachments: done with files:',
      orphanedAttachments.length
    );
  }

  async close(exit: boolean) {
    if (this.initialized) {
      await this.sql.close(exit);
      this.initialized = false;
    }
  }

  async rekey(newKey: string) {
    await this.sql.rekey(newKey);
  }

  async backup() {
    return await this.sql.backup();
  }

  async onDatabaseError(
    error: Error,
    messages: { [id: string]: { message: string } }
  ) {
    const buttonIndex = dialog.showMessageBoxSync({
      buttons: [
        messages.copyErrorAndQuit.message,
        // locale.messages.deleteAndRestart.message,
      ],
      defaultId: 0,
      detail: redactAll(error?.message || error.stack),
      message: messages.databaseError.message,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 0) {
      clipboard.writeText(
        `Database startup error:\n\n${redactAll(error.stack)}`
      );
    } else {
      try {
        await this.sql.close(true);
      } catch (error) {
        this.getLogger().error(
          'close db failed when database error.',
          formatError(error)
        );
      }

      // await removeDB();
      // removeUserConfig();
      // app.relaunch();
    }

    app.exit(1);
  }

  async getReport() {
    return await this.sql.getReport();
  }

  async ensureAuxObjects() {
    const report = await this.getReport();
    this.getLogger().info('ensureAuxObjects db report:', report);

    await this.sql.sqlCallEasy('rebuildIndexesIfNotExists');
    await this.sql.sqlCallEasy('rebuildTriggersIfNotExists');
  }
}
