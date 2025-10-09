import * as React from 'react';
import type { Participant } from '@cc-livekit/livekit-client';
import { Track } from '@cc-livekit/livekit-client';
import type {
  ParticipantClickEvent,
  TrackReferenceOrPlaceholder,
} from '../../../core';
import { isTrackReference, isTrackReferencePinned } from '../../../core';
import { ParticipantName } from './ParticipantName';
import { TrackMutedIndicator } from './TrackMutedIndicator';
import {
  ParticipantContext,
  TrackRefContext,
  useEnsureTrackRef,
  useFeatureContext,
  useMaybeLayoutContext,
  useMaybeParticipantContext,
  useMaybeTrackRefContext,
} from '../../context';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';
import { useParticipantTile } from '../../hooks';
import { PinchableBlock, PinchableBlockInstance } from '../layout/FocusLayout';
import { ZoomIn } from './ZoomIn';
import { ZoomReset } from './ZoomReset';
import { ZoomOut } from './ZoomOut';
import { useMemoizedFn } from 'ahooks';
import { useParticipantContextMenu } from '../../hooks/useParticipantContextMenu';
import classNames from 'classnames';
import { ContextMenu } from '../../../../../shared/ContextMenu';
import { IconScreenShare } from '../../../../../shared/icons';

export function ParticipantContextIfNeeded(
  props: React.PropsWithChildren<{
    participant?: Participant;
  }>
) {
  const hasContext = !!useMaybeParticipantContext();
  return props.participant && !hasContext ? (
    <ParticipantContext.Provider value={props.participant}>
      {props.children}
    </ParticipantContext.Provider>
  ) : (
    <>{props.children}</>
  );
}

export function TrackRefContextIfNeeded(
  props: React.PropsWithChildren<{
    trackRef?: TrackReferenceOrPlaceholder;
  }>
) {
  const hasContext = !!useMaybeTrackRefContext();
  return props.trackRef && !hasContext ? (
    <TrackRefContext.Provider value={props.trackRef}>
      {props.children}
    </TrackRefContext.Provider>
  ) : (
    <>{props.children}</>
  );
}

/** @public */
export interface ParticipantTileProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The track reference to display. */
  trackRef?: TrackReferenceOrPlaceholder;
  disableSpeakingIndicator?: boolean;

  onParticipantClick?: (event: ParticipantClickEvent) => void;
  participantCount?: number;
  index?: number;
  isFocus?: boolean;
  onRestPlaceholderClick?: () => void;
  hideSourcePrefix?: boolean;
  renderPlaceholderExtraProps?: Record<string, any>;
  toggleable?: boolean;
  renderExtraCount?: boolean;
}

export const ParticipantTile = /* @__PURE__ */ React.forwardRef<
  HTMLDivElement,
  ParticipantTileProps
