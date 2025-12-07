import { CallSender } from './types';

export interface ICurrentCall {
  roomName: string;
  roomId: string;
  isPrivate: boolean;
  isPassive: boolean;
  number: string;
  groupId: string;
  caller: string;
  type: '1on1' | 'instant' | 'group';
  ourNumber: string;
  emk?: string;
  mk?: ArrayBuffer;
  publicKey?: string;
  deviceId: string;
  ourName?: string;
  username: string;
  endingCall: boolean;
  callWindowId: number | null;
  serviceUrls: string[];
  criticalAlert: boolean;
}

export type CallInfoType = Omit<ICurrentCall, 'caller'> & {
  caller?: string;
  callWindowId: string;
};

export const getSourceId = (sourceId = '') => {
  if (!sourceId) {
    return null;
  }

  const idStr = sourceId.split(':')[1];

  return idStr ? Number(idStr) : null;
};

export const generateCurrentCall = (info: CallInfoType): ICurrentCall => {
  const ourNumber = info.username.split('.')[0];

  return {
    roomName: info.roomName,
    roomId: info.roomId,
    isPrivate: info.isPrivate,
    isPassive: Boolean(info.caller) && info.caller !== ourNumber,
    number: info.number,
    groupId: info.groupId,
    // 主叫 start call 时 caller 为空
    caller: info.caller || info.username,
    type: info.type,
    ourNumber,
    emk: info.emk,
    publicKey: info.publicKey,
    deviceId: info.deviceId,
    ourName: info.ourName,
    username: info.username,
    endingCall: false,
    callWindowId: getSourceId(info.callWindowId),
    serviceUrls: info.serviceUrls,
    criticalAlert: info.criticalAlert,
  };
};

function getCallingAPI() {
  const username = (window as any).getUserName();
  const password = (window as any).getPassword();

  (window as any).webapiServer = (window as any).WebAPI.connect({
    username,
    password,
  });

  return new (window as any).textsecure.CallSender(username, password);
}

type CallActionType = {
  StartCall: 'start-call';
  InviteMembers: 'invite-members';
};

type CallControlType = {
  StartCall: 'start-call';
  InviteMembers: 'invite-members';
};

export const currentCall: ICurrentCall = {} as ICurrentCall;
export const callingAPI: CallSender = getCallingAPI();

export const callActionType: CallActionType = (window as any).textsecure
  .CallActionType;
export const callControlType: CallControlType = (window as any).textsecure
  .CallControlType;

(window as any)._debug_current_call = currentCall;
