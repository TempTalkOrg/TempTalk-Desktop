import { OverrideRequestType } from './hooks/useOverrideCallRequest';

type CallType = '1on1' | 'group' | 'instant';

type ConversationId = {
  number?: string;
  groupId?: string;
};

type StartCallOptions = {
  conversationId?: ConversationId;
  roomName?: string;
  type: string;
  version: number;
  timestamp: number;
  callees: string[];
  collapseId: string;
  ourNumber: string;
  needSync?: boolean;
  overrideRequest?: OverrideRequestType;
};

type JoinCallOptions = {
  roomId: string;
  type: string;
  version: number;
  timestamp: number;
};

type InviteCallOptions = {
  roomId: string;
  roomName?: string;
  conversationId?: ConversationId;
  caller: string;
  version: number;
  timestamp: number;
  callees: string[];
  collapseId: string;
};

type SyncJoinedCallOptions = {
  roomId: string;
  ourNumber: string;
};

type CancelCallOptions = {
  roomId: string;
  callees: string[];
  collapseId: string;
  type: CallType;
};

type RejectCallOptions = {
  roomId: string;
  callees: string[];
  collapseId: string;
  ourNumber: string;
  needSync?: boolean;
  type: CallType;
};

type HangupCallOptions = {
  roomId: string;
  callees: string[];
  collapseId: string;
  ourNumber: string;
  needSync?: boolean;
  type: CallType;
};

export type CallResponse = {
  caller: {
    uid: string;
    did: number;
  };
  createdAt: number;
  emk: string;
  key: ArrayBuffer;
  needsSync: boolean;
  publicKey: string;
  roomId: string;
  serviceUrl: string;
  token: string;
  version: number;
  missingCallees?: string[];
  timestamp: number;
  emkStale?: boolean;
  encMeta?: {
    name: string;
  };
  systemShowTimestamp: number;
  serviceUrls: string[];
};

export type CallSender = {
  listCalls(): Promise<any>;
  startCall(
    options: StartCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<CallResponse>;
  joinCall(
    options: JoinCallOptions
  ): Promise<Omit<CallResponse, 'missingCallees'>>;
  inviteCall(
    options: InviteCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<{
    systemShowTimestamp: number;
  }>;
  syncJoinedCall(
    options: SyncJoinedCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<void>;
  cancelCall(
    options: CancelCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<void>;
  rejectCall(
    options: RejectCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<any>;
  hangupCall(
    options: HangupCallOptions,
    roomCipher: CallRoomCipher
  ): Promise<void>;
  getCallToken(forceRefresh?: boolean): Promise<string>;
  sendCriticalAlert(options: {
    destination?: string;
    gid?: string;
  }): Promise<void>;
};

export declare class UserSessionCipher {
  getRawIdentityKey(): ArrayBuffer;
}

type CipherObject = {
  payload: string;
  signature: string;
};

export declare class CallRoomCipher {
  constructor(mKey: ArrayBuffer | string, encoding?: string);

  static from(
    emk: ArrayBuffer,
    publicKey: ArrayBuffer,
    ourPrivateKey?: ArrayBuffer
  ): Promise<CallRoomCipher>;
  static fromNewKey(): Promise<CallRoomCipher>;

  exportMKey(): ArrayBuffer;
  encrypt(
    buffer: ArrayBufferLike,
    privateKeyAB?: ArrayBuffer
  ): Promise<CipherObject>;
  decrypt(
    cipherObject: CipherObject,
    theirPublicKeyAB?: ArrayBuffer
  ): Promise<ArrayBuffer>;
}
