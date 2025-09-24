import React, { useState } from 'react';
import { Button, Modal } from 'antd';
import { Room } from '@cc-livekit/livekit-client';
import { useEffect, useMemo, useRef } from 'react';
import { LocalizerType } from '../../../types/Util';
import type { ModalFunc } from 'antd/es/modal/confirm';
import { useMemoizedFn } from 'ahooks';
import { get } from 'lodash';
import { useParticipants } from '../modules/react';

interface IProps {
  room: Room;
  onExit?: () => void;
  onContinue?: () => void;
  i18n: LocalizerType;
}

enum ReminderModalType {
  ALL_MEMBER_SILENCE = 'allMemberSilence',
  NO_REMOTE_MEMBER = 'noRemoteMember',
}

type AutoLeaveConfig = {
  silenceTimeout: number;
  soloMemberTimeout: number;
  runAfterReminderTimeout: number;
};

export const useAutoLeaveCall = ({
  room,
  i18n,
  onExit,
  onContinue,
}: IProps) => {
  const participants = useParticipants({ room });
  const reminderModalRef = useRef<ReturnType<ModalFunc>>();
  const allMemberSilenceReminderTimeoutRef = useRef<NodeJS.Timeout>();
  const noRemoteMemberReminderTimeoutRef = useRef<NodeJS.Timeout>();
  const leftTimeRef = useRef(0);
  const updateModalInterval = useRef<NodeJS.Timeout>();
  const [autoLeaveConfig, setAutoLeaveConfig] =
    useState<AutoLeaveConfig | null>(null);

  const reminderTitle = useMemo(() => {
    return {
      [ReminderModalType.ALL_MEMBER_SILENCE]: i18n(
        'call.allMemberSilenceReminder'
      ),
      [ReminderModalType.NO_REMOTE_MEMBER]: i18n('call.noRemoteMemberReminder'),
    };
  }, []);

  const allMemberSilence = useMemo(() => {
    return participants.every(p => !p.isSpeaking);
  }, [participants]);

  const continueCall = useMemoizedFn(() => {
    if (reminderModalRef.current) {
      reminderModalRef.current.destroy();
      reminderModalRef.current = undefined;
    }
    if (updateModalInterval.current) {
      clearInterval(updateModalInterval.current);
    }

    // restart check timer
    if (allMemberSilence) {
      prepareAllMemberSilenceReminder();
    }

    if (room.numParticipants === 1) {
      prepareNoRemoteMemberReminder();
    }

    onContinue?.();
  });

  const prepareReminderModal = useMemoizedFn((type: ReminderModalType) => {
    if (!autoLeaveConfig) {
      return;
    }
    // 已触发其中一种 case 无需再触发另一种
    if (reminderModalRef.current) {
      return;
    } else {
      leftTimeRef.current = autoLeaveConfig.runAfterReminderTimeout / 1000;
      reminderModalRef.current = Modal.warning({
        className: 'auto-exit-reminder-modal',
        title: reminderTitle[type],
        content: (
          <div>{i18n('call.timeLeft', [String(leftTimeRef.current)])}</div>
        ),
        footer() {
          return (
            <>
              <Button type="primary" danger onClick={onExit}>
                {i18n('leave')}
              </Button>
              <Button type="primary" onClick={continueCall}>
                {i18n('continue')}
              </Button>
            </>
          );
        },
      });

      updateModalInterval.current = setInterval(() => {
        if (reminderModalRef.current) {
          leftTimeRef.current--;
          if (leftTimeRef.current === 0) {
            onExit?.();
          }
          reminderModalRef.current.update({
            content: (
              <div>
                <div>
                  {i18n('call.timeLeft', [String(leftTimeRef.current)])}
                </div>
              </div>
            ),
          });
        } else {
          clearInterval(updateModalInterval.current);
        }
      }, 1000);
    }
  });

  const prepareAllMemberSilenceReminder = useMemoizedFn(() => {
    if (allMemberSilenceReminderTimeoutRef.current) {
      clearTimeout(allMemberSilenceReminderTimeoutRef.current);
      allMemberSilenceReminderTimeoutRef.current = undefined;
    }
    allMemberSilenceReminderTimeoutRef.current = setTimeout(() => {
      prepareReminderModal(ReminderModalType.ALL_MEMBER_SILENCE);
    }, autoLeaveConfig?.silenceTimeout);
  });

  const prepareNoRemoteMemberReminder = () => {
    if (noRemoteMemberReminderTimeoutRef.current) {
      clearTimeout(noRemoteMemberReminderTimeoutRef.current);
      noRemoteMemberReminderTimeoutRef.current = undefined;
    }
    noRemoteMemberReminderTimeoutRef.current = setTimeout(() => {
      prepareReminderModal(ReminderModalType.NO_REMOTE_MEMBER);
    }, autoLeaveConfig?.soloMemberTimeout);
  };

  useEffect(() => {
    if (!autoLeaveConfig) {
      return;
    }

    if (allMemberSilence) {
      prepareAllMemberSilenceReminder();
    } else {
      if (allMemberSilenceReminderTimeoutRef.current) {
        clearTimeout(allMemberSilenceReminderTimeoutRef.current);
        allMemberSilenceReminderTimeoutRef.current = undefined;
      }
      if (reminderModalRef.current) {
        reminderModalRef.current.destroy();
        reminderModalRef.current = undefined;
      }
    }
  }, [allMemberSilence, autoLeaveConfig]);

  useEffect(() => {
    if (!autoLeaveConfig) {
      return;
    }

    if (room.numParticipants === 1) {
      prepareNoRemoteMemberReminder();
    } else if (room.numParticipants > 1) {
      if (noRemoteMemberReminderTimeoutRef.current) {
        clearTimeout(noRemoteMemberReminderTimeoutRef.current);
      }
      if (reminderModalRef.current) {
        reminderModalRef.current.destroy();
        reminderModalRef.current = undefined;
      }
    }
  }, [room.numParticipants, autoLeaveConfig]);

  const initAutoLeaveConfig = useMemoizedFn(async () => {
    try {
      const globalConfig = await (window as any).getGlobalConfig();

      const silenceTimeout = get(
        globalConfig,
        'call.autoLeave.promptReminder.silenceTimeout',
        5 * 60 * 1000
      );
      const soloMemberTimeout = get(
        globalConfig,
        'call.autoLeave.promptReminder.soloMemberTimeout',
        5 * 60 * 1000
      );
      const runAfterReminderTimeout = get(
        globalConfig,
        'call.autoLeave.runAfterReminderTimeout',
        3 * 60 * 1000
      );

      setAutoLeaveConfig({
        silenceTimeout,
        soloMemberTimeout,
        runAfterReminderTimeout,
      });
    } catch (e) {
      console.log('get auto leave config error', e);
    }
  });

  useEffect(() => {
    initAutoLeaveConfig();
  }, []);

  return {
    continueCall,
  };
};
