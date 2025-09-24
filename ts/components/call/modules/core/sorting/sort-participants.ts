import type { Participant } from '@cc-livekit/livekit-client';
import { LocalParticipant } from '@cc-livekit/livekit-client';
import {
  sortParticipantsByJoinedAt,
  sortParticipantsByLastSpokenAT,
} from './base-sort-functions';

export function sortParticipants(participants: Participant[]): Participant[] {
  const sortedParticipants = [...participants];
  sortedParticipants.sort((a, b) => {
    const aScreenShareTrack = a.isScreenShareEnabled;
    const bScreenShareTrack = b.isScreenShareEnabled;
    if (aScreenShareTrack !== bScreenShareTrack) {
      if (aScreenShareTrack) {
        return -1;
      } else {
        return 1;
      }
    }

    // video on
    const aVideo = a.videoTrackPublications.size > 0;
    const bVideo = b.videoTrackPublications.size > 0;
    if (aVideo !== bVideo) {
      if (aVideo) {
        return -1;
      } else {
        return 1;
      }
    }

    // microphone on
    const aAudio = a.isMicrophoneEnabled;
    const bAudio = b.isMicrophoneEnabled;
    if (aAudio !== bAudio) {
      if (aAudio) {
        return -1;
      } else {
        return 1;
      }
    }

    // last active speaker first
    if (a.lastSpokeAt !== b.lastSpokeAt) {
      return sortParticipantsByLastSpokenAT(a, b);
    }

    // joinedAt
    return sortParticipantsByJoinedAt(a, b);
  });
  const localParticipant = sortedParticipants.find(
    p => p.isLocal
  ) as LocalParticipant;
  if (localParticipant) {
    const localIdx = sortedParticipants.indexOf(localParticipant);
    if (localIdx >= 0) {
      sortedParticipants.splice(localIdx, 1);
      if (sortedParticipants.length > 0) {
        sortedParticipants.splice(0, 0, localParticipant);
      } else {
        sortedParticipants.push(localParticipant);
      }
    }
  }
  return sortedParticipants;
}
