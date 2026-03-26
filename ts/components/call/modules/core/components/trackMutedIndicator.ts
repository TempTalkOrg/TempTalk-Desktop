import { Track } from '@cc-livekit/livekit-client';
import { mutedObserver } from '../observables/participant';
import type { TrackReferenceOrPlaceholder } from '../track-reference';

export function setupTrackMutedIndicator(
  trackRef: TrackReferenceOrPlaceholder
) {
  let classForSource: string = 'track-muted-indicator-camera';
  switch (trackRef.source) {
    case Track.Source.Camera:
      classForSource = 'track-muted-indicator-camera';
      break;
    case Track.Source.Microphone:
      classForSource = 'track-muted-indicator-microphone';
      break;

    default:
      break;
  }
  const className: string = classForSource;
  const mediaMutedObserver = mutedObserver(trackRef);

  return { className, mediaMutedObserver };
}
