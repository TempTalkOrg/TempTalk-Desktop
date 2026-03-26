import { atom } from 'jotai';

export interface IRoomInfo {
  token?: string;
  key?: ArrayBuffer;
  serviceUrl: string;
  // serviceUrls: string[];
  type?: '1on1' | 'instant' | 'group';
  roomName?: string;
}

export const roomAtom = atom<IRoomInfo>({} as IRoomInfo);

export const roomDurationAtom = atom<number>(0);

export const inviteMembersAtom = atom<Set<string>>(new Set([]));

export const immersiveModeAtom = atom<boolean>(false);
export const immersiveModeTimerAtom = atom<NodeJS.Timeout | null>(null);

export const pinnedControlsAtom = atom<boolean>(false);
