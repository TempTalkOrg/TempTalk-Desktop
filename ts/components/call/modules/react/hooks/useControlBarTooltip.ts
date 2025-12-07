import type { TooltipProps } from 'antd';
import { useFeatureContext } from '../context';
import { useMemo } from 'react';
import { useLocalParticipant } from './useLocalParticipant';

type ControlBarTooltipData = {
  tooltipText: {
    microphone: string;
    video: string;
    screenShare: string;
    raiseHand: string;
    memberList: string;
    addMember: string;
    endCall: string;
    leaveCall: string;
    moreAction: string;
  };
  tooltipProps: TooltipProps;
};

const i18n = (window as any).i18n;

export const useControlBarTooltip = (): ControlBarTooltipData => {
  const { localParticipant } = useLocalParticipant();
  const featureFlags = useFeatureContext();

  const videoText = useMemo(() => {
    return i18n(
      `controlBar.${localParticipant.isCameraEnabled ? 'videoOff' : 'videoOn'}`
    );
  }, [localParticipant.isCameraEnabled]);

  const screenShareText = useMemo(() => {
    return i18n(
      `controlBar.${localParticipant.isScreenShareEnabled ? 'screenShareOff' : 'screenShareOn'}`
    );
  }, [localParticipant.isScreenShareEnabled]);

  const isRaised = useMemo(() => {
    return featureFlags?.raiseHandList?.some(
      item => item.identity === localParticipant?.identity
    );
  }, [featureFlags?.raiseHandList, localParticipant?.identity]);

  const raiseHandText = useMemo(() => {
    return i18n(`controlBar.${isRaised ? 'raiseHandOff' : 'raiseHandOn'}`);
  }, [isRaised]);

  return {
    tooltipText: {
      microphone: i18n('controlBar.microphone'),
      video: videoText,
      screenShare: screenShareText,
      raiseHand: raiseHandText,
      memberList: i18n('controlBar.memberList'),
      addMember: i18n('controlBar.addMember'),
      endCall: i18n('controlBar.endCall'),
      leaveCall: i18n('controlBar.leaveCall'),
      moreAction: i18n('controlBar.moreAction'),
    },
    tooltipProps: {
      mouseEnterDelay: 0.5,
      placement: 'top',
    },
  };
};
