import { atom } from 'jotai';

export type ScreenShareStatus = {
  isSharing: boolean;
  isRequesting: boolean;
  isLocalSharing: boolean;
  approvalModalOpen: boolean;
  requireUsers: { identity: string; ts: string }[];
};

export const screenShareAtom = atom<ScreenShareStatus>({
  isSharing: false,
  isRequesting: false,
  isLocalSharing: false,
  approvalModalOpen: false,
  requireUsers: [],
});
