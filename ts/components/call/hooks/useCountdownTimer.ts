import { useEffect, useRef } from 'react';
import { ICountdownTimerRef } from '../CountdownTimer';
import { useMemoizedFn } from 'ahooks';
import { CountdownResponseMessageType } from './useRTMMessage';

interface IProps {
  handleSetCountdown: (minutes: number) => Promise<void>;
  handleExtendCountdown: (minutes: number) => Promise<void>;
  handleClearCountdown: () => Promise<void>;
  handleRestartCountdown: () => Promise<void>;
}

export const useCountdownTimer = ({
  handleSetCountdown,
  handleExtendCountdown,
  handleClearCountdown,
  handleRestartCountdown,
}: IProps) => {
  const countdownTimerRef = useRef<ICountdownTimerRef>(null);

  const onSetCountdown = useMemoizedFn(async (minutes: number) => {
    try {
      await handleSetCountdown(minutes);
    } catch (e) {
      console.log('onSetCountdown error', e);
    }
  });

  const onExtendCountdown = useMemoizedFn(async (minutes: number) => {
    try {
      await handleExtendCountdown(minutes);
    } catch (e) {
      console.log('onExtendCountdown error', e);
    }
  });

  const onClearCountdown = useMemoizedFn(async () => {
    try {
      await handleClearCountdown();
    } catch (e) {
      console.log('onEndCountdown error', e);
    }
  });

  const onRestartCountdown = useMemoizedFn(async () => {
    try {
      await handleRestartCountdown();
    } catch (e) {
      console.log('onRestartCountdown error', e);
    }
  });

  const updateFloatingbarCountdown = useMemoizedFn(
    (countdownResponseMessage: CountdownResponseMessageType | null) => {
      (window as any).updateFloatingBar({
        countdown: countdownResponseMessage,
      });
    }
  );

  const onSetCountdownMessage = (
    setCountdownMessage: CountdownResponseMessageType
  ) => {
    countdownTimerRef.current?.setCountdown(setCountdownMessage);
    updateFloatingbarCountdown(setCountdownMessage);
  };

  const onExtendCountdownMessage = (
    extendCountdownMessage: CountdownResponseMessageType
  ) => {
    countdownTimerRef.current?.extendCountdown(extendCountdownMessage);
    updateFloatingbarCountdown(extendCountdownMessage);
  };

  const onRestartCountdownMessage = (
    restartCountdownMessage: CountdownResponseMessageType
  ) => {
    countdownTimerRef.current?.restartCountdown(restartCountdownMessage);
    updateFloatingbarCountdown(restartCountdownMessage);
  };

  const onClearCountdownMessage = () => {
    countdownTimerRef.current?.clearCountdown();
    updateFloatingbarCountdown(null);
  };

  const openCountdownTimerPopup = useMemoizedFn(() => {
    countdownTimerRef.current?.openOperationPopup();
  });

  useEffect(() => {
    const cleanup = (window as any).registerOpenCountdownTimerPopupHandler(
      openCountdownTimerPopup
    );
    return () => {
      cleanup();
    };
  }, []);

  return {
    countdownTimerRef,
    // component props
    onSetCountdown,
    onExtendCountdown,
    onClearCountdown,
    onRestartCountdown,
    // rtm message handlers
    onSetCountdownMessage,
    onExtendCountdownMessage,
    onRestartCountdownMessage,
    onClearCountdownMessage,
  };
};
