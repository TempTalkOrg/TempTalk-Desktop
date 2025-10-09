import * as React from 'react';
import { Track } from '@cc-livekit/livekit-client';
import {
  IconMicDisabled,
  IconScreenShare,
  IconScreenShareStop,
} from '../../../../shared/icons';

/**
 * @internal
 */
export function getSourceIcon(
  source: Track.Source,
  enabled: boolean,
  singleColor: boolean = false
) {
  switch (source) {
    case Track.Source.Microphone:
      return enabled ? (
        <div className="call-icon mic-icon"></div>
      ) : (
        <IconMicDisabled />
      );
    case Track.Source.Camera:
      return enabled ? (
        singleColor ? (
          <div className="call-icon camera-single-color-icon"></div>
        ) : (
          <div className="call-icon camera-icon"></div>
        )
      ) : singleColor ? (
        <div className="call-icon camera-disabled-single-color-icon"></div>
      ) : (
        <div className="call-icon camera-disabled-icon"></div>
      );
    case Track.Source.ScreenShare:
      return enabled ? (
        <IconScreenShareStop className="call-icon main-screen-share-stop-icon" />
      ) : (
        <IconScreenShare className="call-icon main-screen-share-icon" />
      );
    default:
      return undefined;
  }
}
