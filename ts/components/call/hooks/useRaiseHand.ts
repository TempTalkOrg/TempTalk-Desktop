import { useMemoizedFn } from 'ahooks';
import { useState } from 'react';
import { RaiseHandResponseMessageType } from './useRTMMessage';
import { Contact } from './useInitials';

interface IProps {
  handleRaiseHand: () => Promise<void>;
  handleCancelHand: (identities: string[]) => Promise<void>;
  contactMap: Map<string, Contact>;
}

export const useRaiseHand = ({
  handleRaiseHand,
  handleCancelHand,
  contactMap,
}: IProps) => {
  const [raiseHandList, setRaiseHandList] = useState<
    { identity: string; ts: number; displayName: string }[]
  >([]);

  const raiseHand = useMemoizedFn(async () => {
    try {
      await handleRaiseHand();
    } catch (error) {
      console.log('hand up error', error);
    }
  });

  const cancelHand = useMemoizedFn(async (identities: string[]) => {
    try {
      await handleCancelHand(identities);
    } catch (error) {
      console.log('hand down error', error);
    }
  });

  const handleRaiseHandMessage = useMemoizedFn(
    (raiseHandMessage: RaiseHandResponseMessageType) => {
      const sortedList = (raiseHandMessage.hands ?? []).sort(
        (a, b) => a.ts - b.ts
      );
      setRaiseHandList(
        sortedList.map(item => ({
          ...item,
          displayName:
            contactMap.get(item.identity.split('.')[0])?.getDisplayName() ?? '',
        }))
      );
    }
  );

  const onRaiseHandMessage = useMemoizedFn(
    (raiseHandMessage: RaiseHandResponseMessageType) => {
      handleRaiseHandMessage(raiseHandMessage);
    }
  );

  const onCancelHandMessage = useMemoizedFn(
    (cancelHandMessage: RaiseHandResponseMessageType) => {
      handleRaiseHandMessage(cancelHandMessage);
    }
  );

  return {
    raiseHand,
    cancelHand,
    raiseHandList,
    onRaiseHandMessage,
    onCancelHandMessage,
  };
};
