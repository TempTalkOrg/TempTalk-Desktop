import { Track } from '@cc-livekit/livekit-client';
import { isTrackReference } from '../track-reference';
import type { TrackReferenceOrPlaceholder } from '../track-reference';

import {
  sortParticipantsByJoinedAt,
  sortParticipantsByLastSpokenAT,
  sortTrackReferencesByType,
  sortTrackRefsByIsCameraEnabled,
} from './base-sort-functions';

export function sortCameraTracks(
  cameraTrackReferences: TrackReferenceOrPlaceholder[]
): TrackReferenceOrPlaceholder[] {
  const localCameraTracks: TrackReferenceOrPlaceholder[] = [];
  const remoteCameraTracks: TrackReferenceOrPlaceholder[] = [];

  cameraTrackReferences.forEach(trackRef => {
    if (trackRef.participant.isLocal) {
      localCameraTracks.push(trackRef);
    } else {
      remoteCameraTracks.push(trackRef);
    }
  });

  remoteCameraTracks.sort((a, b) => {
    // Participant with higher audio level goes first.
    // if (a.participant.isSpeaking && b.participant.isSpeaking) {
    //   return sortParticipantsByAudioLevel(a.participant, b.participant);
    // }

    // remove isSpeaking sort
    // A speaking participant goes before one that is not speaking.
    // if (a.participant.isSpeaking !== b.participant.isSpeaking) {
    //   return sortParticipantsByIsSpeaking(a.participant, b.participant);
    // }

    // video on
    const aVideo = a.participant.videoTrackPublications.size > 0;
    const bVideo = b.participant.videoTrackPublications.size > 0;
    if (aVideo !== bVideo) {
      if (aVideo) {
        return -1;
      } else {
        return 1;
      }
    }

    // microphone on
    const aAudio = a.participant.isMicrophoneEnabled;
    const bAudio = b.participant.isMicrophoneEnabled;
    if (aAudio !== bAudio) {
      if (aAudio) {
        return -1;
      } else {
        return 1;
      }
    }

    // A participant that spoke recently goes before a participant that spoke a while back.
    if (a.participant.lastSpokeAt !== b.participant.lastSpokeAt) {
      return sortParticipantsByLastSpokenAT(a.participant, b.participant);
    }

    // TrackReference before TrackReferencePlaceholder
    if (isTrackReference(a) !== isTrackReference(b)) {
      return sortTrackReferencesByType(a, b);
    }

    // Tiles with video on before tiles with muted video track.
    if (a.participant.isCameraEnabled !== b.participant.isCameraEnabled) {
      return sortTrackRefsByIsCameraEnabled(a, b);
    }

    // A participant that joined a long time ago goes before one that joined recently.
    return sortParticipantsByJoinedAt(a.participant, b.participant);
  });

  return [...localCameraTracks, ...remoteCameraTracks];
}

export const customSortTrackFunction = (
  tracks: TrackReferenceOrPlaceholder[],
  focusTrack?: TrackReferenceOrPlaceholder
) => {
  const localTracks: TrackReferenceOrPlaceholder[] = [];
  const screenShareTracks: TrackReferenceOrPlaceholder[] = [];
  const cameraTracks: TrackReferenceOrPlaceholder[] = [];
  const undefinedTracks: TrackReferenceOrPlaceholder[] = [];

  tracks.forEach(trackRef => {
    if (
      trackRef.participant.isLocal &&
      trackRef.source === Track.Source.Camera
    ) {
      localTracks.push(trackRef);
    } else if (
      trackRef.source === Track.Source.ScreenShare ||
      (focusTrack &&
        focusTrack.source === Track.Source.ScreenShare &&
        trackRef.participant.identity === focusTrack.participant.identity)
    ) {
      screenShareTracks.push(trackRef);
    } else if (trackRef.source === Track.Source.Camera) {
      cameraTracks.push(trackRef);
    } else {
      undefinedTracks.push(trackRef);
    }
  });

  const sortedScreenShareTracks = sortScreenShareTracks(screenShareTracks);
  const sortedCameraTracks = sortCameraTracks(cameraTracks);

  return [
    ...localTracks,
    ...sortedScreenShareTracks,
    ...sortedCameraTracks,
    ...undefinedTracks,
  ];
};

export function sortScreenShareTracks(
  screenShareTracks: TrackReferenceOrPlaceholder[]
): TrackReferenceOrPlaceholder[] {
  const localScreenShares: TrackReferenceOrPlaceholder[] = [];
  const remoteScreenShares: TrackReferenceOrPlaceholder[] = [];

  screenShareTracks.forEach(trackRef => {
    if (trackRef.participant.isLocal) {
      localScreenShares.push(trackRef);
    } else {
      remoteScreenShares.push(trackRef);
    }
  });

  localScreenShares.sort((a, b) =>
    sortParticipantsByJoinedAt(a.participant, b.participant)
  );
  remoteScreenShares.sort((a, b) =>
    sortParticipantsByJoinedAt(a.participant, b.participant)
  );

  const sortedScreenShareTrackRefs = [
    ...remoteScreenShares,
    ...localScreenShares,
  ];
  return sortedScreenShareTrackRefs;
}
