import { Participant, Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';
import { deferredSpeakingParticipantAtom } from '../atoms/deferredSpeakingParticipantAtom';
import { useAtom } from 'jotai';

export const useDeferredSpeakingParticipant = (room: Room) => {
  const [deferredSpeakingParticipant, setDeferredSpeakingParticipant] = useAtom(
    deferredSpeakingParticipantAtom
  );

  const updateTaskRef = useRef<NodeJS.Timeout | null>(null);
  const willUpdateToRef = useRef<Participant | null>(null);

  const handleActiveSpeakersChanged = useMemoizedFn(
    (participants: Participant[]) => {
      const speakingParticipant = participants[0];

      // skip duplicate update
      if (
        speakingParticipant &&
        speakingParticipant === deferredSpeakingParticipant &&
        willUpdateToRef.current === speakingParticipant
      ) {
        return;
      }

      // update immediately
      if (!deferredSpeakingParticipant && speakingParticipant) {
        setDeferredSpeakingParticipant(speakingParticipant);
        willUpdateToRef.current = null;
        return;
      }

      if (updateTaskRef.current) {
        clearTimeout(updateTaskRef.current);
        updateTaskRef.current = null;
      }

      const deferredTimeout = speakingParticipant ? 200 : 2500;

      willUpdateToRef.current = speakingParticipant;
      updateTaskRef.current = setTimeout(() => {
        setDeferredSpeakingParticipant(speakingParticipant);
        willUpdateToRef.current = null;
      }, deferredTimeout);
    }
  );

  useEffect(() => {
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    };
  }, []);
};
