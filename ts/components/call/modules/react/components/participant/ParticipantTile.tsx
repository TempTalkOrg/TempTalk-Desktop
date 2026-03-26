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
import { useParticipantContextMenu } from '../../hooks/useParticipantContextMenu';
import classNames from 'classnames';
import { ContextMenu } from '../../../../../shared/ContextMenu';
import { MicOnLineUp } from '../MicOnLineUp';
import {
  forwardRef,
  HTMLAttributes,
  PropsWithChildren,
  useMemo,
  useState,
} from 'react';
import { useMemoizedFn } from 'ahooks';

export function ParticipantContextIfNeeded(
  props: PropsWithChildren<{
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
  props: PropsWithChildren<{
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

export interface ParticipantTileProps extends HTMLAttributes<HTMLDivElement> {
  /** The track reference to display. */
  trackRef?: TrackReferenceOrPlaceholder;
  disableSpeakingIndicator?: boolean;

  onParticipantClick?: (event: ParticipantClickEvent) => void;
  participantCount?: number;
  isFocus?: boolean;
  onRestPlaceholderClick?: () => void;
  renderPlaceholderExtraProps?: Record<string, any>;
  toggleable?: boolean;
  renderExtraCount?: boolean;
}

export const ParticipantTile = forwardRef<HTMLDivElement, ParticipantTileProps>(
  function ParticipantTile(
    {
      trackRef,
      children,
      onParticipantClick,
      disableSpeakingIndicator,
      participantCount,
      // isFocus,
      onRestPlaceholderClick,
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
    const [isExpand, setIsExpand] = useState(false);

    const type = featureFlags?.type;

    const { elementProps } = useParticipantTile<HTMLDivElement>({
      htmlProps,
      disableSpeakingIndicator,
      onParticipantClick,
      trackRef: trackReference,
    });
    const layoutContext = useMaybeLayoutContext();

    const autoManageSubscription = useFeatureContext()?.autoSubscription;

    const handleSubscribe = useMemoizedFn((subscribed: boolean) => {
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
    });

    const extraCount = useMemo(() => {
      if (!participantCount) return 0;
      return participantCount - 15 + 1;
    }, [participantCount]);

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
        <div className="participant-metadata">
          <div className="participant-metadata-item">
            <TrackMutedIndicator
              trackRef={{
                participant: trackReference.participant,
                source: Track.Source.Microphone,
              }}
              show={'always'}
            ></TrackMutedIndicator>
            <ParticipantName />
          </div>
        </div>
      );
    };

    const renderToggleableIcon = () => {
      if (!toggleable) {
        return null;
      }

      return (
        <div
          className="participant-tile-toggleable-icon"
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
        <div
          className={classNames([
            'participant-tile-minimal-view',
            isExpand ? 'is-expand' : 'is-collapse',
            `room-type-${type}`,
          ])}
          onClick={() => setIsExpand(!isExpand)}
        >
          <div className="participant-tile-minimal-view-metadata">
            <TrackMutedIndicator
              trackRef={{
                participant: trackReference.participant,
                source: Track.Source.Microphone,
              }}
              show={'always'}
            ></TrackMutedIndicator>
            <ParticipantName />
          </div>
          {type !== '1on1' && <MicOnLineUp />}
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
          ref={ref}
          {...elementProps}
          className={classNames([
            elementProps.className,
            'participant-tile-wrapper',
            {
              'participant-tile-toggleable': toggleable,
            },
          ])}
        >
          <TrackRefContextIfNeeded trackRef={trackReference}>
            <ParticipantContextIfNeeded
              participant={trackReference.participant}
            >
              {children ?? (
                <>
                  {isTrackReference(trackReference) &&
                  (trackReference.publication?.kind === 'video' ||
                    trackReference.source === Track.Source.Camera) ? (
                    <VideoTrack
                      trackRef={trackReference}
                      onSubscriptionStatusChanged={handleSubscribe}
                      manageSubscription={autoManageSubscription}
                    />
                  ) : (
                    isTrackReference(trackReference) && (
                      <AudioTrack
                        trackRef={trackReference}
                        onSubscriptionStatusChanged={handleSubscribe}
                      />
                    )
                  )}
                  <div className="participant-placeholder">
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
  }
);
