export type TableType =
  | 'attachment_downloads'
  | 'conversations'
  | 'identityKeys'
  | 'items'
  | 'messages'
  | 'messages_expired'
  | 'preKeys'
  | 'sessions'
  | 'signedPreKeys'
  | 'unprocessed';

export type EmptyQuery = [];
export type ArrayQuery = Array<Array<null | number | bigint | string>>;
export type Query = {
  [key: string]: null | number | bigint | string | Uint8Array;
};

export type JSONRows = Array<{ readonly json: string }>;

export type RecordWithId = Record<string, unknown> & { id: string | number };
export type RecordWithIdString = Record<string, unknown> & { id: string };

export type SQLType = 'table' | 'index' | 'trigger';

export type IdentityKeyDBType = {} & RecordWithIdString;
export type PreKeyDBType = {} & RecordWithIdString;
export type SignedPreKeyDBType = {} & RecordWithIdString;
export type ItemDBType = {} & RecordWithIdString;
export type SessionDBType = { number: string } & RecordWithIdString;
export type AttachmentDownloadJobDBType = {
  pending: number;
  timestamp: number;
} & RecordWithIdString;

export type ConversationDBType = {
  active_at?: number | null;
  type: 'group' | 'private';
  members?: string[] | null;
  name?: string | null;
  profileName?: string | null;
} & RecordWithIdString;

export type MessageDBType = {
  body?: string | null;
  conversationId: string;
  expires_at?: number | null;
  hasAttachments?: number | null;
  hasFileAttachments?: number | null;
  hasVisualMediaAttachments?: number | null;
  id?: string | null;
  received_at: number;
  schemaVersion: number;
  sent_at: number;
  source?: string | null;
  sourceDevice?: number | null;
  type: string;
  unread: number;
  atPersons: string;
  expireTimer?: number | null;
  expirationStartTimestamp?: number | null;
  serverTimestamp?: number | null;
  pin?: string | null;
} & RecordWithIdString;
export type SearchResultDBType = MessageDBType & { snippet: string };

export type UnprocessedDBType = {
  timestamp: number;
  version: number;
  attempts: number;
  envelope: string;
  source?: string;
  sourceDevice?: number;
  serverTimestamp?: number;
  decrypted?: string;
  requiredProtocolVersion?: number;
  external?: string;
} & RecordWithIdString;

export type ReadPositionDBType = {
  sourceDevice: number;
  conversationId: string;
  maxServerTimestamp: number;
  readAt: number;
  sender?: string | null;
  sentAt?: number | null;
  maxNotifySequenceId?: number | null;
};

export type SessionV2DBType = {
  uid: string;
  identityKey: string;
  registrationId: number;
  msgEncVersion: number;
};

export type ThreadWorkerType = 'sql_worker_main' | 'sql_worker_acc';
