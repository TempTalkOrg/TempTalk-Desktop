import {
  Room,
  RoomEvent,
  TTCallRequest,
  TTStartCall,
} from '@cc-livekit/livekit-client';
import { callingAPI, currentCall } from '../initCall';
import { useMemoizedFn } from 'ahooks';
import { CallResponse } from '../types';
import { getWebApiUserAgent } from '../../../web_api/util';

type OverrideRequestData = TTStartCall & { conversation: string };

export type OverrideRequestType = (
  callData: OverrideRequestData
) => Promise<CallResponse>;

export const useOverrideCallRequest = ({
  room,
  onTimeout,
}: {
  room: Room;
  onTimeout: () => void;
}) => {
  const getConnectResponse = useMemoizedFn(() => {
    return {
      ...room.ttCallResp?.body,
      systemShowTimestamp: Number(room.ttCallResp?.body?.systemShowTimestamp),
    };
  });

  const getResponseFromRoomEvent = useMemoizedFn(async () => {
    return new Promise<any>(resolve => {
      room.once(RoomEvent.SignalConnected, () => {
        if (room.ttCallResp) {
          resolve(getConnectResponse());
        }
      });
    });
  });

  const handleTimeout = useMemoizedFn(() => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('start-call-timeout'));
      }, 1000 * 15);
    });
  });

  const overrideCallRequest: OverrideRequestType = useMemoizedFn(
    async callData => {
      const newRequestFn = async () => {
        await room.connect(currentCall.serviceUrls[0], '', {
          ttCallRequest: new TTCallRequest({
            token: await callingAPI.getCallToken(),
            startCall: new TTStartCall({
              ...callData,
              conversationId: callData.conversation,
            }),
            userAgent: getWebApiUserAgent(),
          }),
        });
        return getConnectResponse();
      };

      try {
        return await Promise.race([
          newRequestFn(),
          getResponseFromRoomEvent(),
          handleTimeout(),
        ]);
      } catch (e: any) {
        console.log('error in overrideCallRequest', e.code, e.name);
        if (e.code === 401) {
          await callingAPI.getCallToken(true);
          return await overrideCallRequest(callData);
        } else if (e.message === 'start-call-timeout') {
          onTimeout?.();
        } else {
          throw e;
        }
      }
    }
  );

  return overrideCallRequest;
};
