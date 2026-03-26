import { RoomEvent, Track } from '@cc-livekit/livekit-client';
import React from 'react';
import { useTracks } from '../hooks';
import { useAtomValue } from 'jotai';
import { deferredSpeakingParticipantAtom } from '../../../atoms/deferredSpeakingParticipantAtom';
// import { TrackRefContext } from '../context';
import { TrackMutedIndicator } from './participant/TrackMutedIndicator';
import { ParticipantName } from './participant/ParticipantName';
import { MicOnLineUp } from './MicOnLineUp';
import { IconScreenShare } from '../../../../shared/icons';
import { useMemoizedFn } from 'ahooks';
import { useLayoutContext } from '../context';

export const ActiveInfoIndicator = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    {
      updateOnlyOn: [RoomEvent.ActiveSpeakersChanged],
      onlySubscribed: false,
    }
  );
  // const [showCarouselList, setShowCarouselList] = React.useState(false);
  const deferredSpeakingParticipant = useAtomValue(
    deferredSpeakingParticipantAtom
  );

  const SharingTrack = tracks.find(
    track => track.source === Track.Source.ScreenShare
  );
  const isSharingScreen = !!SharingTrack;

  const speakingIndicatorTrackRef = React.useMemo(() => {
    if (deferredSpeakingParticipant) {
      const cameraTrack = tracks.find(
        track =>
          track.participant === deferredSpeakingParticipant &&
          track.source === Track.Source.Camera
      );
      return (
        cameraTrack || {
          participant: deferredSpeakingParticipant,
          source: Track.Source.Camera,
        }
      );
    }

    if (SharingTrack) {
      const cameraTrack = tracks.find(
        track =>
          track.participant === SharingTrack.participant &&
          track.source === Track.Source.Camera
      );
      return (
        cameraTrack || {
          participant: SharingTrack.participant,
          source: Track.Source.Camera,
        }
      );
    }

    return null;
  }, [deferredSpeakingParticipant, SharingTrack, tracks]);

  const { asideList } = useLayoutContext();

  const toggleAsideList = useMemoizedFn(() => {
    asideList.dispatch?.({ msg: 'toggle_aside_list' });
  });

  if (!speakingIndicatorTrackRef || !isSharingScreen) {
    return null;
  }

  const isSharing =
    speakingIndicatorTrackRef.participant === SharingTrack.participant;

  return (
    <div className="active-info-indicator-container">
      <div className="speaking-info" onClick={toggleAsideList}>
        {isSharing && <IconScreenShare className="screen-share-icon" />}
        <TrackMutedIndicator
          trackRef={{
            participant: speakingIndicatorTrackRef.participant,
            source: Track.Source.Microphone,
          }}
          show={'always'}
        ></TrackMutedIndicator>
        <ParticipantName participant={speakingIndicatorTrackRef.participant} />
      </div>
      <div className="line-up-info" onClickCapture={toggleAsideList}>
        <MicOnLineUp />
      </div>
    </div>
  );
};
