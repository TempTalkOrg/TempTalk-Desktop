import { useEffect } from 'react';
import { ConnectionState, Room } from '@cc-livekit/livekit-client';
import { useMemoizedFn } from 'ahooks';
import { useConnectionState } from '../modules/react';

export const useKeyBinding = ({ room }: { room: Room }) => {
  const connectionState = useConnectionState(room);

  const handleKeyDown = useMemoizedFn((event: KeyboardEvent) => {
    if (connectionState !== ConnectionState.Connected) {
      return;
    }
    // ignore keydown event on input element
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    if (event.code === 'Space') {
      room.localParticipant.setMicrophoneEnabled(
        !room.localParticipant.isMicrophoneEnabled
      );
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};
