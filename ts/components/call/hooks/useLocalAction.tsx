import React from 'react';
import { useMemoizedFn } from 'ahooks';
import { getLogger, makeMessageCollapseId } from '../utils';
import { ConnectionState, Room } from '@cc-livekit/livekit-client';
import { callingAPI, currentCall } from '../initCall';
import { MutableRefObject, useEffect, useRef } from 'react';
import { CallRoomCipher } from '../types';
import { Button, Modal } from 'antd';
import { LocalizerType } from '../../../types/Util';
import { ModalFunc } from 'antd/es/modal/confirm';
import { uniq } from 'lodash';
const logger = getLogger();

interface IProps {
  room: Room;
  manualHangupRef: MutableRefObject<boolean>;
  roomCipher: CallRoomCipher;
  onFinishHangup: () => void;
  onFinishEndCall: () => void;
  onLeaveCall: () => void;
  onEndingCall: () => void;
  i18n: LocalizerType;
}

export const useLocalAction = ({
  room,
  manualHangupRef,
  roomCipher,
  onFinishHangup,
  onFinishEndCall,
  onLeaveCall,
  onEndingCall,
  i18n,
}: IProps) => {
  const doHangup = useMemoizedFn(async () => {
    let callees;

    if (currentCall.type === '1on1') {
      callees = [
        currentCall.isPassive ? currentCall.caller : currentCall.number,
      ];
    } else {
      const groupMembers =
        currentCall.type === 'group'
          ? await (window as any).getGroupMembers(currentCall.groupId)
          : [];

      callees = uniq(
        Array.from(room.remoteParticipants.values())
          .map(p => p.identity.split('.')[0])
          .concat(groupMembers)
      );
    }

    try {
      const needSync = currentCall.endingCall || currentCall.type === '1on1';

      // sync other device to end call
      if (needSync) {
        onEndingCall?.();
      }

      const options = {
        roomId: currentCall.roomId,
        collapseId: makeMessageCollapseId(
          currentCall.ourNumber,
          currentCall.deviceId
        ),
        callees,
        ourNumber: currentCall.ourNumber,
        needSync,
        type: currentCall.type,
      };
      await callingAPI.hangupCall(options, roomCipher);
    } catch (e) {
      logger.info('send hangup error', e);
    }
  });

  // 主动离会
  const onHangup = useMemoizedFn(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    manualHangupRef.current = true;
    if (currentCall.type === '1on1') {
      // 主叫 + 远端未入会，发 cancel
      if (!currentCall.isPassive && room.remoteParticipants.size === 0) {
        try {
          const options = {
            roomId: currentCall.roomId,
            collapseId: makeMessageCollapseId(
              currentCall.ourNumber,
              currentCall.deviceId
            ),
            callees: [currentCall.number, currentCall.ourNumber],
            type: currentCall.type,
          };

          await callingAPI.cancelCall(options, roomCipher);

          logger.info('cancel sent, roomId:', currentCall.roomId);
        } catch (e) {
          logger.info('send cancel error', e, 'roomId', currentCall.roomId);
        }
        return onFinishHangup?.();
      }
      if (room.remoteParticipants.size > 0) {
        await doHangup();
      }
    }
    onFinishHangup?.();
  });

  const endCallConfirmModalRef = useRef<ReturnType<ModalFunc>>();

  const doEndCall = useMemoizedFn(async () => {
    currentCall.endingCall = true;
    await doHangup();
    onFinishEndCall?.();
  });

  const cancelEndCall = useMemoizedFn(() => {
    endCallConfirmModalRef.current?.destroy();
  });

  const leaveCall = useMemoizedFn(async () => {
    onLeaveCall?.();
  });

  const onEndCall = useMemoizedFn(async () => {
    if (currentCall.type !== '1on1') {
      try {
        endCallConfirmModalRef.current = Modal.warning({
          className: 'force-end-reminder-modal',
          content: i18n('call.confirmEndCall'),
          title: i18n('call.confirmEndCallTitle'),
          icon: null,
          footer() {
            return (
              <>
                <Button type="default" ghost onClick={cancelEndCall}>
                  {i18n('cancel')}
                </Button>
                <Button type="default" ghost danger onClick={leaveCall}>
                  {i18n('call.leave')}
                </Button>
                <Button type="primary" danger onClick={doEndCall}>
                  {i18n('call.end')}
                </Button>
              </>
            );
          },
        });
      } catch (e) {
        console.log(e);
      }
    }
  });

  const sentJoinedRef = useRef(false);
  const sendJoined = useMemoizedFn(async () => {
    if (sentJoinedRef.current === true) {
      return;
    }
    logger.info(
      'send joined',
      currentCall.type,
      'isPassive',
      currentCall.isPassive,
      'roomId',
      currentCall.roomId
    );
    // sync joined to others device
    const options = {
      roomId: currentCall.roomId,
      ourNumber: currentCall.ourNumber,
    };

    await callingAPI.syncJoinedCall(options, roomCipher);

    sentJoinedRef.current = true;
  });

  useEffect(() => {
    if (room.state === ConnectionState.Connected && currentCall.isPassive) {
      sendJoined();
    }
  }, [room.remoteParticipants.size, room.state]);

  return {
    onHangup,
    onEndCall,
  };
};
