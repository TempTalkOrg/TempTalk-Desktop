import { useMemoizedFn } from 'ahooks';
import { useEffect } from 'react';
import { getLogger } from '../utils';
import { currentCall } from '../initCall';

interface IPageEventHandler {
  onBeforeUnload?: () => void;
}

const logger = getLogger();

export const usePageEvent = ({ onBeforeUnload }: IPageEventHandler) => {
  const _onBeforeUnload = useMemoizedFn((event: BeforeUnloadEvent) => {
    logger.info('on before unload', currentCall.roomId);
    event.preventDefault();

    (window as any).removeEventListener('beforeunload', _onBeforeUnload);
    onBeforeUnload?.();
  });

  useEffect(() => {
    (window as any).addEventListener('beforeunload', _onBeforeUnload);

    return () => {
      (window as any).removeEventListener('beforeunload', _onBeforeUnload);
    };
  }, []);
};
