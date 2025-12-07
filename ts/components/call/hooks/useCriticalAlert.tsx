import { useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { currentCall, callingAPI } from '../initCall';
import { useMemoizedFn } from 'ahooks';
import { useAtomValue } from 'jotai';
import { roomAtom } from '../atoms/roomAtom';
import { Room } from '@cc-livekit/livekit-client';
import { LocalizerType } from '../../../types/Util';
import { message } from 'antd';
import { IconBulb } from '../../shared/icons';

export const useCriticalAlert = ({
  room,
  i18n,
  addMessage,
}: {
  room: Room;
  i18n: LocalizerType;
  addMessage: ({ identity, text }: { identity: string; text: string }) => void;
}) => {
  const [visible, setVisible] = useState<boolean>(currentCall.criticalAlert);
  const roomInfo = useAtomValue(roomAtom);
  const [messageApi, criticalAlertToast] = message.useMessage();

  const sendCriticalAlertMessage = useMemoizedFn(async () => {
    if (roomInfo.type !== '1on1') {
      return;
    }
    const identity = room.localParticipant.identity;
    try {
      await callingAPI.sendCriticalAlert({ destination: currentCall.number });
      addMessage({ identity, text: i18n('sendCriticalAlert.success') });
    } catch (e: any) {
      console.log('sendCriticalAlertMessage error', e);
      message.error(
        e?.code === 413
          ? i18n('sendCriticalAlert.rateLimitExceeded')
          : i18n('sendCriticalAlert.fail')
      );
    }
  });

  const menuItems = useMemo(() => {
    return [
      {
        key: 'send-critical-alert',
        label: (
          <div className="critical-alert-menu-item">
            <IconBulb color="var(--dst-color-function-error)" />
            {i18n('sendCriticalAlert')}
          </div>
        ),
        onClick: sendCriticalAlertMessage,
      },
    ];
  }, [sendCriticalAlertMessage]);

  const criticalAlertToastTimeout = useRef<NodeJS.Timeout | null>(null);

  const onClickToast = useMemoizedFn(async () => {
    try {
      await sendCriticalAlertMessage();
      messageApi.destroy();
    } catch (e: any) {
      console.log('onClickToast error', e);
    }
  });

  const showCriticalAlertToast = useMemoizedFn(() => {
    messageApi.open({
      icon: null,
      duration: 0,
      className: 'critical-alert-toast',
      style: {
        marginTop: 25,
      },
      content: (
        <div onClick={onClickToast} className="critical-alert-toast-content">
          <IconBulb color="var(--dst-color-function-error)" />
          <div className="toast-text-prefix">
            {i18n('sendCriticalAlert.toastPrefix')}
          </div>
          <div className="toast-text-suffix">
            {i18n('sendCriticalAlert.toastSuffix')}
          </div>
        </div>
      ),
    });
  });

  useEffect(() => {
    if (currentCall.criticalAlert) {
      if (room.remoteParticipants.size === 0) {
        setVisible(true);
        criticalAlertToastTimeout.current = setTimeout(
          showCriticalAlertToast,
          15 * 1000
        );
      } else {
        setVisible(false);
        if (criticalAlertToastTimeout.current) {
          clearTimeout(criticalAlertToastTimeout.current);
          criticalAlertToastTimeout.current = null;
        }
      }
    }
  }, [room.remoteParticipants.size]);

  return {
    visible,
    menuItems,
    criticalAlertToast,
  };
};
