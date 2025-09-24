import { useAtom } from 'jotai';
import { globalConfigAtom } from '../atoms/globalConfigAtom';
import { useEffect } from 'react';
import { useMemoizedFn } from 'ahooks';
import { get } from 'lodash';

export const useGlobalConfig = () => {
  const [globalConfig, setGlobalConfig] = useAtom(globalConfigAtom);

  const initGlobalConfig = useMemoizedFn(async () => {
    const globalConfig = await (window as any).getGlobalConfig();
    const callConfig = get(globalConfig, 'call');
    if (callConfig) {
      callConfig.createCallMsg = callConfig.createCallMsg ?? false;
      setGlobalConfig(initialConfig => ({
        ...initialConfig,
        ...callConfig,
      }));
    }
  });

  useEffect(() => {
    initGlobalConfig();
  }, []);

  return globalConfig;
};
