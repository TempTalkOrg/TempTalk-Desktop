import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import { immersiveModeAtom, immersiveModeTimerAtom } from '../atoms/roomAtom';

export const useImmersiveMode = () => {
  const [_, setImmersiveMode] = useAtom(immersiveModeAtom);
  const [immersiveModeTimer, setImmersiveModeTimer] = useAtom(
    immersiveModeTimerAtom
  );

  const enterImmersiveMode = useMemoizedFn((delay: number = 5000) => {
    setImmersiveModeTimer(
      setTimeout(() => {
        setImmersiveMode(true);
      }, delay)
    );
  });

  const exitImmersiveMode = useMemoizedFn(() => {
    setImmersiveMode(false);
    if (immersiveModeTimer) {
      clearTimeout(immersiveModeTimer);
      // setImmersiveModeTimer(null);
    }
    setImmersiveModeTimer(
      setTimeout(() => {
        setImmersiveMode(true);
      }, 5000)
    );
  });

  return {
    enterImmersiveMode,
    exitImmersiveMode,
  };
};
