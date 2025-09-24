import { useEffect, useMemo } from 'react';
import {
  callActionType,
  callControlType,
  callingAPI,
  currentCall,
} from '../initCall';
import { Room } from '@cc-livekit/livekit-client';
import { roomAtom } from '../atoms/roomAtom';
import { useMemoizedFn } from 'ahooks';
import { message } from 'antd';
import { getLogger, makeMessageCollapseId } from '../utils';
import { useSetAtom } from 'jotai';
import { formatInstantCallName } from '../../../util/formatInstantCallName';
import { CallRoomCipher } from '../types';
import { useGlobalConfig } from './useGlobalConfig';
import { useParticipants } from '../modules/react';

interface IProps {
  room: Room;
  roomCipher: CallRoomCipher;
  contactMap: Map<string, any>;
  onFinishAddMember?: () => void;
}

const logger = getLogger();

export const useAddMember = ({
  room,
  roomCipher,
  contactMap,
  onFinishAddMember,
}: IProps) => {
  const setRoomInfo = useSetAtom(roomAtom);
  const { createCallMsg } = useGlobalConfig();

  const participants = useParticipants({ room });
  const currentMembers = useMemo(() => {
    return participants.map((item: any) => item.identity.split('.')[0]);
  }, [participants]);

  const onAddMember = () => {
    (window as any).openAddCallMembers(currentCall.roomName, currentMembers);
  };

  const convertToInstantCall = () => {
    currentCall.type = 'instant';

    const caller = contactMap.get(currentCall.caller);
    const roomName = formatInstantCallName(caller);

    setRoomInfo(prev => ({ ...prev, type: 'instant', roomName }));
    logger.info('convert 1on1 to instant', currentCall.roomId);
    (window as any).addJoinCallButton({
      ...currentCall,
      prev1on1Numebr: currentCall.isPassive
        ? currentCall.caller
        : currentCall.number,
    });
    onFinishAddMember?.();
  };

  const handleInviteCallMembers = useMemoizedFn(
    async (_, { members }: { members: string[] }) => {
      try {
        const callees = [...members];

        let roomName;
        if (currentCall.type === 'group') {
          roomName = currentCall.roomName;
        } else {
          // 1on1 => instant, instant invite
          roomName = `${currentCall.ourName}'s instant call`;
        }

        const timestamp = Date.now();

        const options = {
          callees,
          roomId: currentCall.roomId,
          conversationId: {
            number: currentCall.number,
            groupId: currentCall.groupId,
          },
          caller: currentCall.ourNumber,
          version: 10,
          collapseId: makeMessageCollapseId(
            currentCall.ourNumber,
            currentCall.deviceId,
            timestamp
          ),
          roomName,
          timestamp,
          controlType: callControlType.InviteMembers,
          createCallMsg,
        };

        const { systemShowTimestamp: serverTimestamp } =
          await callingAPI.inviteCall(options, roomCipher);

        (window as any).sendCallText({
          action: callActionType.InviteMembers,
          conversationIds: [...members],
          createCallMsg,
          timestamp,
          serverTimestamp,
        });

        // 邀请发送后直接转为 instant
        if (currentCall.type === '1on1') {
          convertToInstantCall();
        }
      } catch (e: any) {
        message.error(e?.response?.reason);
      }
    }
  );

  useEffect(() => {
    const cleanup = (window as any).registerInviteCallMembersHandler(
      handleInviteCallMembers
    );

    return () => cleanup();
  }, []);

  return {
    onAddMember,
    convertToInstantCall,
  };
};
