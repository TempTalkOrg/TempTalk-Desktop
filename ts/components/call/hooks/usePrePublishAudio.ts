import { Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import { getLogger } from '../utils';

const logger = getLogger();

export const usePrePublishAudio = ({ room }: { room: Room }) => {
  const publishedSilenceAudioRef = useRef(false);

  useEffect(() => {
    room.once(RoomEvent.Connected, () => {
      if (room.ttCallResp?.callOptions?.publishSilenceAudio) {
        room.localParticipant.setMicrophoneEnabled(
          true,
          undefined,
          undefined,
          true
        );
      }
    });
  }, []);

  const prePublishAudio = useMemoizedFn(() => {
    try {
      const responseOptions = room.ttCallResp?.callOptions;
      if (
        responseOptions?.publishSilenceAudio === false &&
        responseOptions?.disableSilenceOnRaiseHand === false &&
        publishedSilenceAudioRef.current === false
      ) {
        room.localParticipant.setMicrophoneEnabled(
          true,
          undefined,
          undefined,
          true
        );
        publishedSilenceAudioRef.current = true;
      }
    } catch (e) {
      logger.error('pre publish audio error', e);
    }
  });

  return {
    prePublishAudio,
  };
};
