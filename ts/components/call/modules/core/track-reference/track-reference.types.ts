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
    Object.hasOwn(trackReference, 'participant') &&
    Object.hasOwn(trackReference, 'source') &&
    Object.hasOwn(trackReference, 'track') &&
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
    Object.hasOwn(trackReference, 'participant') &&
    Object.hasOwn(trackReference, 'source') &&
    Object.hasOwn(trackReference, 'publication') &&
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
    Object.hasOwn(trackReference, 'participant') &&
    Object.hasOwn(trackReference, 'source') &&
    typeof trackReference.publication === 'undefined'
  );
}
