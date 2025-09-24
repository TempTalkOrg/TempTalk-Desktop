import {
  isTrackReference,
  isTrackReferencePlaceholder,
} from './track-reference.types';
import type { TrackReferenceOrPlaceholder } from './track-reference.types';
import type { PinState } from '../types';

export function getTrackReferenceId(
  trackReference: TrackReferenceOrPlaceholder | number
) {
  if (
    typeof trackReference === 'string' ||
    typeof trackReference === 'number'
  ) {
    return `${trackReference}`;
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.source}_placeholder`;
  } else if (isTrackReference(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.publication.source}_${trackReference.publication.trackSid}`;
  } else {
    throw new Error(
      `Can't generate a id for the given track reference: ${trackReference}`
    );
  }
}

export function isEqualTrackRef(
  a?: TrackReferenceOrPlaceholder,
  b?: TrackReferenceOrPlaceholder
): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  if (isTrackReference(a) && isTrackReference(b)) {
    return a.publication.trackSid === b.publication.trackSid;
  } else {
    return getTrackReferenceId(a) === getTrackReferenceId(b);
  }
}

export function isTrackReferencePinned(
  trackReference: TrackReferenceOrPlaceholder,
  pinState: PinState | undefined
): boolean {
  if (typeof pinState === 'undefined') {
    return false;
  }
  if (isTrackReference(trackReference)) {
    return pinState.some(
      pinnedTrackReference =>
        pinnedTrackReference.participant.identity ===
          trackReference.participant.identity &&
        isTrackReference(pinnedTrackReference) &&
        pinnedTrackReference.publication.trackSid ===
          trackReference.publication.trackSid
    );
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return pinState.some(
      pinnedTrackReference =>
        pinnedTrackReference.participant.identity ===
          trackReference.participant.identity &&
        isTrackReferencePlaceholder(pinnedTrackReference) &&
        pinnedTrackReference.source === trackReference.source
    );
  } else {
    return false;
  }
}
