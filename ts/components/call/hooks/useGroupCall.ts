import { useEffect } from 'react';
import { IInitials } from './useInitials';
import { ICallError } from '../CallRoom';
import { callControlType, callingAPI, currentCall } from '../initCall';
import { makeMessageCollapseId } from '../utils';
import { useMemoizedFn } from 'ahooks';
import { useGlobalConfig } from './useGlobalConfig';
import { OverrideRequestType } from './useOverrideCallRequest';
import { CallResponse } from '../types';

export const useGroupCall = ({
  initials,
  roomCipherRef,
  finishStartCall,
  handleCallError,
  overrideRequest,
}: {
  initials: IInitials;
  roomCipherRef: any;
  finishStartCall: (res: CallResponse) => void;
  handleCallError: (e: ICallError) => void;
  overrideRequest: OverrideRequestType;
}) => {
  const { createCallMsg } = useGlobalConfig();

  const startGroupCall = useMemoizedFn(async () => {
    try {
      const timestamp = Date.now();

      const collapseId = makeMessageCollapseId(
        currentCall.ourNumber,
        currentCall.deviceId,
        timestamp
      );

      const callees = await (window as any).getGroupMembers(
        currentCall.groupId
      );

      const options = {
        conversationId: {
          groupId: currentCall.groupId,
        },
        type: currentCall.type,
        version: 10,
        timestamp,
        callees,
        collapseId,
        needSync: true,
        roomName: currentCall.roomName,
        ourNumber: currentCall.ourNumber,
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
      finishStartCall(res);
    } catch (e) {
      handleCallError(e as ICallError);
    }
  });

  const joinGroupCall = useMemoizedFn(async () => {
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
      if (!currentCall.isPrivate) {
        if (currentCall.roomId) {
          joinGroupCall();
        } else {
          startGroupCall();
        }
      }
    })();
  }, [initials]);
};