>(function ParticipantTile(
  {
    trackRef,
    children,
    onParticipantClick,
    disableSpeakingIndicator,
    participantCount,
    index,
    isFocus,
    onRestPlaceholderClick,
    hideSourcePrefix,
    renderPlaceholderExtraProps,
    toggleable,
    renderExtraCount,
    ...htmlProps
  }: ParticipantTileProps,
  ref
) {
  const trackReference = useEnsureTrackRef(trackRef);
  const featureFlags = useFeatureContext();
  const { getContextMenuItems } = useParticipantContextMenu();
  const containerRef = React.useRef<any>(null);
  const pinchableRef = React.useRef<PinchableBlockInstance>(null);
  const [isExpand, setIsExpand] = React.useState(false);

  React.useEffect(() => {
    if (trackReference.source === Track.Source.ScreenShare) {
      setTimeout(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        console.warn('set screen share rect', rect, containerRef.current);
        pinchableRef.current?.initSize({
          height: rect?.height,
          width: rect?.width,
        });
      });
    }
  }, [trackReference.source]);

  const shouldShowScaleControl = React.useMemo(() => {
    return trackReference.source === Track.Source.ScreenShare && isFocus;
  }, [trackReference.source, isFocus]);

  const onZoomReset = useMemoizedFn(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    pinchableRef.current?.initSize({
      height: rect?.height,
      width: rect?.width,
    });
    pinchableRef.current?.zoomReset();
  });

  const handleResize = useMemoizedFn(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    pinchableRef.current?.initSize({
      height: rect?.height,
      width: rect?.width,
    });
  });

  React.useEffect(() => {
    if (!shouldShowScaleControl) {
      return;
    }
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [shouldShowScaleControl]);

  const { elementProps } = useParticipantTile<HTMLDivElement>({
    htmlProps,
    disableSpeakingIndicator,
    onParticipantClick,
    trackRef: trackReference,
  });
  const layoutContext = useMaybeLayoutContext();

  const autoManageSubscription = useFeatureContext()?.autoSubscription;

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

  const extraCount = React.useMemo(() => {
    if (!participantCount) return 0;
    return participantCount - 16 + 1;
  }, [participantCount]);

  const setRefs = React.useCallback(
    node => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      containerRef.current = node;
    },
    [ref]
  );

  if (renderExtraCount) {
    return (
      <div
        onClick={onRestPlaceholderClick}
        className="participant-tile-extra-count"
      >
        <div className="participant-tile-extra-count-inner" style={{}}>
          +{extraCount}
        </div>
      </div>
    );
  }

  const menuItems = getContextMenuItems(trackReference.participant);

  const renderMetadata = () => {
    return (
      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item">
          {trackReference.source === Track.Source.Camera ? (
            <>
              <TrackMutedIndicator
                trackRef={{
                  participant: trackReference.participant,
                  source: Track.Source.Microphone,
                }}
                show={'always'}
              ></TrackMutedIndicator>
              <ParticipantName />
            </>
          ) : (
            <>
              <IconScreenShare
                style={{ marginRight: '0.25rem' }}
                className="call-icon main-screen-share-icon"
              />
              <ParticipantName>
                {hideSourcePrefix ? '' : "'s screen"}
              </ParticipantName>
            </>
          )}
        </div>
        {shouldShowScaleControl && (
          <>
            <div className="lk-participant-tile-item-divider"></div>
            <div className="lk-screen-share-control">
              <div className="lk-screen-share-control-item">
                <ZoomOut onClick={() => pinchableRef.current?.zoomOut()} />
              </div>
              <div className="lk-screen-share-control-item">
                <ZoomReset onClick={onZoomReset} />
              </div>
              <div className="lk-screen-share-control-item">
                <ZoomIn onClick={() => pinchableRef.current?.zoomIn()} />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderToggleableIcon = () => {
    if (!toggleable) {
      return null;
    }

    return (
      <div
        className="lk-participant-tile-toggleable-icon"
        onClick={() => setIsExpand(!isExpand)}
      >
        {isExpand ? (
          <div className="call-icon shrink-mini-icon"></div>
        ) : (
          <div className="call-icon expand-mini-icon"></div>
        )}
      </div>
    );
  };

  if (!isExpand && toggleable) {
    return (
      <div className="lk-participant-tile-minimal-view">
        <div className="lk-participant-tile-minimal-view-metadata">
          <TrackMutedIndicator
            trackRef={{
              participant: trackReference.participant,
              source: Track.Source.Microphone,
            }}
            show={'always'}
          ></TrackMutedIndicator>
          <ParticipantName />
        </div>

        {renderToggleableIcon()}
      </div>
    );
  }

  return (
    <ContextMenu
      menu={{ items: menuItems }}
      destroyPopupOnHide
      disabled={menuItems.length === 0}
    >
      <div
        ref={setRefs}
        style={{
          position: 'relative',
          ...(trackReference.source === Track.Source.ScreenShare
            ? { overflow: 'auto' }
            : {}),
        }}
        {...elementProps}
        className={classNames([
          elementProps.className,
          {
            'is-focus-screen-share':
              isFocus && trackReference.source === Track.Source.ScreenShare,
            'lk-participant-tile-toggleable': toggleable,
          },
        ])}
      >
        <TrackRefContextIfNeeded trackRef={trackReference}>
          <ParticipantContextIfNeeded participant={trackReference.participant}>
            {children ?? (
              <>
                {isTrackReference(trackReference) &&
                (trackReference.publication?.kind === 'video' ||
                  trackReference.source === Track.Source.Camera ||
                  trackReference.source === Track.Source.ScreenShare) ? (
                  trackReference.source === Track.Source.ScreenShare ? (
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
                  ) : (
                    <VideoTrack
                      trackRef={trackReference}
                      onSubscriptionStatusChanged={handleSubscribe}
                      manageSubscription={autoManageSubscription}
                    />
                  )
                ) : (
                  isTrackReference(trackReference) && (
                    <AudioTrack
                      trackRef={trackReference}
                      onSubscriptionStatusChanged={handleSubscribe}
                    />
                  )
                )}
                <div className="lk-participant-placeholder">
                  {featureFlags?.renderParticipantPlaceholder?.(
                    trackReference.participant,
                    renderPlaceholderExtraProps
                  ) ?? null}
                </div>

                {renderMetadata()}
              </>
            )}
            {/* <FocusToggle trackRef={trackReference} /> */}
          </ParticipantContextIfNeeded>
        </TrackRefContextIfNeeded>
        {renderToggleableIcon()}
      </div>
    </ContextMenu>
  );
});
