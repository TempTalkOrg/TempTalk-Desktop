import type { TrackReferenceOrPlaceholder } from '../../core';
import { isEqualTrackRef, isTrackReference, log } from '../../core';
import {
  RemoteParticipant,
  RoomEvent,
  Track,
} from '@cc-livekit/livekit-client';
import React, { HTMLAttributes, useEffect, useRef, useState } from 'react';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
} from '../components';
import {
  useCreateLayoutContext,
  useFeatureContext,
  useRoomContext,
} from '../context';
import { usePinnedTracks, useTracks } from '../hooks';
import { ControlBar, ControlBarProps } from './ControlBar';
import { DraggableWrapper } from './DraggableWrapper';
import { ParticipantAsideList } from '../components/ParticipantAsideList';
import classNames from 'classnames';
import { RaiseHandIndicator } from '../components/RaiseHandIndicator';
import { useMemoizedFn } from 'ahooks';
import { MessageSender } from '../components/MessageSender';
// import { ActiveInfoIndicator } from '../components/ActiveInfoIndicator';

export interface VideoConferenceProps extends HTMLAttributes<HTMLDivElement> {
  onScreenShareClick?: (
    evt: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void;
  controls?: ControlBarProps['controls'];
  onAddMember?: () => void;
  onMemberList?: () => void;
  filterLocalTracks?: boolean;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

export function VideoConference({
  onScreenShareClick,
  onAddMember,
  onMemberList,
  filterLocalTracks,
  controls,
  onDeviceError,
  ...props
}: VideoConferenceProps) {
  const room = useRoomContext();
  const lastAutoFocusedScreenShareTrack =
    useRef<TrackReferenceOrPlaceholder | null>(null);

  const [asideListOpen, setAsideListOpen] = useState(false);
  const [handsUpIndicatorOpen, setHandsUpIndicatorOpen] = useState(true);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      updateOnlyOn: [
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ],
      onlySubscribed: false,
      filterLocalTracks,
    }
  );

  const screenShareTrack = tracks.find(
    track => track.source === Track.Source.ScreenShare
  );

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter(track => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter(
    track => !isEqualTrackRef(track, focusTrack)
  );

  const featureFlags = useFeatureContext(true);

  // auto pin remote participant when 1on1
  useEffect(() => {
    if (featureFlags?.type === 'instant') {
      const participants = [
        ...Array.from(room.remoteParticipants.values()),
        room.localParticipant,
      ];
      const hasScreenShareTrack = participants.some(p =>
        p.getTrackPublication(Track.Source.ScreenShare)
      );
      if (hasScreenShareTrack) {
        return;
      }
      // instant mode must be converted from 1on1
      return layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
    }
    if (!room || featureFlags?.type !== '1on1') {
      return;
    }

    const onLocalConnected = () => {
      const participants = room.remoteParticipants;
      if (participants.size > 1) {
        return;
      }
      for (const [_, participant] of participants) {
        layoutContext.pin.dispatch?.({
          msg: 'set_pin',
          trackReference: {
            participant,
            publication: participant.getTrackPublication(Track.Source.Camera),
            source: Track.Source.Camera,
          },
        });
      }
    };

    const onRemoteConnected = (p: RemoteParticipant) => {
      // convert to instant
      if (room.remoteParticipants.size > 1) {
        return;
      }
      if (!screenShareTrack) {
        console.log('set pin when remote connected');

        layoutContext.pin.dispatch?.({
          msg: 'set_pin',
          trackReference: {
            participant: p,
            publication: p.getTrackPublication(Track.Source.Camera),
            source: Track.Source.Camera,
          },
        });
      }
    };

    room.on(RoomEvent.Connected, onLocalConnected);
    room.on(RoomEvent.ParticipantConnected, onRemoteConnected);

    return () => {
      room.off(RoomEvent.Connected, onLocalConnected);
      room.off(RoomEvent.ParticipantConnected, onRemoteConnected);
    };
  }, [room, featureFlags?.type, screenShareTrack]);

  useEffect(() => {
    if (featureFlags?.type === '1on1' && !screenShareTrack) {
      const remoteP = room.remoteParticipants.values().next().value;
      if (remoteP) {
        setTimeout(() => {
          layoutContext.pin.dispatch?.({
            msg: 'set_pin',
            trackReference: {
              participant: remoteP,
              publication: remoteP.getTrackPublication(Track.Source.Camera),
              source: Track.Source.Camera,
            },
          });
        });
      }
    }
  }, [featureFlags?.type, screenShareTrack]);

  useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some(track => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      log.debug('Auto set screen share focus:', {
        newScreenShareTrack: screenShareTracks[0],
      });
      console.warn('set pin 5');
      layoutContext.pin.dispatch?.({
        msg: 'set_pin',
        trackReference: screenShareTracks[0],
      });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        track =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid
      )
    ) {
      log.debug('Auto clearing screen share focus.');
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        tr =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source
      );
      if (
        updatedFocusTrack !== focusTrack &&
        isTrackReference(updatedFocusTrack)
      ) {
        console.warn('set pin 6');
        layoutContext.pin.dispatch?.({
          msg: 'set_pin',
          trackReference: updatedFocusTrack,
        });
      }
    }
  }, [
    screenShareTracks
      .map(ref => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  const onRaiseHandIndicatorClick = useMemoizedFn(() => {
    setAsideListOpen(true);
  });

  const onSendMessage = featureFlags.onSendMessage || undefined;
  const onSendBubbleMessage = featureFlags.onSendBubbleMessage || undefined;

  return (
    <div className={classNames('video-conference')} {...props}>
      <LayoutContextProvider value={layoutContext}>
        <div className="video-conference-inner">
          {!focusTrack ? (
            <div className="grid-layout-wrapper">
              <GridLayout
                tracks={tracks}
                onRestPlaceholderClick={() => setAsideListOpen(prev => !prev)}
              ></GridLayout>
            </div>
          ) : (
            <div className="focus-layout-wrapper">
              <FocusLayoutContainer>
                {focusTrack && <FocusLayout trackRef={focusTrack} />}
                <DraggableWrapper>
                  <CarouselLayout
                    tracks={carouselTracks}
                    focusTrack={focusTrack}
                  >
                    <div className="carousel-list-item">
                      <ParticipantTile
                        renderPlaceholderExtraProps={{ size: 64 }}
                      />
                    </div>
                  </CarouselLayout>
                </DraggableWrapper>
              </FocusLayoutContainer>
            </div>
          )}
          <MessageSender
            onSendMessage={onSendMessage}
            presetTexts={featureFlags?.chatPresets}
            onSendBubbleMessage={onSendBubbleMessage}
          />
          <ControlBar
            variation="minimal"
            onAddMember={onAddMember}
            onMemberList={(...args) => {
              setAsideListOpen(prev => !prev);
              onMemberList?.(...args);
            }}
            controls={{
              chat: true,
              ...controls,
            }}
            onScreenShareClick={onScreenShareClick}
            onDeviceError={onDeviceError}
          />
        </div>
        {/* <ActiveInfoIndicator /> */}
      </LayoutContextProvider>
      <RoomAudioRenderer filterLocalTracks={filterLocalTracks} />
      <ConnectionStateToast />
      <ParticipantAsideList
        open={asideListOpen}
        onClose={() => {
          setAsideListOpen(false);
          setHandsUpIndicatorOpen(true);
        }}
      />
      {handsUpIndicatorOpen && (
        <RaiseHandIndicator onClick={onRaiseHandIndicatorClick} />
      )}
    </div>
  );
}
