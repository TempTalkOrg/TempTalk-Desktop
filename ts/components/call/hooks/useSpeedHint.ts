import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { Contact } from './useInitials';
import { Room } from '@cc-livekit/livekit-client';

export const useSpeedHint = ({
  contactMap,
  handleSendSpeedHint,
  room,
}: {
  contactMap: Map<string, Contact>;
  handleSendSpeedHint: (action: 'slower' | 'faster') => Promise<void>;
  room: Room;
}) => {
  const [speedHints, setSpeedHints] = useState<{
    slower: Contact | null;
    faster: Contact | null;
  }>({ slower: null, faster: null });
  const speedHintTimeoutRef = useRef<{
    slower: NodeJS.Timeout | null;
    faster: NodeJS.Timeout | null;
  }>({ slower: null, faster: null });

  const addSpeedHint = useMemoizedFn(
    ({
      action,
      contact,
    }: {
      action: 'slower' | 'faster';
      contact: Contact | null;
    }) => {
      if (speedHintTimeoutRef.current[action]) {
        clearTimeout(speedHintTimeoutRef.current[action]);
      }
      speedHintTimeoutRef.current[action] = setTimeout(() => {
        setSpeedHints(prev => ({
          ...prev,
          [action]: null,
        }));
        speedHintTimeoutRef.current[action] = null;
      }, 1000 * 10);

      setSpeedHints(prev => ({
        ...prev,
        [action]: contact,
      }));
    }
  );

  const onSendSpeedHint = useMemoizedFn(async (action: 'slower' | 'faster') => {
    try {
      await handleSendSpeedHint?.(action);
      addSpeedHint({
        action,
        contact:
          contactMap.get(room.localParticipant.identity.split('.')[0]) || null,
      });
    } catch (error) {
      console.error('handleSendSpeedHint error', error);
    }
  });

  useEffect(() => {
    return () => {
      if (speedHintTimeoutRef.current.slower) {
        clearTimeout(speedHintTimeoutRef.current.slower);
        speedHintTimeoutRef.current.slower = null;
      }
      if (speedHintTimeoutRef.current.faster) {
        clearTimeout(speedHintTimeoutRef.current.faster);
        speedHintTimeoutRef.current.faster = null;
      }
    };
  }, []);

  return { speedHints, onSendSpeedHint, addSpeedHint };
};
