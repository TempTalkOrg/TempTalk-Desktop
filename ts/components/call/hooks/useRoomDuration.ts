import { useMemoizedFn } from 'ahooks';
import { ConnectionState, Room } from '@cc-livekit/livekit-client';
import { useRef, useCallback, useEffect } from 'react';
import { currentCall } from '../initCall';
import { useConnectionState } from '../modules/react';
import { useAtom } from 'jotai';
import { roomDurationAtom } from '../atoms/roomAtom';

export function useRoomDuration(room: Room) {
  const [duration, setDuration] = useAtom(roomDurationAtom);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionState = useConnectionState(room);

  const start = useCallback(() => {
    if (timerRef.current !== null) return; // Prevent multiple intervals
    timerRef.current = setInterval(() => {
      setDuration(prevDuration => prevDuration + 1);
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    pause();
    setDuration(0);
  }, [pause]);

  const checkRoomDuration = useMemoizedFn(() => {
    if (duration === 0) {
      if (room.remoteParticipants.size > 0 || !currentCall.isPrivate) {
        start();
        (window as any).syncCallTimer({
          type: currentCall.type,
          roomId: currentCall.roomId,
          conversation: currentCall.isPrivate
            ? currentCall.number
            : currentCall.groupId,
        });
      }
    }
  });

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      checkRoomDuration();
    }
  }, [room.remoteParticipants.size, connectionState]);

  return { duration, start, pause, reset };
}
