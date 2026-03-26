import type {
  ParticipantClickEvent,
  TrackReferenceOrPlaceholder,
} from '../../core';
import * as React from 'react';
import { useEnsureTrackRef } from '../context';
import { mergeProps } from '../mergeProps';
import { useFacingMode } from './useFacingMode';
import { useIsMuted } from './useIsMuted';
import { useIsSpeaking } from './useIsSpeaking';
import { Track } from '@cc-livekit/livekit-client';

export interface UseParticipantTileProps<T extends HTMLElement>
  extends React.HTMLAttributes<T> {
  /** The track reference to display. */
  trackRef?: TrackReferenceOrPlaceholder;
  disableSpeakingIndicator?: boolean;
  onParticipantClick?: (event: ParticipantClickEvent) => void;
  htmlProps: React.HTMLAttributes<T>;
}

export function useParticipantTile<T extends HTMLElement>({
  trackRef,
  onParticipantClick,
  disableSpeakingIndicator,
  htmlProps,
}: UseParticipantTileProps<T>) {
  const trackReference = useEnsureTrackRef(trackRef);

  const mergedProps = React.useMemo(() => {
    const className = 'participant-tile';
    return mergeProps(htmlProps, {
      className,
      onClick: (event: React.MouseEvent<T, MouseEvent>) => {
        htmlProps.onClick?.(event);
        if (typeof onParticipantClick === 'function') {
          const track =
            trackReference.publication ??
            trackReference.participant.getTrackPublication(
              trackReference.source
            );
          onParticipantClick({
            participant: trackReference.participant,
            track,
          });
        }
      },
    });
  }, [
    htmlProps,
    onParticipantClick,
    trackReference.publication,
    trackReference.source,
    trackReference.participant,
  ]);

  const micTrack = trackReference.participant.getTrackPublication(
    Track.Source.Microphone
  );
  const micRef = React.useMemo(() => {
    return {
      participant: trackReference.participant,
      source: Track.Source.Microphone,
      publication: micTrack,
    };
  }, [micTrack, trackReference.participant]);
  const isVideoMuted = useIsMuted(trackReference);
  const isAudioMuted = useIsMuted(micRef);
  const isSpeaking = useIsSpeaking(trackReference.participant);
  const facingMode = useFacingMode(trackReference);
  return {
    elementProps: {
      'data-audio-muted': isAudioMuted,
      'data-video-muted': isVideoMuted,
      'data-speaking': disableSpeakingIndicator === true ? false : isSpeaking,
      'data-local-participant': trackReference.participant.isLocal,
      'data-source': trackReference.source,
      'data-facing-mode': facingMode,
      ...mergedProps,
    } as React.HTMLAttributes<T>,
  };
}
