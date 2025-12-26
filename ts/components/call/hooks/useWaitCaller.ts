import { useMemoizedFn } from 'ahooks';
import { RemoteParticipant, Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect, useRef } from 'react';
import { getLogger } from '../utils';
import playAudio from '../PlayAudio';
import { currentCall } from '../initCall';

const logger = getLogger();

interface IProps {
  room: Room;
  onTimeout?: () => void;
  convertToInstantCall?: () => void;
}

export const useWaitCaller = ({
  room,
  onTimeout,
  convertToInstantCall,
}: IProps) => {
  const waittingTimeoutRef = useRef<any>(null);

  const startWaitting = useMemoizedFn(() => {
    logger.info('start waitting remote');
    playAudio('call-initiative');

    waittingTimeoutRef.current = setTimeout(() => {
      onTimeout?.();
    }, 1000 * 60);
  });

  const onLocalConnected = useMemoizedFn(() => {
    if (
      room.remoteParticipants.size === 0 &&
      currentCall.type === '1on1' &&
      !currentCall.isPassive
    ) {
      startWaitting();
    }
    if (currentCall.type === '1on1' && room.remoteParticipants.size > 1) {
      convertToInstantCall?.();
    }
    logger.info('local connected', room, currentCall.roomId);
  });

  const handleParticipantConnected = useMemoizedFn(
    (participant: RemoteParticipant) => {
      logger.info('participant connected', participant.identity);
      // cleanup callin audio
      playAudio('');

      if (waittingTimeoutRef.current) {
        clearTimeout(waittingTimeoutRef.current);
        waittingTimeoutRef.current = null;
      }

      // 1on1 被叫转 instant
      if (currentCall.type === '1on1') {
        (window as any).addJoinCallButton({ ...currentCall });
        console.log('[add-call-button]', '1on1 participant connected.');
        if (room.remoteParticipants.size > 1) {
          convertToInstantCall?.();
        }
      }
    }
  );

  useEffect(() => {
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.Connected, onLocalConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.Connected, onLocalConnected);
    };
  }, []);
};
