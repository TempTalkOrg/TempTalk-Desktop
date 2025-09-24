import { useMemoizedFn, useNetwork } from 'ahooks';
import { getLogger } from '../utils';
import { DisconnectReason, Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect } from 'react';
import { currentCall } from '../initCall';

const logger = getLogger();

interface IProps {
  room: Room;
  manualHangupRef: any;
  onTimeout?: () => void;
  onFail?: () => void;
}

export const useReconnect = ({
  room,
  manualHangupRef,
  onTimeout,
  onFail,
}: IProps) => {
  const networkInfo = useNetwork();

  const onLocalDisconnected = useMemoizedFn(async reason => {
    logger.info(
      'local disconnected, reason:',
      reason,
      DisconnectReason[reason ?? DisconnectReason.UNKNOWN_REASON],
      'roomId:',
      currentCall.roomId,
      networkInfo
    );
    // 重试最大次数后仍然断连
    if (!networkInfo.online) {
      return onTimeout?.();
    }

    if (manualHangupRef.current) {
      return;
    }

    if ([DisconnectReason.CLIENT_INITIATED].includes(reason)) {
      onFail?.();
    }
  });

  useEffect(() => {
    room.on(RoomEvent.Disconnected, onLocalDisconnected);

    return () => {
      room.off(RoomEvent.Disconnected, onLocalDisconnected);
    };
  }, []);
};
