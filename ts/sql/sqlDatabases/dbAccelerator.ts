import { LoggerType } from '../../logger/types';

import { AttachmentDownloadJobDBType, UnprocessedDBType } from '../sqlTypes';
import { ILocalDBAccelerator } from '../dbInterface';

import { updateSchema } from '../schemaMigrate/accelerator';

import { Sqlite3Database } from './sqlite3Database';
import { TableUnprocessed } from '../sqlTables/sqlTableUnprocessed';
import { TableAttachmentDownloads } from '../sqlTables/sqlTableAttachmentDownloads';
import { Database } from '@signalapp/better-sqlite3';
import { join } from 'path';
import { countTableRows } from '../utils/sqlUtils';

export class DBAccelerator
  extends Sqlite3Database
  implements ILocalDBAccelerator
{
  private _methods: Function[];
  private _tableUnprocessed = new TableUnprocessed();
  private _tableAttachmentDownloads = new TableAttachmentDownloads();

  constructor(logger?: LoggerType) {
    super(logger);

    this._methods = [
      this.initialize,
      this.close,
      this.removeDB,
      this.rekey,
      this.backup,
      this.getFilesSize,

      // unprocessed
      this.saveUnprocessed,
      this.saveUnprocesseds,
      this.updateUnprocessedWithData,
      this.updateUnprocessedsWithData,
      this.getUnprocessedById,
      this.getUnprocessedCount,
      this.getUnprocessedDuplicatedCount,
      this.getAllUnprocessed,
      this.removeUnprocessed,
      this.removeAllUnprocessed,
      this.deduplicateUnprocessed,

      /// attachment_downloads
      this.getNextAttachmentDownloadJobs,
      this.saveAttachmentDownloadJob,
      this.setAttachmentDownloadJobPending,
      this.resetAttachmentDownloadPending,
      this.removeAttachmentDownloadJob,
      this.removeAllAttachmentDownloadJobs,

      this.accRemoveAll,
      this.accRemoveAllConfiguration,
    ];
  }

  getMethods() {
    return this._methods;
  }

  protected getDBFilePath(dbDir: string): string {
    return join(dbDir, 'acc.sqlite');
  }

  protected updateSchema(db: Database, logger: LoggerType) {
    return updateSchema(db, logger);
  }

  protected testWithSQL(db: Database) {
    return countTableRows(db, 'unprocessed');
  }

  saveUnprocessed(
    data: UnprocessedDBType,
    { forceSave }: { forceSave?: boolean | undefined }
  ): string {
    const db = this.getConnection();
    return this._tableUnprocessed.saveUnprocessed(db, data, { forceSave });
  }

  saveUnprocesseds(
    arrayOfUnprocessed: UnprocessedDBType[],
    { forceSave }: { forceSave?: boolean | undefined }
  ): void {
    const db = this.getConnection();
    return this._tableUnprocessed.saveUnprocesseds(db, arrayOfUnprocessed, {
      forceSave,
    });
  }

  updateUnprocessedWithData(id: string, data: UnprocessedDBType): void {
    const db = this.getConnection();
    return this._tableUnprocessed.updateUnprocessedWithData(db, id, data);
  }

  updateUnprocessedsWithData(
    arrayOfUnprocessed: { id: string; data: UnprocessedDBType }[]
  ): void {
    const db = this.getConnection();
    return this._tableUnprocessed.updateUnprocessedsWithData(
      db,
      arrayOfUnprocessed
    );
  }

  getUnprocessedById(id: string): UnprocessedDBType | undefined {
    const db = this.getConnection();
    return this._tableUnprocessed.getUnprocessedById(db, id);
  }

  getUnprocessedCount(): number {
    const db = this.getConnection();
    return this._tableUnprocessed.getUnprocessedCount(db);
  }

  getUnprocessedDuplicatedCount(): number {
    const db = this.getConnection();
    return this._tableUnprocessed.getUnprocessedDuplicatedCount(db);
  }

  getAllUnprocessed(): UnprocessedDBType[] {
    const db = this.getConnection();
    return this._tableUnprocessed.getAllUnprocessed(db);
  }

  removeUnprocessed(id: string | string[]): void {
    const db = this.getConnection();
    return this._tableUnprocessed.removeUnprocessed(db, id);
  }

  removeAllUnprocessed(): void {
    const db = this.getConnection();
    return this._tableUnprocessed.removeAllUnprocessed(db);
  }

  deduplicateUnprocessed(): void {
    const db = this.getConnection();
    return this._tableUnprocessed.deduplicateUnprocessed(db);
  }

  // attachment_downloads
  // 'attachment_downloads'
  getNextAttachmentDownloadJobs(
    limit: number,
    options: { timestamp?: number }
  ): AttachmentDownloadJobDBType[] {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.getNextAttachmentDownloadJobs(
      db,
      limit,
      options
    );
  }
  saveAttachmentDownloadJob(job: AttachmentDownloadJobDBType): void {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.saveAttachmentDownloadJob(db, job);
  }
  setAttachmentDownloadJobPending(id: string, pending: number): void {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.setAttachmentDownloadJobPending(
      db,
      id,
      pending
    );
  }
  resetAttachmentDownloadPending(): void {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.resetAttachmentDownloadPending(db);
  }
  removeAttachmentDownloadJob(id: string[] | string): void {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.removeAttachmentDownloadJob(db, id);
  }
  removeAllAttachmentDownloadJobs(): void {
    const db = this.getConnection();
    return this._tableAttachmentDownloads.removeAllAttachmentDownloadJobs(db);
  }

  accRemoveAll(): void {
    const db = this.getConnection();

    db.exec(
      `
      DELETE FROM unprocessed;
      DELETE FROM attachment_downloads;
      `
    );
  }

  accRemoveAllConfiguration(): void {
    const db = this.getConnection();

    db.exec(`DELETE FROM unprocessed;`);
  }
}
