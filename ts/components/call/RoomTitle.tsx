import React from 'react';
import { formatTime } from './utils';
import { useRoomDuration } from './hooks/useRoomDuration';
import { roomAtom } from './atoms/roomAtom';
import { useAtomValue } from 'jotai';
import { Room } from '@cc-livekit/livekit-client';
import { useGlobalConfig } from './hooks/useGlobalConfig';

export const RoomTitle = ({
  room,
  extra,
}: {
  room: Room;
  extra?: React.ReactNode;
}) => {
  const roomInfo = useAtomValue(roomAtom);
  const { duration } = useRoomDuration(room);
  const { countdownTimerEnabled } = useGlobalConfig();

  const formattedDuration = formatTime(duration);

  return (
    <div className="call-room-title">
      <div className="content-area">
        <span className="title-text">
          {roomInfo.roomName}{' '}
          {formattedDuration && (
            <span className="call-duration">{formattedDuration}</span>
          )}
        </span>
        {countdownTimerEnabled && <div className="content-divider"></div>}
        {extra}
      </div>
    </div>
  );
};
