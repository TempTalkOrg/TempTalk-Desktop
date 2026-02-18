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
  bubbleMessage: {
    emojiPresets: string[];
    textPresets: string[];
    columns: number[];
    baseSpeed: number;
    deltaSpeed: number;
  };
  chatMessage: {
    maxLength: number;
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
  bubbleMessage: {
    emojiPresets: ['👍', '👏', '🎉', '🚀', '❤️', '😂'],
    textPresets: ['Agree ✅', 'Disagree ⛔️', 'Bye 👋', "Can't hear 🙉"],
    columns: [10, 40, 70],
    baseSpeed: 4600,
    deltaSpeed: 400,
  },
  chatMessage: {
    maxLength: 30,
  },
});
