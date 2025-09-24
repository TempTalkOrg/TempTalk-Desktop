import type {
  Participant,
  TrackPublication,
  Track,
  ParticipantKind,
} from '@cc-livekit/livekit-client';
import { TrackReference, TrackReferenceOrPlaceholder } from './track-reference';

export interface ParticipantClickEvent {
  participant: Participant;
  track?: TrackPublication;
}

export type PinState = TrackReferenceOrPlaceholder[];

export type WidgetState = {
  showChat: boolean;
  unreadMessages: number;
  showSettings?: boolean;
};

export type TrackSourceWithOptions = {
  source: Track.Source;
  withPlaceholder: boolean;
};

export type SourcesArray = Track.Source[] | TrackSourceWithOptions[];

export function isSourceWitOptions(
  source: SourcesArray[number]
): source is TrackSourceWithOptions {
  return typeof source === 'object';
}

export function isSourcesWithOptions(
  sources: SourcesArray
): sources is TrackSourceWithOptions[] {
  return (
    Array.isArray(sources) &&
    (sources as TrackSourceWithOptions[]).filter(isSourceWitOptions).length > 0
  );
}

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type ParticipantTrackIdentifier = RequireAtLeastOne<
  { sources: Track.Source[]; name: string; kind: Track.Kind },
  'sources' | 'name' | 'kind'
>;

export type TrackSource<T extends Track.Source> = RequireAtLeastOne<
  { source: T; name: string; participant: Participant },
  'name' | 'source'
>;

export type TrackIdentifier<T extends Track.Source = Track.Source> =
  | TrackSource<T>
  | TrackReference;

export type ParticipantIdentifier = RequireAtLeastOne<
  { kind: ParticipantKind; identity: string },
  'identity' | 'kind'
>;

export const PIN_DEFAULT_STATE: PinState = [];
