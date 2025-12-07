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
import { callActionType, currentCall } from '../initCall';
import { roomAtom } from '../atoms/roomAtom';
import { useAtom } from 'jotai';
import { isArray, isEmpty, union } from 'lodash';
import playAudio from '../PlayAudio';
import { ICallError } from '../CallRoom';
import { useGlobalConfig } from './useGlobalConfig';
import { CallResponse } from '../types';

const logger = getLogger();

interface IProps {
  i18n: LocalizerType;
  room: Room;
}

const getFinalUrls = (urlsFromMain: string[], availableUrls: string[]) => {
  // urlsFromMain not ready
  if (!urlsFromMain.length) {
    return availableUrls;
  } else {
    const filteredUrls = urlsFromMain.filter(url =>
      availableUrls.includes(url)
    );
    return filteredUrls.length
      ? union(filteredUrls, availableUrls)
      : availableUrls;
  }
};

export const useCommonCall = ({ i18n, room }: IProps) => {
  const [roomInfo, setRoomInfo] = useAtom(roomAtom);
  const { createCallMsg } = useGlobalConfig();
  const closingWindowRef = useRef(false);

  const doClose = () => {
    (window as any).closeCallWindow();
    if (!closingWindowRef.current) {
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
      currentCall.caller = res.caller.uid;
      currentCall.mk = res.key;
      currentCall.isPassive = currentCall.ourNumber !== res.caller.uid;

      const urlsFromMain = currentCall.serviceUrls || [];

      const { serviceUrl, serviceUrls } = res;
      const availableUrls =
        isEmpty(serviceUrls) || !isArray(serviceUrls)
          ? [serviceUrl]
          : serviceUrls;

      const finalUrls = getFinalUrls(urlsFromMain, availableUrls);

      setRoomInfo({
        key: res.key,
        token: res.token,

        serviceUrl: finalUrls[0],
        serviceUrls: finalUrls,
        type: currentCall.type,
        roomName: currentCall.roomName,
      });
      logger.info('finish start call', currentCall.roomId);

      (window as any).finishJoinCall(currentCall.roomId);

      if (currentCall.type !== '1on1') {
        if (currentCall.type === 'instant') {
          // 删除可能存在的 1on1 join call button
          (window as any).removeJoinCallButton(currentCall.roomId);
        }
        (window as any).addJoinCallButton({ ...currentCall });
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

  const handleDestroyCall = useMemoizedFn((_, roomId, reason) => {
    if (roomId === currentCall.roomId) {
      if (reason) {
        if (reason === 'hangup') {
          const message =
            currentCall.type === '1on1'
              ? i18n('call.hangup')
              : i18n('call.forceEnd');

          currentCall.endingCall = true;
          delayCloseWindow(message);
          logger.info('got hangup');
        }
      } else {
        logger.error('destroy call without reason');
        doClose();
      }
    }
  });

  useEffect(() => {
    const cleanup = (window as any).registerDestroyCallHandler(
      handleDestroyCall
    );

    return () => cleanup();
  }, []);

  const switchServiceUrl = useMemoizedFn(() => {
    const { serviceUrl, serviceUrls } = roomInfo;
    if (!serviceUrls?.length) return;

    let nextIndex = 0;
    const currentIndex = serviceUrls.indexOf(serviceUrl);

    if (currentIndex !== -1) {
      nextIndex = (currentIndex + 1) % serviceUrls.length;
    }

    setRoomInfo(prev => ({
      ...prev,
      serviceUrl: serviceUrls[nextIndex],
    }));
  });

  const onError = useMemoizedFn((e: any) => {
    logger.info('livekit components-js error:', e);
    if (e instanceof ConnectionError) {
      switchServiceUrl();
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
