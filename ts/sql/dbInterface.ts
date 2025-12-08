import { LoggerType } from '../logger/types';
import {
  AttachmentDownloadJobDBType,
  ConversationDBType,
  IdentityKeyDBType,
  ItemDBType,
  MessageDBType,
  PreKeyDBType,
  ReadPositionDBType,
  SearchResultDBType,
  // RecordWithIdString,
  SessionDBType,
  SignedPreKeyDBType,
  UnprocessedDBType,
  SessionV2DBType,
} from './sqlTypes';

export type InitDBOption = {
  configDir: string;
  key: string;
  logger?: LoggerType;
  sqlFolder?: string;
};

export type CloseDBOption = { optimize: boolean; vacuum: boolean };

export interface ILocalDatabase {
  initialize(options: InitDBOption): void;
  close(options?: CloseDBOption): void;
  removeDB(): void;
  rekey(newKey: string): void;
  backup(backupDir: string): void;
  getFilesSize(): void;
}

export interface ILocalDBDatabase extends ILocalDatabase {
  // 'identityKeys'
  createOrUpdateIdentityKey(data: IdentityKeyDBType): void;
  getIdentityKeyById(id: string): IdentityKeyDBType | undefined;
  bulkAddIdentityKeys(array: IdentityKeyDBType[]): void;
  removeIdentityKeyById(id: string): void;
  removeAllIdentityKeys(): void;
  getAllIdentityKeys(): IdentityKeyDBType[];

  // 'preKeys'
  createOrUpdatePreKey(data: PreKeyDBType): void;
  getPreKeyById(id: string): PreKeyDBType | undefined;
  bulkAddPreKeys(array: PreKeyDBType[]): void;
  removePreKeyById(id: string): void;
  removeAllPreKeys(): void;
  getAllPreKeys(): PreKeyDBType[];

  // 'signedPreKeys'
  createOrUpdateSignedPreKey(data: SignedPreKeyDBType): void;
  getSignedPreKeyById(id: string): SignedPreKeyDBType | undefined;
  getAllSignedPreKeys(): SignedPreKeyDBType[];
  bulkAddSignedPreKeys(array: SignedPreKeyDBType[]): void;
  removeSignedPreKeyById(id: string): void;
  removeAllSignedPreKeys(): void;

  // 'items'
  createOrUpdateItem(data: ItemDBType): void;
  getItemById(id: string): ItemDBType | undefined;
  getAllItems(): ItemDBType[];
  bulkAddItems(array: ItemDBType[]): void;
  removeItemById(id: string): void;
  removeAllItems(): void;

  // sessions
  createOrUpdateSession(data: SessionDBType): void;
  getSessionById(id: string): SessionDBType | undefined;
  getSessionsByNumber(number: string): SessionDBType[];
  bulkAddSessions(array: SessionDBType[]): void;
  removeSessionById(id: string): void;
  removeSessionsByNumber(number: string): void;
  removeAllSessions(): void;
  getAllSessions(): SessionDBType[];

  // sessions v2
  createOrUpdateSessionV2(data: SessionV2DBType): void;
  getSessionV2ById(uid: string): SessionV2DBType | undefined;

  // "conversations"
  getConversationCount(): number;
  getStickConversationCount(): number;
  saveConversation(data: ConversationDBType): void;
  saveConversations(arrayOfConversations: ConversationDBType[]): void;
  updateConversation(data: ConversationDBType): void;
  updateConversations(arrayOfConversations: ConversationDBType[]): void;
  removeConversation(id: string[] | string): void;
  getConversationById(id: string): ConversationDBType | undefined;
  getAllConversations(): ConversationDBType[];
  getAllConversationIds(): string[];
  getAllPrivateConversations(): ConversationDBType[];
  getAllGroupsInvolvingId(id: string): ConversationDBType[];
  searchConversations(
    query: string,
    { limit }: { limit?: number }
  ): ConversationDBType[];

  // 'messages'
  getAllMessageCount(conversationId?: string): number;
  getMessageCountWithoutPin(conversationId: string): number;
  searchMessages(
    query: string,
    { conversationId, limit }: { conversationId?: string; limit?: number }
  ): SearchResultDBType[];
  searchMessagesInConversation(
    query: string,
    conversationId: string,
    { limit }: { limit?: number }
  ): SearchResultDBType[];
  saveMessage(
    data: MessageDBType,
    { forceSave }: { forceSave?: boolean }
  ): string;
  saveMessages(
    arrayOfMessages: MessageDBType[],
    { forceSave }: { forceSave?: boolean }
  ): void;
  removeMessage(id: string[] | string): void;
  getMessageById(id: string): MessageDBType | undefined;
  getAllMessages(): MessageDBType[];
  getAllMessageIds(): string[];
  getMessageBySender({
    source,
    sourceDevice,
    sent_at,
    fromCurrentDevice,
  }: {
    source: string;
    sourceDevice: number;
    sent_at: number;
    fromCurrentDevice?: boolean;
  }): MessageDBType[];
  getMessagesByConversation(
    conversationId: string,
    {
      limit,
      serverTimestamp,
      upward,
      equal,
      threadId,
      onlyUnread,
    }: {
      limit?: number;
      serverTimestamp?: number;
      upward?: boolean;
      equal?: boolean;
      threadId?: string;
      onlyUnread?: boolean;
    }
  ): MessageDBType[];
  getMessagesBySentAt(sentAt: number): MessageDBType[];
  getExpiredMessagesCount(expiresAt?: number): number;
  getExpiredMessages(): MessageDBType[];
  getOutgoingWithoutExpiresAt(): MessageDBType[];
  getNextExpiringMessage(): MessageDBType[];

