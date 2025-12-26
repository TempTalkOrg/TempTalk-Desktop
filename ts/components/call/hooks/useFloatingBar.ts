import { useEffect, useRef } from 'react';
import {
  Participant,
  ParticipantEvent,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from '@cc-livekit/livekit-client';
import { useMemoizedFn } from 'ahooks';
import { Contact } from './useInitials';
import { currentCall } from '../initCall';
import { useToggleFloatingBar } from './useToggleFloatingBar';
import { useTracks } from '../modules/react';
import { useAtomValue } from 'jotai';
import { deferredSpeakingParticipantAtom } from '../atoms/deferredSpeakingParticipantAtom';

export const useFloatingBar = ({
  onHangup,
  room,
  contactMap,
}: {
  onHangup: () => void;
  room: Room;
  contactMap: Map<string, Contact>;
}) => {
  const deferredSpeakingParticipant = useAtomValue(
    deferredSpeakingParticipantAtom
  );

  const getParticipantInfo = useMemoizedFn((participant: Participant) => {
    if (!participant) {
      return undefined;
    }
    const uid = participant.identity.split('.')[0];
    const contact = contactMap.get(uid);
    if (contact) {
      return {
        id: contact.id,
        avatarPath: contact.avatarPath,
        name: contact.getDisplayName(),
      };
    }
    return undefined;
  });

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    {
      room,
    }
  );

  useEffect(() => {
    if (screenShareTracks.length) {
      const participant = screenShareTracks[0].participant;
      (window as any).updateFloatingBar({
        screenShare: getParticipantInfo(participant),
      });
    } else {
      (window as any).updateFloatingBar({
        screenShare: null,
      });
    }
  }, [screenShareTracks.length]);

  const isLocalSpeakerRef = useRef(true);
  const isLocalMutedRef = useRef(currentCall.type !== '1on1');

  const updateSpeaker = useMemoizedFn(speaker => {
    (window as any).updateFloatingBar({
      speaker,
    });
    isLocalSpeakerRef.current = speaker.isLocal;
    isLocalMutedRef.current = speaker.isMuted;
  });

  const onSetMuted = useMemoizedFn((_, muted: boolean) => {
    if (muted) {
      room.localParticipant.setMicrophoneEnabled(false);
    } else {
      room.localParticipant.setMicrophoneEnabled(true);
    }
    if (isLocalSpeakerRef.current && isLocalMutedRef.current !== muted) {
      // sync mute status to local speaker field
      updateSpeaker({
        ...getParticipantInfo(room.localParticipant),
        isLocal: true,
        isMuted: muted,
      });
    }
  });

  useEffect(() => {
    const hangupCleanup = (window as any).registerFloatingBarHangupHandler(
      onHangup
    );

    const setMutedCleanup = (window as any).registerFloatingBarSetMutedHandler(
      onSetMuted
    );

    return () => {
      hangupCleanup();
      setMutedCleanup();
    };
  }, []);

  const handleMutedChange = useMemoizedFn(track => {
    if (track.source === Track.Source.Microphone) {
      (window as any).updateFloatingBar({
        muted: !room.localParticipant.isMicrophoneEnabled,
      });
    }
  });

  useEffect(() => {
    room.localParticipant.on(ParticipantEvent.TrackMuted, handleMutedChange);

    room.localParticipant.on(ParticipantEvent.TrackUnmuted, handleMutedChange);

    return () => {
      room.localParticipant.removeListener(
        ParticipantEvent.TrackMuted,
        handleMutedChange
      );
      room.localParticipant.removeListener(
        ParticipantEvent.TrackUnmuted,
        handleMutedChange
      );
    };
  }, []);

  const handleDeferredSpeakingParticipantChanged = useMemoizedFn(() => {
    const participant = deferredSpeakingParticipant || room.localParticipant;

    updateSpeaker({
      ...getParticipantInfo(participant),
      isSpeaking: !!deferredSpeakingParticipant,
      isLocal: participant.isLocal,
      isMuted: !participant.isMicrophoneEnabled,
    });
  });

  useEffect(() => {
    handleDeferredSpeakingParticipantChanged();
  }, [deferredSpeakingParticipant]);

  const handleTrackMutedStatusChange = useMemoizedFn(
    (track: TrackPublication, participant: Participant) => {
      if (
        track.kind === 'audio' &&
        participant.identity === deferredSpeakingParticipant?.identity
      ) {
        updateSpeaker({
          ...getParticipantInfo(participant),
          isLocal: participant.isLocal,
          isMuted: track.isMuted,
        });
      }
    }
  );

  const handleActiveSpeakersChanged = useMemoizedFn(
    (participants: Participant[]) => {
      if (participants.length) {
        if (
          deferredSpeakingParticipant &&
          participants[0]?.identity === deferredSpeakingParticipant?.identity
        ) {
          updateSpeaker({
            ...getParticipantInfo(deferredSpeakingParticipant),
            isLocal: deferredSpeakingParticipant.isLocal,
            isSpeaking: true,
            isMuted: !deferredSpeakingParticipant.isMicrophoneEnabled,
          });
        }
      } else {
        if (deferredSpeakingParticipant) {
          updateSpeaker({
            ...getParticipantInfo(deferredSpeakingParticipant),
            isLocal: deferredSpeakingParticipant.isLocal,
            isSpeaking: false,
            isMuted: !deferredSpeakingParticipant.isMicrophoneEnabled,
          });
        }
      }
    }
  );

  useEffect(() => {
    room.once(RoomEvent.SignalConnected, () => {
      (window as any).updateFloatingBar({
        muted: currentCall.type !== '1on1',
        speaker: {
          ...getParticipantInfo({
            identity: currentCall.ourNumber,
          } as Participant),
          isSpeaking: false,
          isMuted: currentCall.type !== '1on1',
          isLocal: true,
        },
      });
    });

    room.on(RoomEvent.TrackMuted, handleTrackMutedStatusChange);
    room.on(RoomEvent.TrackUnmuted, handleTrackMutedStatusChange);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

    return () => {
      room.off(RoomEvent.TrackMuted, handleTrackMutedStatusChange);
      room.off(RoomEvent.TrackUnmuted, handleTrackMutedStatusChange);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    };
  }, []);

  useToggleFloatingBar();
};
