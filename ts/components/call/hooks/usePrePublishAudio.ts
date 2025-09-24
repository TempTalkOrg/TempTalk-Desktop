import { Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect } from 'react';
import { currentCall } from '../initCall';

export const usePrePublishAudio = ({ room }: { room: Room }) => {
  useEffect(() => {
    if (currentCall.type !== '1on1') {
      room.once(RoomEvent.Connected, () => {
        room.localParticipant.setMicrophoneEnabled(
          true,
          undefined,
          undefined,
          true
        );
      });
    }
  }, []);
};