  // unprocessed
  // only keep get all and remove all for migration
  getUnprocessedCount(): number;
  getAllUnprocessed(): UnprocessedDBType[];
  removeAllUnprocessed(): void;

  removeAll(): void;
  removeAllConfiguration(): void;

  getMessagesNeedingUpgrade(
    limit: number,
    { maxVersion }: { maxVersion: number }
  ): MessageDBType[];
  getMessagesWithVisualMediaAttachments(
    conversationId: string,
    { limit, isPin }: { limit: number; isPin: boolean }
  ): MessageDBType[];
  getMessagesWithFileAttachments(
    conversationId: string,
    { limit }: { limit: number }
  ): MessageDBType[];
  removeKnownAttachments(allAttachments: string[]): string[];

  //
  getThreadMessagesUnreplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number,
    limit: number
  ): MessageDBType[];
  findNewerThreadReplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number
  ): MessageDBType[];

  deletePinMessagesByConversationId(conversationId: string): void;
  getPinMessagesByConversationId(conversationId: string): MessageDBType[];
  getPinMessageById(pinId: string): MessageDBType | undefined;

  // read positions
  saveReadPosition(readPosition: ReadPositionDBType): void;
  saveReadPositions(readPositions: ReadPositionDBType[]): void;
  topReadPosition(conversationId: string): ReadPositionDBType | undefined;
  getReadPositions(
    conversationId: string,
    {
      begin,
      end,
      includeBegin,
      includeEnd,
      limit,
    }: {
      begin?: number;
      end?: number;
      includeBegin?: boolean;
      includeEnd?: boolean;
      limit?: number;
    }
  ): ReadPositionDBType[];

  //
  getUnreadMessages(
    conversationId: string,
    start: number,
    end: number,
    limit: number
  ): MessageDBType[];
  getUnreadMessageCount(
    conversationId: string,
    start: number,
    end: number
  ): number;
  findLastReadMessage(conversationId: string): MessageDBType | undefined;
  findLastMessageForMarkRead(
    conversationId: string,
    serverTimestamp: number
  ): (MessageDBType | undefined)[];
  findLastUserMessage(conversationId: string): MessageDBType | undefined;
  getMentionsYouMessageCount(
    conversationId: string,
    startTimestamp: number,
    endTimestamp: number
  ): number;
  getMentionsYouMessage(
    conversationId: string,
    serverTimestamp: number,
    limit: number
  ): MessageDBType[];
  getMentionsAtMessage(
    conversationId: string,
    serverTimestamp: number,
    who: 'YOU' | 'ALL',
    limit: number
  ): MessageDBType[];
  getMentionsAtYouMessage(
    conversationId: string,
    serverTimestamp: number,
    limit: number
  ): MessageDBType[];
  getMentionsAtAllMessage(
    conversationId: string,
    serverTimestamp: number,
    limit: number
  ): MessageDBType[];

  rebuildMessagesIndexesIfNotExists(): void;
  rebuildMessagesTriggersIfNotExists(): void;
  getGroupMemberLastActiveList(
    conversationId: string
  ): { number: string; lastActive: number }[];
  listThreadsWithNewestMessage(conversationId: string): MessageDBType[];
  getUnhandledRecalls(): MessageDBType[];

  getNextMessagesToCorrectTimer(
    ourNumber: string,
    limit: number
  ): MessageDBType[];
}

export interface ILocalDBAccelerator extends ILocalDatabase {
  // unprocessed
  saveUnprocessed(
    data: UnprocessedDBType,
    { forceSave }: { forceSave?: boolean }
  ): string;
  saveUnprocesseds(
    arrayOfUnprocessed: UnprocessedDBType[],
    { forceSave }: { forceSave?: boolean }
  ): void;
  updateUnprocessedWithData(id: string, data: UnprocessedDBType): void;
  updateUnprocessedsWithData(
    arrayOfUnprocessed: { id: string; data: UnprocessedDBType }[]
  ): void;
  getUnprocessedById(id: string): UnprocessedDBType | undefined;
  getUnprocessedCount(): number;
  getUnprocessedDuplicatedCount(): number;
  getAllUnprocessed(): UnprocessedDBType[];
  // removeUnprocesseds(ids: string[]): void;
  removeUnprocessed(id: string[] | string): void;
  removeAllUnprocessed(): void;
  deduplicateUnprocessed(): void;

  // attachment_downloads
  getNextAttachmentDownloadJobs(
    limit: number,
    options: { timestamp?: number }
  ): AttachmentDownloadJobDBType[];
  saveAttachmentDownloadJob(job: AttachmentDownloadJobDBType): void;
  setAttachmentDownloadJobPending(id: string, pending: number): void;
  resetAttachmentDownloadPending(): void;
  removeAttachmentDownloadJob(id: string[] | string): void;
  removeAllAttachmentDownloadJobs(): void;

  accRemoveAll(): void;
  accRemoveAllConfiguration(): void;
}
