import * as React from 'react';
import {
  customSortTrackFunction,
  getTrackReferenceId,
  type TrackReferenceOrPlaceholder,
} from '../../../core';

import { ParticipantTile } from '../participant/ParticipantTile';
import { isMobileCameraOn, splitTracksToRows } from './helper';

function getTrackStyleSheets(
  track: TrackReferenceOrPlaceholder,
  rowsCount: number
) {
  if (isMobileCameraOn(track)) {
    return {
      aspectRatio: '9 / 16',
    };
  } else {
    return {
      flex: 1,
      maxWidth: `${(100 / rowsCount).toFixed(2)}%`,
    };
  }
}

interface GridLayoutProps {
  tracks: TrackReferenceOrPlaceholder[];
  onRestPlaceholderClick?: () => void;
}

export function GridLayout({
  tracks,
  onRestPlaceholderClick,
}: GridLayoutProps) {
  const tracksForLoop = React.useMemo(() => {
    if (!tracks.length) return [];

    if (tracks.length <= 16) {
      const result = tracks.sort((a, b) => {
        if (a.participant.isLocal && b.participant.isLocal) {
          return 0;
        }
        if (a.participant.isLocal) {
          return -1;
        }
        if (b.participant.isLocal) {
          return 1;
        }
        return 0;
      });
      return result;
    }

    const result = [...customSortTrackFunction(tracks)];

    return result;
  }, [tracks]);

  const rows = React.useMemo(() => {
    return splitTracksToRows(tracksForLoop);
  }, [tracksForLoop]);

  return (
    <div
      className="grid-layout"
      style={{
        padding: `${rows.length === 1 && tracksForLoop.length > 1 ? 100 : 8}px 8px`,
      }}
    >
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid-layout-row row-count-${rows.length}`}
          style={{
            height: `${100 / rows.length}%`,
          }}
        >
          {row.map((track, trackIndex) => (
            <div
              key={getTrackReferenceId(track)}
              style={getTrackStyleSheets(track, rows.length)}
              className="grid-layout-track"
            >
              <ParticipantTile
                trackRef={track}
                renderExtraCount={
                  tracksForLoop.length > 15 &&
                  rowIndex === rows.length - 1 &&
                  trackIndex === row.length - 1
                }
                participantCount={tracksForLoop.length}
                onRestPlaceholderClick={onRestPlaceholderClick}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
