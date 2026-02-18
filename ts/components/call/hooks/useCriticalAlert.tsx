import { useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { currentCall, callingAPI, callActionType } from '../initCall';
import { useMemoizedFn } from 'ahooks';
import { useAtomValue } from 'jotai';
import { inviteMembersAtom, roomAtom } from '../atoms/roomAtom';
import { Room } from '@cc-livekit/livekit-client';
import { LocalizerType } from '../../../types/Util';
import { Button, Flex, message, Modal } from 'antd';
import { IconBulb } from '../../shared/icons';
import { ConfigProvider } from '../../shared/ConfigProvider';
import { Contact } from './useInitials';
import { CommonTooltip } from '../../shared/CommonTooltip';

export const useCriticalAlert = ({
  room,
  i18n,
  addMessage,
  contactMap,
}: {
  room: Room;
  i18n: LocalizerType;
  addMessage: ({ identity, text }: { identity: string; text: string }) => void;
  contactMap: Map<string, Contact>;
}) => {
  const [visible, setVisible] = useState<boolean>(currentCall.criticalAlert);
  const roomInfo = useAtomValue(roomAtom);
  const [messageApi, criticalAlertToast] = message.useMessage();
  const firstShowToastRef = useRef(true);
  const inviteMembers = useAtomValue(inviteMembersAtom);

  const getDestinationIds = useMemoizedFn(() => {
    let destinationIds = Array.from(inviteMembers);
    if (currentCall.type !== 'group' && !currentCall.isPassive) {
      destinationIds.push(currentCall.number);
    }

    const remoteParticipantIds = Array.from(
      room.remoteParticipants.values()
    ).map(p => p.identity.split('.')[0]);

    destinationIds = destinationIds.filter(id => {
      return !remoteParticipantIds.includes(id);
    });

    return Array.from(new Set(destinationIds));
  });

  const confirmSendModal = useMemoizedFn(async () => {
    const { promise, resolve, reject } = Promise.withResolvers();

    const destinationIds = getDestinationIds();

    let content = '';

    let inveiteContent = '';

    inveiteContent = destinationIds
      .slice(0, 3)
      .reduce((acc, member) => {
        return acc + ',' + contactMap.get(member)?.getDisplayName();
      }, '')
      .slice(1);
    if (destinationIds.length > 3) {
      inveiteContent += i18n('criticalAlert.sendConfirm.inviteSuffix', [
        String(destinationIds.length - 3),
      ]);
    }

    if (roomInfo.type === 'instant') {
      content = `${i18n('criticalAlert.sendConfirm.contentPrefix.instant')} ${inveiteContent}`;
    } else if (roomInfo.type === 'group') {
      if (destinationIds.length === 0) {
        content = i18n('criticalAlert.sendConfirm.contentPrefix.group');
      } else {
        content = `${i18n('criticalAlert.sendConfirm.contentPrefix.groupWithInviteUsers')}(${inveiteContent})`;
      }
    }

    const modal = Modal.confirm({
      icon: null,
      width: 384,
      className: 'critical-alert-confirm-modal universal-modal',
      title: (
        <div>
          <span>{i18n('settings.criticalAlert')}</span>
          <span>
            <CommonTooltip
              rootClassName="critical-alert-confirm-tooltip"
              title={i18n('criticalAlert.sendConfirm.desc')}
            ></CommonTooltip>
          </span>
        </div>
      ),
      content: (
        <div className="critical-alert-confirm-modal-content">{content}</div>
      ),
      footer() {
        return (
          <ConfigProvider>
            <Flex gap={8}>
              <Button
                type="default"
                ghost
                onClick={() => {
                  modal.destroy();
                  reject(new Error('user canceled'));
                }}
                block
                className="critical-alert-confirm-modal-button"
              >
                {i18n('cancel')}
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  modal.destroy();
                  resolve('');
                }}
                block
                className="critical-alert-confirm-modal-button"
              >
                {i18n('send', [''])}
              </Button>
            </Flex>
          </ConfigProvider>
        );
      },
    });

    return promise;
  });

  const sendCriticalAlertMessage = useMemoizedFn(async () => {
    try {
      if (roomInfo.type !== '1on1') {
        await confirmSendModal();
      }
      const identity = room.localParticipant.identity;
      const baseTimestamp = Date.now();

      const data: {
        roomId: string;
        group?: {
          gid: string;
          timestamp: number;
        };
        destinations?: { number: string; timestamp: number }[];
      } = {
        roomId: currentCall.roomId,
        destinations: [],
      };

      if (currentCall.type === 'group') {
        data.group = {
          gid: currentCall.groupId,
          timestamp: baseTimestamp,
        };
      }

      const destinationIds = getDestinationIds();

      data.destinations = destinationIds.map((id, index) => {
        return {
          number: id,
          timestamp: baseTimestamp + index + 1,
        };
      });

      const response = await callingAPI.sendCriticalAlertNew(data);
      addMessage({ identity, text: i18n('sendCriticalAlert.success') });

      const delivers = response.data.delivers || [];

      const privateMessageDelivers = data.destinations.filter(destination => {
        return delivers.includes(destination.number);
      });

      (window as any).sendCallText({
        action: callActionType.CriticalAlert,
        serverTimestamp: response.serverTimestamp,
        type: currentCall.type,
        createCallMsg: true,
        version: 2,
        privateMessageDelivers,
        groupMessageDelivers: data.group ? [data.group] : [],
      });
    } catch (e: any) {
      console.log('sendCriticalAlertMessage error', e?.message);
      if (e.code) {
        message.error(
          e.code === 413
            ? i18n('sendCriticalAlert.rateLimitExceeded')
            : i18n('sendCriticalAlert.fail')
        );
      }
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
    if (!firstShowToastRef.current) {
      return;
    }
    firstShowToastRef.current = false;
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
          <CommonTooltip
            zIndex={10000}
            placement="bottom"
            rootClassName="critical-alert-confirm-tooltip"
            title={i18n('criticalAlert.sendConfirm.desc')}
          ></CommonTooltip>
        </div>
      ),
    });
  });

  const cancelCriticalAlertToast = useMemoizedFn(() => {
    if (criticalAlertToastTimeout.current) {
      clearTimeout(criticalAlertToastTimeout.current);
      criticalAlertToastTimeout.current = null;
    }
    messageApi.destroy();
  });

  useEffect(() => {
    if (currentCall.criticalAlert && currentCall.type === '1on1') {
      if (room.remoteParticipants.size === 0) {
        criticalAlertToastTimeout.current = setTimeout(
          showCriticalAlertToast,
          15 * 1000
        );
      } else {
        cancelCriticalAlertToast();
      }
    }
  }, [room.remoteParticipants.size]);

  useEffect(() => {
    if (currentCall.criticalAlert) {
      if (currentCall.type === '1on1') {
        setVisible(room.remoteParticipants.size === 0);
      } else if (currentCall.type === 'group') {
        setVisible(true);
      }
    }
    if (roomInfo.type === 'instant') {
      cancelCriticalAlertToast();
      setVisible(inviteMembers.size > 0);
    }
  }, [room.remoteParticipants.size, roomInfo.type, inviteMembers]);

  return {
    visible,
    setVisible,
    menuItems,
    criticalAlertToast,
  };
};
