import { useMemoizedFn } from 'ahooks';
import { Participant } from '@cc-livekit/livekit-client';

interface IProps {
  onMute: (participant: Participant) => void;
}

export const useParticipantContextmenu = ({ onMute }: IProps) => {
  const onContextMenu = useMemoizedFn(
    async (data: { event: string; participant: Participant }) => {
      switch (data.event) {
        case 'mute':
          await onMute?.(data.participant);
          break;
        default:
          break;
      }
    }
  );

  return {
    onContextMenu,
  };
};
