import { atom } from 'jotai';

export type GlobalConfigType = {
  muteOtherEnabled: boolean;
  createCallMsg: boolean;
  countdownTimerEnabled: boolean;
  countdownTimer: {
    warningThreshold: number;
    shakingThreshold: number;
  };
  denoise: {
    bluetooth: {
      excludedNameRegex: string;
    };
  };
};

export const globalConfigAtom = atom<GlobalConfigType>({
  muteOtherEnabled: false,
  createCallMsg: false,
  countdownTimerEnabled: false,
  countdownTimer: {
    warningThreshold: 10000,
    shakingThreshold: 5000,
  },
  denoise: {
    bluetooth: {
      excludedNameRegex: '',
    },
  },
});
