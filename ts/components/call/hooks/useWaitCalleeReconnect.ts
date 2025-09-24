import { useEffect, useRef } from 'react';
import {
  ConnectionQuality,
  Participant,
  Room,
  RoomEvent,
} from '@cc-livekit/livekit-client';
import { useMemoizedFn } from 'ahooks';
import { roomAtom } from '../atoms/roomAtom';
import { useAtomValue } from 'jotai';
const WAITTING_TIMEOUT = 1000 * 60;

interface UseWaitCalleeReconnectProps {
  room: Room;
  onWaittingTimeout: () => void;
}

export const useWaitCalleeReconnect = ({
  room,
  onWaittingTimeout,
}: UseWaitCalleeReconnectProps) => {
  const roomInfo = useAtomValue(roomAtom);
  const waittingTimerRef = useRef<NodeJS.Timeout>();
  const initialConnectRef = useRef<boolean>(true);

  const handleParticipantDisconnected = useMemoizedFn(
    (participant: Participant) => {
      if (roomInfo.type !== '1on1') {
        return;
      }
      // 本地尝试重连前会发出 ParticipantDisconnected 事件，需要过滤掉
      if ((room.engine as any).attemptingReconnect) {
        return;
      }
      // 对方非网络问题离开，视为挂断
      if (
        ![ConnectionQuality.Lost, ConnectionQuality.Unknown].includes(
          participant.connectionQuality
        )
      ) {
        return;
      }
      console.log(
        'participant disconnected, start waitting for',
        participant.identity,
        participant.connectionQuality
      );

      waittingTimerRef.current = setTimeout(() => {
        waittingTimerRef.current = undefined;
        console.log(
          'wait over max timeout for',
          participant.identity,
          participant.connectionQuality
        );
        onWaittingTimeout?.();
      }, WAITTING_TIMEOUT);
    }
  );

  const handleParticipantConnected = useMemoizedFn(
    (participant: Participant) => {
      if (roomInfo.type !== '1on1') {
        return;
      }
      // filter initial connect
      if (initialConnectRef.current) {
        initialConnectRef.current = false;
        return;
      }
      console.log(
        'participant reconnected, reset waitting for',
        participant.identity,
        participant.connectionQuality
      );
      if (waittingTimerRef.current) {
        clearTimeout(waittingTimerRef.current);
        waittingTimerRef.current = undefined;
      }
      return;
    }
  );

  useEffect(() => {
    if (roomInfo.type && roomInfo.type !== '1on1') {
      if (waittingTimerRef.current) {
        clearTimeout(waittingTimerRef.current);
        waittingTimerRef.current = undefined;
      }
    }
  }, [roomInfo.type]);

  useEffect(() => {
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(
        RoomEvent.ParticipantDisconnected,
        handleParticipantDisconnected
      );
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, []);
};
