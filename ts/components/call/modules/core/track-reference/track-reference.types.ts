import type {
  Participant,
  Track,
  TrackPublication,
} from '@cc-livekit/livekit-client';

export type TrackReferencePlaceholder = {
  participant: Participant;
  publication?: never;
  source: Track.Source;
};

export type TrackReference = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};

export type TrackReferenceOrPlaceholder =
  | TrackReference
  | TrackReferencePlaceholder;

function isTrackReferenceSubscribed(
  trackReference?: TrackReferenceOrPlaceholder
): boolean {
  if (!trackReference) {
    return false;
  }
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    trackReference.hasOwnProperty('track') &&
    typeof trackReference.publication?.track !== 'undefined'
  );
}

function isTrackReferencePublished(
  trackReference?: TrackReferenceOrPlaceholder
): boolean {
  if (!trackReference) {
    return false;
  }
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    trackReference.hasOwnProperty('publication') &&
    typeof trackReference.publication !== 'undefined'
  );
}

export function isTrackReference(
  trackReference: unknown
): trackReference is TrackReference {
  if (typeof trackReference === 'undefined') {
    return false;
  }
  return (
    isTrackReferenceSubscribed(trackReference as TrackReference) ||
    isTrackReferencePublished(trackReference as TrackReference)
  );
}

export function isTrackReferencePlaceholder(
  trackReference?: TrackReferenceOrPlaceholder
): trackReference is TrackReferencePlaceholder {
  if (!trackReference) {
    return false;
  }
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    typeof trackReference.publication === 'undefined'
  );
}
