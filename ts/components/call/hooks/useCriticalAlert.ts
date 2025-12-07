import { useEffect, useMemo, useState } from 'react';
import { currentCall, callingAPI } from '../initCall';
import { useMemoizedFn } from 'ahooks';
import { useAtomValue } from 'jotai';
import { roomAtom } from '../atoms/roomAtom';
import { Room } from '@cc-livekit/livekit-client';
import { LocalizerType } from '../../../types/Util';

export const useCriticalAlert = ({
  room,
  i18n,
  addMessage,
}: {
  room: Room;
  i18n: LocalizerType;
  addMessage: ({ identity, text }: { identity: string; text: string }) => void;
}) => {
  const [visible, setVisible] = useState<boolean>(currentCall.type === '1on1');
  const roomInfo = useAtomValue(roomAtom);

  const sendCriticalAlertMessage = useMemoizedFn(async () => {
    if (roomInfo.type !== '1on1') {
      return;
    }
    const identity = room.localParticipant.identity;
    try {
      await callingAPI.sendCriticalAlert({ destination: currentCall.number });
      addMessage({ identity, text: i18n('sendCriticalAlert.success') });
    } catch (e) {
      console.log('sendCriticalAlertMessage error', e);
      addMessage({ identity, text: i18n('sendCriticalAlert.fail') });
    }
  });

  const menuItems = useMemo(() => {
    return [
      {
        key: 'send-critical-alert',
        label: i18n('sendCriticalAlert'),
        onClick: sendCriticalAlertMessage,
      },
    ];
  }, [sendCriticalAlertMessage]);

  useEffect(() => {
    setVisible(
      !!roomInfo.type &&
        roomInfo.type === '1on1' &&
        room.remoteParticipants.size === 0
    );
  }, [roomInfo.type, room.remoteParticipants.size]);

  return {
    visible,
    menuItems,
  };
};
