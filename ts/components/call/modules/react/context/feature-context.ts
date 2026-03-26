import { Participant } from '@cc-livekit/livekit-client';
import { MenuProps } from 'antd';
import * as React from 'react';
import { LocalizerType } from '../../../../../types/Util';
import { GlobalConfigType } from '../../../atoms/globalConfigAtom';

export type DenoiseMode = GlobalConfigType['denoise']['mode'];

export interface FeatureFlags {
  i18n: LocalizerType;
  autoSubscription?: boolean;
  nameFormatter?: (participant: Participant) => string;
  renderParticipantPlaceholder?: (
    participant: Participant | undefined,
    extraProps?: Record<string, any>
  ) => any;
  type?: '1on1' | 'instant' | 'group';
  onHangup?: () => void;
  contactMap?: {
    [key: string]: any;
  };
  onSendMessage?: (message: string) => void;
  chatPresets?: string[];
  onContextMenu?: ({
    event,
    participant,
  }: {
    event: string;
    participant: Participant;
  }) => Promise<void>;
  muteOtherEnabled?: boolean;
  onEndCall?: () => void;
  onBackToMain?: () => void;
  raiseHandList?: { identity: string; ts: number; displayName: string }[];
  raiseHand: () => Promise<void>;
  cancelHand: (identities: string[]) => Promise<void>;
  denoiseEnable?: boolean;
  onDenoiseEnableChange?: (enable: boolean) => void;
  denoiseMode?: DenoiseMode;
  onDenoiseModeChange?: (mode: DenoiseMode) => void;
  criticalAlert?: {
    visible: boolean;
    menuItems: MenuProps['items'];
  };
  isSupportSystemMode: boolean;
  screenShareMode: 'default' | 'system';
  onScreenShareModeChange: (mode: 'default' | 'system') => void;
  onSendBubbleMessage?: (text: string) => void;
  onSendSpeedHint: (speed: 'slower' | 'faster') => void;
}

type FeatureContext<T extends boolean = false> = T extends true
  ? FeatureFlags
  : FeatureFlags | undefined;

/** @internal */
export const LKFeatureContext = React.createContext<FeatureFlags | undefined>(
  undefined
);

/**
 * @internal
 */
export function useFeatureContext<T extends boolean>(
  require?: T
): FeatureContext<T> {
  const ctx = React.useContext(LKFeatureContext) as FeatureContext<T>;
  if (require === true) {
    if (ctx) {
      return ctx;
    } else {
      throw Error('tried to access feature context, but none is present');
    }
  }
  return ctx;
}
