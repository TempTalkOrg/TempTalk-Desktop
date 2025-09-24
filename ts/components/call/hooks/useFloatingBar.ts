import { useEffect } from 'react';
import {
  Participant,
  ParticipantEvent,
  Room,
  RoomEvent,
  Track,
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

  const onSetMuted = useMemoizedFn((_, muted: boolean) => {
    if (muted) {
      room.localParticipant.setMicrophoneEnabled(false);
    } else {
      room.localParticipant.setMicrophoneEnabled(true);
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

  const updateLocalMuteStatus = useMemoizedFn((muted: boolean) => {
    (window as any).updateFloatingBar({ muted });
  });

  const handleLocalTrackMuted = useMemoizedFn(() => {
    updateLocalMuteStatus(true);
  });

  const handleLocalTrackUnmuted = useMemoizedFn(() => {
    updateLocalMuteStatus(false);
  });

  useEffect(() => {
    room.localParticipant.on(
      ParticipantEvent.TrackMuted,
      handleLocalTrackMuted
    );

    room.localParticipant.on(
      ParticipantEvent.TrackUnmuted,
      handleLocalTrackUnmuted
    );

    return () => {
      room.localParticipant.removeListener(
        ParticipantEvent.TrackMuted,
        handleLocalTrackMuted
      );
      room.localParticipant.removeListener(
        ParticipantEvent.TrackUnmuted,
        handleLocalTrackUnmuted
      );
    };
  }, []);

  const handleActiveSpeakersChanged = useMemoizedFn(() => {
    const participant =
      deferredSpeakingParticipant ||
      ({
        identity: currentCall.ourNumber,
      } as Participant);
    (window as any).updateFloatingBar({
      speaker: {
        ...getParticipantInfo(participant),
        isSpeaking: !!deferredSpeakingParticipant,
        isLocal: participant.identity === currentCall.ourNumber,
      },
    });
  });

  useEffect(() => {
    handleActiveSpeakersChanged();
  }, [deferredSpeakingParticipant]);

  useEffect(() => {
    room.once(RoomEvent.SignalConnected, () => {
      (window as any).updateFloatingBar({
        muted: currentCall.type !== '1on1',
        speaker: {
          ...getParticipantInfo({
            identity: currentCall.ourNumber,
          } as Participant),
          isSpeaking: false,
          isLocal: true,
        },
      });
    });
  }, []);

  useToggleFloatingBar();
};
