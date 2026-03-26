import * as React from 'react';
import { mergeProps } from '../../utils';
import type { TrackReferenceOrPlaceholder } from '../../../core';
import { ParticipantTile } from '../participant/ParticipantTile';
import type { ParticipantClickEvent } from '../../../core';
import { useFeatureContext, useLayoutContext } from '../../context';
import { RoomEvent, Track } from '@cc-livekit/livekit-client';
import { useTracks } from '../../hooks';

import { animated } from '@react-spring/web';
import { createUseGesture, pinchAction } from '@use-gesture/react';
import { useMemoizedFn } from 'ahooks';
// import { createPortal } from 'react-dom';
// import { DraggableWrapper } from '../../prefabs/DraggableWrapper';
import classnames from 'classnames';
import {
  CSSProperties,
  forwardRef,
  HTMLAttributes,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ScreenShareView } from '../ScreenShareView';
// import { deferredSpeakingParticipantAtom } from '../../../../atoms/deferredSpeakingParticipantAtom';
// import { useAtomValue } from 'jotai';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FocusLayoutContainerProps
  extends HTMLAttributes<HTMLDivElement> {}

export function FocusLayoutContainer(props: FocusLayoutContainerProps) {
  const featureFlags = useFeatureContext();
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
  // const [showCarouselList, setShowCarouselList] = useState(false);
  const { asideList } = useLayoutContext();
  const showCarouselList = asideList.state?.open ?? false;

  // const deferredSpeakingParticipant = useAtomValue(
  //   deferredSpeakingParticipantAtom
  // );

  const SharingTrack = tracks.find(
    track => track.source === Track.Source.ScreenShare
  );
  const isSharingScreen = !!SharingTrack;

  // const speakingIndicatorTrackRef = useMemo(() => {
  //   if (deferredSpeakingParticipant) {
  //     const cameraTrack = tracks.find(
  //       track =>
  //         track.participant === deferredSpeakingParticipant &&
  //         track.source === Track.Source.Camera
  //     );
  //     return (
  //       cameraTrack || {
  //         participant: deferredSpeakingParticipant,
  //         source: Track.Source.Camera,
  //       }
  //     );
  //   }

  //   if (SharingTrack) {
  //     const cameraTrack = tracks.find(
  //       track =>
  //         track.participant === SharingTrack.participant &&
  //         track.source === Track.Source.Camera
  //     );
  //     return (
  //       cameraTrack || {
  //         participant: SharingTrack.participant,
  //         source: Track.Source.Camera,
  //       }
  //     );
  //   }

  //   return null;
  // }, [deferredSpeakingParticipant, SharingTrack, tracks]);

  const elementProps = mergeProps(props, {
    className: classnames([
      'focus-layout',
      isSharingScreen && !showCarouselList && 'is-sharing-screen',
      !isSharingScreen && featureFlags?.type === '1on1' && 'adapt-1on1-call',
      showCarouselList && 'show-carousel-list',
    ]),
  });

  const toggleCarouselList = useMemoizedFn(() => {
    asideList.dispatch?.({ msg: 'toggle_aside_list' });
  });

  return (
    <>
      {isSharingScreen ? (
        <div
          className="aside-control"
          style={{
            right: showCarouselList ? 188 : 0,
          }}
          onClick={toggleCarouselList}
        >
          {showCarouselList ? (
            <div className="call-icon aside-control-off"></div>
          ) : (
            <div className="call-icon aside-control-on"></div>
          )}
        </div>
      ) : null}
      <div {...elementProps}>{props.children}</div>
      {/* {isSharingScreen && speakingIndicatorTrackRef
        ? createPortal(
            <div
              className={`floating-speaking-indicator ${showCarouselList ? 'show-carousel-list' : ''}`}
            >
              <TrackRefContext.Provider
                value={speakingIndicatorTrackRef}
                key="speaking-indicator"
              >
                <DraggableWrapper
                  draggable={true}
                  bounds=".is-focus-screen-share"
                  videoWidth={128}
                  position={{
                    x: 0,
                    y: 0,
                    direction: 'left',
                  }}
                >
                  <ParticipantTile
                    trackRef={speakingIndicatorTrackRef}
                    renderPlaceholderExtraProps={{ size: 64 }}
                    toggleable
                  ></ParticipantTile>
                </DraggableWrapper>
              </TrackRefContext.Provider>
            </div>,
            document.querySelector('.focus-layout')!
          )
        : null} */}
    </>
  );
}

