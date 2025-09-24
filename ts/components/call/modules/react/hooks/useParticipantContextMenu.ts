import { Participant } from '@cc-livekit/livekit-client';
import { useFeatureContext } from '../context';
import { MenuProps } from 'antd';

export const useParticipantContextMenu = () => {
  const features = useFeatureContext();
  const { onContextMenu, muteOtherEnabled } = features!;

  const getContextMenuItems = (participant: Participant) => {
    const items: MenuProps['items'] = [];

    if (
      !participant.isLocal &&
      participant.isMicrophoneEnabled &&
      muteOtherEnabled
    ) {
      items.push({
        label: 'Mute',
        key: 'mute',
        onClick: () => onContextMenu?.({ event: 'mute', participant }),
      });
    }

    return items;
  };

  return {
    getContextMenuItems,
  };
};
