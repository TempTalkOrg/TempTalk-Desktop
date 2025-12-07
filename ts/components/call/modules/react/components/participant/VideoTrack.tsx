import { RemoteTrackPublication, Track } from '@cc-livekit/livekit-client';
import * as React from 'react';
import { useMediaTrackBySourceOrName } from '../../hooks/useMediaTrackBySourceOrName';
import type { ParticipantClickEvent, TrackReference } from '../../../core';
import { useEnsureTrackRef } from '../../context';
import * as useHooks from 'usehooks-ts';
import { useEffect, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { IconScreenShare } from '../../../../../shared/icons';

/** @public */
export interface VideoTrackProps
  extends React.VideoHTMLAttributes<HTMLVideoElement> {
  /** The track reference of the track to render. */
  trackRef?: TrackReference;
  onTrackClick?: (evt: ParticipantClickEvent) => void;
  onSubscriptionStatusChanged?: (subscribed: boolean) => void;
  manageSubscription?: boolean;
}

function checkVideoData(mediaEl?: HTMLVideoElement | null) {
  return (
    mediaEl?.videoHeight &&
    mediaEl?.videoWidth &&
    mediaEl?.videoHeight > 0 &&
    mediaEl?.videoWidth > 0
  );
}

export const VideoTrack = React.forwardRef<HTMLVideoElement, VideoTrackProps>(
  function VideoTrack(
    {
      onTrackClick,
      onClick,
      onSubscriptionStatusChanged,
      trackRef,
      manageSubscription,
      ...props
    }: VideoTrackProps,
    ref
  ) {
    const trackReference = useEnsureTrackRef(trackRef);

    const mediaEl = React.useRef<HTMLVideoElement>(null);
    React.useImperativeHandle(ref, () => mediaEl.current as HTMLVideoElement);

    const intersectionEntry = useHooks.useIntersectionObserver({
      root: mediaEl.current,
    });

    const [debouncedIntersectionEntry] = useHooks.useDebounceValue(
      intersectionEntry,
      3000
    );

    React.useEffect(() => {
      if (
        manageSubscription &&
        trackReference.publication instanceof RemoteTrackPublication &&
        debouncedIntersectionEntry?.isIntersecting === false &&
        intersectionEntry?.isIntersecting === false
      ) {
        trackReference.publication.setSubscribed(false);
      }
    }, [debouncedIntersectionEntry, trackReference, manageSubscription]);

    React.useEffect(() => {
      if (
        manageSubscription &&
        trackReference.publication instanceof RemoteTrackPublication &&
        intersectionEntry?.isIntersecting === true
      ) {
        trackReference.publication.setSubscribed(true);
      }
    }, [intersectionEntry, trackReference, manageSubscription]);

    const {
      elementProps,
      publication: pub,
      isSubscribed,
    } = useMediaTrackBySourceOrName(trackReference, {
      element: mediaEl,
      props,
    });

    React.useEffect(() => {
      onSubscriptionStatusChanged?.(!!isSubscribed);
    }, [isSubscribed, onSubscriptionStatusChanged]);

    const clickHandler = (
      evt: React.MouseEvent<HTMLVideoElement, MouseEvent>
    ) => {
      onClick?.(evt);
      onTrackClick?.({ participant: trackReference?.participant, track: pub });
    };

    const [showVideoPlaceholder, setShowVideoPlaceholder] = useState(
      trackRef?.source === Track.Source.ScreenShare
    );
    const checkVideoDataIntervalRef = useRef<NodeJS.Timeout>();

    const startCheckVideoData = useMemoizedFn(() => {
      if (!checkVideoDataIntervalRef.current) {
        checkVideoDataIntervalRef.current = setInterval(() => {
          const hasData = checkVideoData(mediaEl.current);
          setShowVideoPlaceholder(!hasData);
        }, 2000);
      }
    });

    useEffect(() => {
      if (trackRef?.source === Track.Source.ScreenShare) {
        startCheckVideoData();
        mediaEl.current?.addEventListener('loadedmetadata', () => {
          if (checkVideoData(mediaEl.current)) {
            setShowVideoPlaceholder(false);
          }
        });
      }

      return () => {
        if (checkVideoDataIntervalRef.current) {
          clearInterval(checkVideoDataIntervalRef.current);
          checkVideoDataIntervalRef.current = undefined;
        }
      };
    }, [trackRef?.source]);

    return (
      <>
        <video
          ref={mediaEl}
          {...elementProps}
          muted={true}
          onClick={clickHandler}
          data-sid={trackReference?.publication?.trackSid}
        ></video>
        {showVideoPlaceholder && (
          <div className="video-track-placeholder">
            <IconScreenShare className="video-track-placeholder-icon" />
            <span className="video-track-placeholder-text">
              Waiting for screen…
            </span>
          </div>
        )}
      </>
    );
  }
);