export interface FocusLayoutProps extends HTMLAttributes<HTMLElement> {
  trackRef?: TrackReferenceOrPlaceholder;

  onParticipantClick?: (evt: ParticipantClickEvent) => void;
}

export function FocusLayout({ trackRef, ...htmlProps }: FocusLayoutProps) {
  const isScreenShareTrack = trackRef?.source === Track.Source.ScreenShare;
  if (isScreenShareTrack) {
    return <ScreenShareView trackRef={trackRef} htmlProps={htmlProps} />;
  } else {
    return <ParticipantTile isFocus trackRef={trackRef} {...htmlProps} />;
  }
}

export interface IPinchableBlockProps {
  minScale?: number;
  maxScale?: number;
  style?: CSSProperties;
  rotation?: number;
  [key: string]: any;
}

export interface PinchableBlockInstance {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  initSize: (size: any) => void;
}

const useGesture = createUseGesture([pinchAction]);

export const PinchableBlock = forwardRef<
  PinchableBlockInstance,
  IPinchableBlockProps
>((props, ref) => {
  const {
    minScale = 1,
    maxScale = 100,
    style: styleProps,
    getContainer = () => document.body,
    // rotation = 0,
    ...extraProps
  } = props;

  const [initSize, setInitSize] = useState({ height: 0, width: 0 });

  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);

  const counterRef = useRef({
    plus: 0,
    minus: 0,
  });

  const onPinch = useMemoizedFn(({ event, trigger, memo }) => {
    const container = getContainer();

    const direction = event.deltaY < 0 ? 1 : -1;

    const imageBounds = imgRef.current!.getBoundingClientRect();

    // for keep scale rate after zoom in or zoom out
    const ratio = parseFloat((imageBounds.width / initSize.width).toFixed(2));

    let delta = parseFloat((0.05 * direction * ratio).toFixed(2));

    if (direction > 0) {
      counterRef.current.plus++;
    } else if (direction < 0) {
      counterRef.current.minus++;
    }

    if (
      (scale === maxScale && direction > 0) ||
      (scale === minScale && direction < 0)
    ) {
      return;
    }

    let nextScale = 0;
    let offset: number | undefined = undefined;

    setScale(prev => {
      nextScale = parseFloat((prev + delta).toFixed(2));

      if (direction > 0 && nextScale > maxScale) {
        offset = maxScale - prev;
      }

      return Math.min(Math.max(nextScale, minScale), maxScale);
    });

    requestAnimationFrame(() => {
      // amend actual delta
      if (offset !== undefined) {
        delta = offset;
      }

      const xRate =
        trigger === 'command'
          ? 0.5
          : (event.clientX + container.scrollLeft) / imageBounds.width;
      const yRate =
        trigger === 'command'
          ? 0.5
          : (event.clientY - 52 + container.scrollTop) / imageBounds.height;

      container.scrollLeft += initSize.width * delta * xRate;
      container.scrollTop += initSize.height * delta * yRate;
    });

    return memo;
  });

  useGesture(
    {
      onPinch,
    },
    {
      target: imgRef,
      pinch: {
        scaleBounds: { min: minScale, max: maxScale },
        rubberband: true,
      },
    }
  );

  useImperativeHandle(ref, () => ({
    zoomIn() {
      onPinch({
        event: { deltaY: -1 },
        trigger: 'command',
      });
    },
    zoomOut() {
      onPinch({
        event: { deltaY: 1 },
        trigger: 'command',
      });
    },
    zoomReset() {
      setScale(1);
    },
    initSize(size) {
      setInitSize(size);
    },
  }));

  useLayoutEffect(() => {
    const container = getContainer();
    if (!container || !imgRef.current || initSize.height === 0) return;

    const parentBounds = container.getBoundingClientRect();
    const imgBounds = imgRef.current.getBoundingClientRect();

    imgRef.current.style.marginTop = `${Math.max(
      0,
      (parentBounds.height - imgBounds.height) / 2
    )}px`;
  }, [initSize, scale, imgRef.current]);

  return (
    <animated.div
      {...extraProps}
      ref={imgRef}
      style={{
        ...styleProps,
        height: initSize.height * scale,
        width: initSize.width * scale,
        margin: `0 auto`,
      }}
    >
      {props.children}
    </animated.div>
  );
});
