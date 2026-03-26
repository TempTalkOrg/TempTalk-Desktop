import { mergeProps } from '../../utils';
import { useIsSpeaking, useTrackMutedIndicator } from '../../hooks';
import type { TrackReferenceOrPlaceholder } from '../../../core';
import { Track } from '@cc-livekit/livekit-client';
import { getSourceIcon } from '../util';
import { forwardRef, useEffect, useMemo } from 'react';
import React from 'react';

export interface TrackMutedIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  trackRef: TrackReferenceOrPlaceholder;
  show?: 'always' | 'muted' | 'unmuted';
  singleColor?: boolean;
  onShowChange?: (show: boolean) => void;
}

export const TrackMutedIndicator = forwardRef<
  HTMLDivElement,
  TrackMutedIndicatorProps
>(function TrackMutedIndicator(
  {
    trackRef,
    show = 'always',
    singleColor,
    onShowChange,
    ...props
  }: TrackMutedIndicatorProps,
  ref
) {
  const { className, isMuted } = useTrackMutedIndicator(trackRef);
  const isSpeaking = useIsSpeaking(trackRef.participant);

  const showIndicator =
    show === 'always' ||
    (show === 'muted' && isMuted) ||
    (show === 'unmuted' && !isMuted);

  const htmlProps = useMemo(
    () =>
      mergeProps(props, {
        className,
      }),
    [className, props]
  );

  useEffect(() => {
    onShowChange?.(showIndicator);
  }, [showIndicator]);

  if (!showIndicator) {
    return null;
  }

  return (
    <div ref={ref} {...htmlProps}>
      {trackRef.source === Track.Source.Microphone ? (
        <ParticipantStatus
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          singleColor={singleColor}
        />
      ) : (
        getSourceIcon(trackRef.source, !isMuted, singleColor)
      )}
    </div>
  );
});

interface IParticipantStatusProps {
  isMuted: boolean;
  isSpeaking: boolean;
  singleColor?: boolean;
}

function ParticipantStatus(props: IParticipantStatusProps) {
  const { isSpeaking, isMuted, singleColor } = props;

  if (isMuted) {
    return singleColor ? (
      <div className="call-icon mic-disabled-single-color-icon" />
    ) : (
      <div className="call-icon mic-disabled-mini-icon" />
    );
  }
  if (isSpeaking) {
    return (
      <div className="speaking-bars">
        <div className="bar-item"></div>
        <div className="bar-item"></div>
        <div className="bar-item"></div>
      </div>
    );
  }
  return (
    <div
      className="call-icon speaking-dot-icon"
      style={{ height: 14, width: 14 }}
    ></div>
  );
}
