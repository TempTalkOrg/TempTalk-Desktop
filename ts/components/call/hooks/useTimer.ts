import { useMemoizedFn } from 'ahooks';
import { ConnectionState, Room } from '@cc-livekit/livekit-client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { currentCall } from '../initCall';
import { useConnectionState } from '../modules/react';

export function useTimer(room: Room) {
  const [count, setCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionState = useConnectionState(room);

  const start = useCallback(() => {
    if (timerRef.current !== null) return; // Prevent multiple intervals
    timerRef.current = setInterval(() => {
      setCount(prevCount => prevCount + 1);
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
    setCount(0);
  }, [pause]);

  const checkTimer = useMemoizedFn(() => {
    if (count === 0) {
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
      checkTimer();
    }
  }, [room.remoteParticipants.size, connectionState]);

  return { count, start, pause, reset };
}
