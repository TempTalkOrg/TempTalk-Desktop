import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { CallRoom } from './CallRoom';
import { CallInfoType, currentCall, generateCurrentCall } from './initCall';
import { useMemoizedFn } from 'ahooks';

export const CallRoot = ({
  i18n,
}: {
  i18n: LocalizerType & { getLocale: () => string };
}) => {
  const [callStart, setCallStart] = useState(false);

  const onStartCall = useMemoizedFn((_, info: CallInfoType) => {
    Object.assign(currentCall, generateCurrentCall(info));
    setCallStart(true);
  });

  useEffect(() => {
    const cleanup = (window as any).registerStartCallHandler(onStartCall);

    return () => cleanup();
  }, []);

  if (!callStart) {
    return null;
  }

  return <CallRoom i18n={i18n} />;
};
