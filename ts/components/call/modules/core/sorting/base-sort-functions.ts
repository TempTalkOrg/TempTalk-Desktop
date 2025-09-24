import type { Participant } from '@cc-livekit/livekit-client';
import { isTrackReference } from '../track-reference';
import type { TrackReferenceOrPlaceholder } from '../track-reference';

export function sortParticipantsByJoinedAt(
  a: Pick<Participant, 'joinedAt'>,
  b: Pick<Participant, 'joinedAt'>
) {
  return (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0);
}

export function sortParticipantsByLastSpokenAT(
  a: Pick<Participant, 'lastSpokeAt'>,
  b: Pick<Participant, 'lastSpokeAt'>
): number {
  if (a.lastSpokeAt !== undefined || b.lastSpokeAt !== undefined) {
    return (b.lastSpokeAt?.getTime() ?? 0) - (a.lastSpokeAt?.getTime() ?? 0);
  } else {
    return 0;
  }
}

export function sortTrackReferencesByType(
  a: TrackReferenceOrPlaceholder,
  b: TrackReferenceOrPlaceholder
) {
  if (isTrackReference(a)) {
    if (isTrackReference(b)) {
      return 0;
    } else {
      return -1;
    }
  } else if (isTrackReference(b)) {
    return 1;
  } else {
    return 0;
  }
}

export function sortTrackRefsByIsCameraEnabled(
  a: { participant: { isCameraEnabled: boolean } },
  b: { participant: { isCameraEnabled: boolean } }
) {
  const aVideo = a.participant.isCameraEnabled;
  const bVideo = b.participant.isCameraEnabled;

  if (aVideo !== bVideo) {
    if (aVideo) {
      return -1;
    } else {
      return 1;
    }
  } else {
    return 0;
  }
}
