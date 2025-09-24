import { useEffect } from 'react';
import { IInitials } from './useInitials';
import { getLogger, makeMessageCollapseId } from '../utils';
import { useMemoizedFn } from 'ahooks';
import { ICallError } from '../CallRoom';
import { currentCall, callingAPI, callControlType } from '../initCall';
import { useGlobalConfig } from './useGlobalConfig';
import { OverrideRequestType } from './useOverrideCallRequest';

const logger = getLogger();

export const usePrivateCall = ({
  initials,
  roomCipherRef,
  finishStartCall,
  handleCallError,
  overrideRequest,
}: {
  initials: IInitials;
  roomCipherRef: any;
  finishStartCall: (res: any) => void;
  handleCallError: (e: ICallError) => void;
  overrideRequest: OverrideRequestType;
}) => {
  const { createCallMsg } = useGlobalConfig();

  const startPrivateCall = useMemoizedFn(async () => {
    try {
      logger.warn('start private call currentCall', currentCall);

      const timestamp = Date.now();

      const collapseId = makeMessageCollapseId(
        currentCall.ourNumber,
        currentCall.deviceId,
        timestamp
      );

      const options = {
        conversationId: {
          number: currentCall.number,
        },
        type: currentCall.type,
        version: 10,
        timestamp,
        callees: [currentCall.number],
        collapseId,
        ourNumber: currentCall.ourNumber,
        roomName: currentCall.ourName,
        needSync: createCallMsg === true,
        controlType: callControlType.StartCall,
        createCallMsg,
        overrideRequest,
      };

      roomCipherRef.current = await (
        window as any
      ).textsecure.CallRoomCipher.fromNewKey();

      const res = await callingAPI.startCall(options, roomCipherRef.current);

      if (res.emkStale) {
        roomCipherRef.current = await (
          window as any
        ).textsecure.CallRoomCipher.from(
          (window as any).Signal.Crypto.base64ToArrayBuffer(res.emk),
          (window as any).Signal.Crypto.base64ToArrayBuffer(res.publicKey)
        );
      }

      res.key = roomCipherRef.current.exportMKey();
      res.timestamp = timestamp;

      if (res) {
        finishStartCall(res);
      }
    } catch (e) {
      handleCallError(e as ICallError);
    }
  });

  const joinPrivateCall = useMemoizedFn(async () => {
    try {
      const options = {
        roomId: currentCall.roomId,
        type: currentCall.type,
        version: 10,
        timestamp: Date.now(),
        overrideRequest,
      };

      const res = await callingAPI.joinCall(options);

      roomCipherRef.current = await (
        window as any
      ).textsecure.CallRoomCipher.from(
        (window as any).Signal.Crypto.base64ToArrayBuffer(res.emk),
        (window as any).Signal.Crypto.base64ToArrayBuffer(res.publicKey)
      );

      res.key = roomCipherRef.current.exportMKey();

      if (res) {
        finishStartCall(res);
      }
    } catch (e) {
      handleCallError(e as ICallError);
    }
  });

  useEffect(() => {
    if (!initials) {
      return;
    }

    (async () => {
      // 1v1主叫
      if (currentCall.isPrivate) {
        if (currentCall.roomId) {
          joinPrivateCall();
        } else {
          startPrivateCall();
        }
      }
    })();
  }, [initials]);
};
