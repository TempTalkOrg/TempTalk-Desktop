import React from 'react';
import { formatTime } from './utils';
import { useTimer } from './hooks/useTimer';
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
  const { count } = useTimer(room);
  const { countdownTimerEnabled } = useGlobalConfig();

  const formattedCount = formatTime(count);

  return (
    <div className="call-room-title">
      <div className="content-area">
        <span className="title-text">
          {roomInfo.roomName}{' '}
          {formattedCount && (
            <span className="call-timer">{formattedCount}</span>
          )}
        </span>
        {countdownTimerEnabled && <div className="content-divider"></div>}
        {extra}
      </div>
    </div>
  );
};
