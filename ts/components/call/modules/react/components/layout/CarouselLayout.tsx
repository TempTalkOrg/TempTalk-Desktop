import type { TrackReferenceOrPlaceholder } from '../../../core';
import { customSortTrackFunction } from '../../../core';
import { TrackLoop } from '../TrackLoop';
import { Track } from '@cc-livekit/livekit-client';
import classNames from 'classnames';
import { useLayoutContext } from '../../context';
import React from 'react';

export interface CarouselLayoutProps
  extends React.HTMLAttributes<HTMLMediaElement> {
  tracks: TrackReferenceOrPlaceholder[];
  children: React.ReactNode;
  focusTrack?: TrackReferenceOrPlaceholder;
}

export function CarouselLayout({
  tracks,
  focusTrack,
  ...props
}: CarouselLayoutProps) {
  const sortedTiles = customSortTrackFunction(tracks, focusTrack);
  const isScreenShare = focusTrack?.source === Track.Source.ScreenShare;
  const { asideList } = useLayoutContext();
  const open = asideList.state?.open ?? false;

  return (
    <aside
      className={classNames([
        'carousel-list aside-participant-list',
        {
          'screen-share-aside': isScreenShare,
          'is-open': open,
        },
      ])}
      {...props}
      style={{ zIndex: 2 }}
    >
      <TrackLoop tracks={sortedTiles}>{props.children}</TrackLoop>
    </aside>
  );
}
