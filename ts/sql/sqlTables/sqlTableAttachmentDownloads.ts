import { Database } from '@signalapp/better-sqlite3';
import { CommonTable } from './sqlCommonTable';
import { AttachmentDownloadJobDBType, EmptyQuery, Query } from '../sqlTypes';
import {
  mapWithJsonToObject,
  objectToJSON,
  StatementCache,
} from '../utils/sqlUtils';

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
export class TableAttachmentDownloads extends CommonTable {
  constructor() {
    super(ATTACHMENT_DOWNLOADS_TABLE);
  }

  public getNextAttachmentDownloadJobs(
    db: Database,
    limit: number,
    options: { timestamp?: number }
  ): AttachmentDownloadJobDBType[] {
    const timestamp = options?.timestamp || Date.now();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM attachment_downloads
      WHERE pending = 0 AND timestamp < $timestamp
      ORDER BY timestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({ limit, timestamp });

    return mapWithJsonToObject(jsons);
  }

  public saveAttachmentDownloadJob(
    db: Database,
    job: AttachmentDownloadJobDBType
  ): void {
    const { id } = job;
    if (!id) {
      throw new Error(
        'saveAttachmentDownloadJob: Provided job did not have a truthy id'
      );
    }

    const { pending, timestamp } = job;
    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR REPLACE INTO attachment_downloads (
        id,
        pending,
        timestamp,
        json
      ) VALUES (
        $id,
        $pending,
        $timestamp,
        $json
      );
      `
    ).run({
      id,
      pending,
      timestamp,
      json: objectToJSON(job),
    });
  }

  public setAttachmentDownloadJobPending(
    db: Database,
    id: string,
    pending: number
  ): void {
    StatementCache.prepare<Query>(
      db,
      `UPDATE attachment_downloads SET pending = $pending WHERE id = $id;`
    ).run({
      id,
      pending,
    });
  }

  public resetAttachmentDownloadPending(db: Database): void {
    StatementCache.prepare<EmptyQuery>(
      db,
      'UPDATE attachment_downloads SET pending = 0 WHERE pending != 0;'
    ).run();
  }

  public removeAttachmentDownloadJob(
    db: Database,
    id: string[] | string
  ): void {
    this.removeById(db, id);
  }

  public removeAllAttachmentDownloadJobs(db: Database): void {
    this.removeAllFromTable(db);
  }
}
