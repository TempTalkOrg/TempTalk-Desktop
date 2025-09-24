import { useMemoizedFn } from 'ahooks';
import { useEffect } from 'react';
import { currentCall } from '../initCall';

interface IProps {
  onRemoteReject: () => void;
  i18n: (key: string) => string;
}

export const useRemoteAction = ({ onRemoteReject }: IProps) => {
  const handleRejectCallByCallee = useMemoizedFn((_, roomId) => {
    if (currentCall.type !== '1on1') {
      return;
    }
    if (currentCall.roomId && roomId === currentCall.roomId) {
      onRemoteReject?.();
    }
  });

  useEffect(() => {
    const cleanup = (window as any).registerRejectByCalleeHandler(
      handleRejectCallByCallee
    );

    return () => cleanup();
  }, []);
};
