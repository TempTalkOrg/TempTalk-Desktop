import { atom } from 'jotai';

export interface IRoomInfo {
  token?: string;
  key?: ArrayBuffer;
  serviceUrl: string;
  serviceUrls: string[];
  type?: '1on1' | 'instant' | 'group';
  roomName?: string;
}

export const roomAtom = atom<IRoomInfo>({} as IRoomInfo);

export const roomDurationAtom = atom<number>(0);
