import React, { HTMLAttributes, useEffect, useRef } from 'react';
import {
  isTrackReference,
  isTrackReferencePinned,
  TrackReferenceOrPlaceholder,
} from '../../core';
import { createPortal } from 'react-dom';
import { PinchableBlock, PinchableBlockInstance } from './layout';
import { VideoTrack } from './participant/VideoTrack';
import {
  useEnsureTrackRef,
  useFeatureContext,
  useLayoutContext,
  useMaybeLayoutContext,
} from '../context';
import { Track } from '@cc-livekit/livekit-client';
import { useMemoizedFn } from 'ahooks';
import { ActiveInfoIndicator } from './ActiveInfoIndicator';
import classNames from 'classnames';
import { useImmersiveMode } from '../../../hooks/useImmersiveMode';
import { BorderRadiusSize, IconWrapper } from '../../../../shared/IconWrapper';
import {
  IconZoomOut,
  IconZoomReset,
  IconZoomIn,
} from '../../../../shared/icons';

export interface ScreenShareViewProps extends HTMLAttributes<HTMLDivElement> {
  trackRef?: TrackReferenceOrPlaceholder;
  isFocus?: boolean;
  htmlProps?: HTMLAttributes<HTMLDivElement>;
}

export const ScreenShareView = ({
  trackRef,
  htmlProps,
}: ScreenShareViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchableRef = useRef<PinchableBlockInstance>(null);
  const trackReference = useEnsureTrackRef(trackRef);
  const layoutContext = useMaybeLayoutContext();
  const featureFlags = useFeatureContext();
  const autoManageSubscription = featureFlags?.autoSubscription;

  const handleSubscribe = React.useCallback(
    (subscribed: boolean) => {
      if (
        trackReference.source &&
        !subscribed &&
        layoutContext &&
        layoutContext.pin.dispatch &&
        isTrackReferencePinned(trackReference, layoutContext.pin.state)
      ) {
        if (featureFlags?.type !== '1on1') {
          layoutContext.pin.dispatch({ msg: 'clear_pin' });
        }
      }
    },
    [trackReference, layoutContext, featureFlags?.type]
  );

  useEffect(() => {
    if (trackReference.source === Track.Source.ScreenShare) {
      setTimeout(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        pinchableRef.current?.initSize({
          height: rect?.height,
          width: rect?.width,
        });
      });
    }
  }, [trackReference.source]);

  const handleResize = useMemoizedFn(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    pinchableRef.current?.initSize({
      height: rect?.height,
      width: rect?.width,
    });
  });

  const onZoomReset = useMemoizedFn(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    pinchableRef.current?.initSize({
      height: rect?.height,
      width: rect?.width,
    });
    pinchableRef.current?.zoomReset();
  });

  React.useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { asideList } = useLayoutContext();

  const open = asideList.state?.open ?? false;

  const { exitImmersiveMode } = useImmersiveMode();

  const onMouseMove = useMemoizedFn(() => {
    exitImmersiveMode();
  });

  if (!isTrackReference(trackReference)) {
    return null;
  }

  return createPortal(
    <div
      className={classNames('screen-share-view-root', {
        'participant-list-open': open,
      })}
      ref={containerRef}
      style={{ overflow: 'auto' }}
      onMouseMove={onMouseMove}
      {...htmlProps}
    >
      <PinchableBlock
        getContainer={() => containerRef.current}
        ref={pinchableRef}
      >
        <VideoTrack
          trackRef={trackReference}
          onSubscriptionStatusChanged={handleSubscribe}
          manageSubscription={autoManageSubscription}
        />
      </PinchableBlock>
      <ActiveInfoIndicator />
      {createPortal(
        <div className="screen-share-control">
          <div className="screen-share-control-item">
            <IconWrapper borderRadiusSize={BorderRadiusSize.SMALL}>
              <IconZoomOut
                onClick={() => pinchableRef.current?.zoomOut()}
                color="var(--dst-color-icon)"
              />
            </IconWrapper>
          </div>
          <div className="screen-share-control-item">
            <IconWrapper borderRadiusSize={BorderRadiusSize.SMALL}>
              <IconZoomReset
                onClick={onZoomReset}
                height={14}
                width={14}
                color="var(--dst-color-icon)"
              />
            </IconWrapper>
          </div>
          <div className="screen-share-control-item">
            <IconWrapper borderRadiusSize={BorderRadiusSize.SMALL}>
              <IconZoomIn
                onClick={() => pinchableRef.current?.zoomIn()}
                color="var(--dst-color-icon)"
              />
            </IconWrapper>
          </div>
        </div>,
        document.querySelector('.call-room-container')!
      )}
    </div>,
    document.body
  );
};
