import { ConnectionState, Room } from '@cc-livekit/livekit-client';
import { useMemo } from 'react';
import { currentCall } from '../initCall';
import { roomAtom } from '../atoms/roomAtom';
import { useAtomValue } from 'jotai';
import { useConnectionState } from '../modules/react';

export const useRemoteParticipantMask = (
  room: Room,
  contactMap: Map<string, any>
) => {
  const roomInfo = useAtomValue(roomAtom);
  const connectionState = useConnectionState(room);

  const visible = useMemo(() => {
    return (
      roomInfo.type === '1on1' &&
      (room.remoteParticipants.size === 0 ||
        connectionState === ConnectionState.Connecting)
    );
  }, [roomInfo.type, room.remoteParticipants.size, connectionState]);

  const userInfo = useMemo(() => {
    if (!visible) return null;
    return contactMap.get(
      currentCall.isPassive ? currentCall.caller : currentCall.number
    );
  }, [visible, contactMap]);

  return {
    visible,
    userInfo,
  };
};
