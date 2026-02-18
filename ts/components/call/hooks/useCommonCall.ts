import { useMemoizedFn } from 'ahooks';
import { getLogger } from '../utils';
import { API_STATUS } from '../../../types/APIStatus';
import { message } from 'antd';
import { LocalizerType } from '../../../types/Util';
import { useEffect, useRef } from 'react';
import {
  AudioCaptureOptions,
  ConnectionError,
  Room,
} from '@cc-livekit/livekit-client';
import { callActionType, currentCall, switchServiceUrl } from '../initCall';
import { roomAtom, roomDurationAtom } from '../atoms/roomAtom';
import { useAtomValue, useSetAtom } from 'jotai';
import playAudio from '../PlayAudio';
import { ICallError } from '../CallRoom';
import { useGlobalConfig } from './useGlobalConfig';
import { CallResponse } from '../types';

const logger = getLogger();

interface IProps {
  i18n: LocalizerType;
  room: Room;
}

export const useCommonCall = ({ i18n, room }: IProps) => {
  const setRoomInfo = useSetAtom(roomAtom);
  const { createCallMsg } = useGlobalConfig();
  const closingWindowRef = useRef(false);
  const roomDuration = useAtomValue(roomDurationAtom);

  const doClose = () => {
    (window as any).closeCallWindow();
    if (!closingWindowRef.current && roomDuration >= 60) {
      (window as any).openCallFeedback({
        userIdentity:
          room.localParticipant.identity ||
          `${currentCall.ourNumber}.${currentCall.deviceId}`,
        userSid: room.localParticipant.sid,
        roomId: currentCall.roomId,
      });
    }
    closingWindowRef.current = true;

    if (currentCall.type !== '1on1') {
      if (currentCall.endingCall) {
        (window as any).removeJoinCallButton(currentCall.roomId);
        return;
      }
      if (room.remoteParticipants.size === 0) {
        (window as any).removeJoinCallButton(currentCall.roomId);
      } else {
        (window as any).addJoinCallButton({
          ...currentCall,
          createdAt: null,
        });
        console.log('[add-call-button]', 'room not ended.');
      }
    } else {
      if (!currentCall.isPassive) {
        (window as any).removeJoinCallButton(currentCall.roomId);
      }
    }
  };

  const doDisConnect = () => {
    room?.disconnect?.();
    doClose();
  };

  const delayCloseWindow = (errorMsg?: string) => {
    if (closingWindowRef.current) {
      return;
    }
    closingWindowRef.current = true;
    playAudio('call-off');
    if (errorMsg) {
      message.error(errorMsg);
    }
    setTimeout(() => {
      doDisConnect();
    }, 1500);
  };

  const initMediaStatus = useMemoizedFn(
    ({ audio }: { audio: boolean | AudioCaptureOptions }) => {
      if (!room) {
        return;
      }
      const localP = room.localParticipant;
      try {
        Promise.all([
          localP.setMicrophoneEnabled(
            !!audio,
            typeof audio !== 'boolean' ? audio : undefined
          ),
        ]);
      } catch (e) {
        console.log('initial media status error', e);
      }
    }
  );

  const finishStartCall = useMemoizedFn(async (res: CallResponse) => {
    if (res) {
      initMediaStatus({ audio: currentCall.type === '1on1' });

      // 主叫
      if (!currentCall.roomId && currentCall.ourNumber === res.caller.uid) {
        (window as any).sendCallText({
          action: callActionType.StartCall,
          type: currentCall.type,
          conversationIds: [currentCall.number || currentCall.groupId],
          createCallMsg,
          timestamp: res.timestamp,
          serverTimestamp: res.systemShowTimestamp,
        });
      }

      currentCall.roomId = res.roomId;
      currentCall.emk = res.emk;
      currentCall.publicKey = res.publicKey;
      if (currentCall.type !== 'instant') {
        currentCall.caller = res.caller.uid;
      }
      currentCall.mk = res.key;
      currentCall.isPassive = currentCall.ourNumber !== res.caller.uid;

      setRoomInfo({
        key: res.key,
        token: res.token,
        serviceUrl: currentCall.serviceUrl,
        type: currentCall.type,
        roomName: currentCall.roomName,
      });
      logger.info('finish start call', currentCall.roomId);

      let conversationId;
      if (currentCall.type === '1on1') {
        conversationId = currentCall.number;
      } else {
        conversationId = currentCall.groupId;
      }
      (window as any).finishJoinCall(
        currentCall.roomId,
        conversationId,
        res.systemShowTimestamp
      );

      if (currentCall.type !== '1on1') {
        if (currentCall.type === 'instant') {
          // 删除可能存在的 1on1 join call button
          (window as any).removeJoinCallButton(currentCall.roomId);
        }
        (window as any).addJoinCallButton({ ...currentCall });
        console.log('[add-call-button]', 'finish start call.');
      }
    }
  });

  const handleCallError = (e: ICallError): void => {
    switch (e?.response?.status) {
      case API_STATUS.InvalidRoomId: {
        delayCloseWindow(i18n('call.finished'));
        return;
      }
      case API_STATUS.NoAvailableUsers: {
        delayCloseWindow(e.response.reason ?? e?.reason);
        return;
      }
      default:
        const reason = e?.response?.reason ?? e?.reason ?? '';
        if (reason) {
          message.error(reason, 0);
          return;
        }
        logger.info('[livekit call error]', e);
    }
  };

  const handleDestroyCall = useMemoizedFn((roomId, shouldDelay) => {
    if (roomId === currentCall.roomId) {
      logger.info('on destroy call, shouldDelay:', shouldDelay);

      if (shouldDelay) {
        currentCall.endingCall = true;
        let message = '';
        const reason = currentCall.type === '1on1' ? 'hangup' : 'end-call';

        if (reason === 'hangup') {
          message = i18n('call.hangup');
        } else if (reason === 'end-call') {
          message = i18n('call.endCall');
        }
        delayCloseWindow(message);
      } else {
        doClose();
      }
    }
  });

  useEffect(() => {
    const cleanup = (window as any).registerDestroyCallHandler(
      (_: any, roomId: string, shouldDelay: boolean) =>
        handleDestroyCall(roomId, shouldDelay)
    );

    return () => cleanup();
  }, []);

  const onConnectionError = useMemoizedFn(() => {
    switchServiceUrl();
    setRoomInfo(prev => ({
      ...prev,
      serviceUrl: currentCall.serviceUrl,
    }));
  });

  const onError = useMemoizedFn((e: any) => {
    logger.info('livekit components-js error:', e);
    if (e instanceof ConnectionError) {
      onConnectionError();
    }
  });

  const onBackToMain = () => {
    (window as any).onBackToMainWindow();
  };

  return {
    finishStartCall,
    handleCallError,
    onError,
    delayCloseWindow,
    doClose,
    doDisConnect,
    onBackToMain,
    handleDestroyCall,
  };
};
