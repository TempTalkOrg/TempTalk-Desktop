import { Track } from '@cc-livekit/livekit-client';
import { TrackReferenceOrPlaceholder } from '../../../core';

function isCameraMuted(track: TrackReferenceOrPlaceholder) {
  try {
    const trackPublication = track.publication;
    return (
      !trackPublication ||
      (trackPublication.source === Track.Source.Camera &&
        trackPublication.isMuted)
    );
  } catch (error) {
    console.log('get camera state error', error);
    return true;
  }
}

function isMobileParticipant(track: TrackReferenceOrPlaceholder) {
  return track.participant.identity.endsWith('.1');
}

export function isMobileCameraOn(track: TrackReferenceOrPlaceholder) {
  return isMobileParticipant(track) && !isCameraMuted(track);
}

export function splitTracksToRows(tracks: TrackReferenceOrPlaceholder[]) {
  const count = tracks.length;

  if (count <= 0) {
    return [];
  }

  // 1. x ≤ 2 时，直接展示为一行
  if (count <= 2) {
    return [tracks];
  }

  // 2. x > 2 && x ≤ 8 时，展示为 2 行
  if (count > 2 && count <= 8) {
    // special case
    if (count <= 4 && tracks.some(track => isMobileCameraOn(track))) {
      return [tracks];
    }
    const firstRow = Math.floor(count / 2);
    const secondRow = count - firstRow;
    return [
      tracks.slice(0, firstRow),
      tracks.slice(firstRow, firstRow + secondRow),
    ];
  }

  // 3. x > 8 && x ≤ 15 时，按三行排列
  if (count > 8 && count <= 15) {
    const basePerRow = Math.floor(count / 3);
    const remainder = count % 3;

    if (remainder === 0) {
      // 能均分的情况，如 9 个按 [3, 3, 3]
      return [
        tracks.slice(0, basePerRow),
        tracks.slice(basePerRow, basePerRow * 2),
        tracks.slice(basePerRow * 2, basePerRow * 3),
      ];
    } else if (remainder === 1) {
      // 余数为 1 的情况，如 10 个按 [3, 3, 4]
      const firstRow = basePerRow;
      const secondRow = basePerRow;
      const thirdRow = basePerRow + 1;
      return [
        tracks.slice(0, firstRow),
        tracks.slice(firstRow, firstRow + secondRow),
        tracks.slice(firstRow + secondRow, firstRow + secondRow + thirdRow),
      ];
    } else {
      // 余数为 2 的情况，如 11 个按 [3, 4, 4]
      const firstRow = basePerRow;
      const secondRow = basePerRow + 1;
      const thirdRow = basePerRow + 1;
      return [
        tracks.slice(0, firstRow),
        tracks.slice(firstRow, firstRow + secondRow),
        tracks.slice(firstRow + secondRow, firstRow + secondRow + thirdRow),
      ];
    }
  }

  // 4. x > 15 时，取前 15 个进行 [5, 5, 5] 排列
  const limitedTracks = tracks.slice(0, 15);
  return [
    limitedTracks.slice(0, 5),
    limitedTracks.slice(5, 10),
    limitedTracks.slice(10, 15),
  ];
}
