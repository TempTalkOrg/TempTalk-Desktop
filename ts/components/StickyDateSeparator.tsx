import React, { useEffect, useRef, useState } from 'react';
import { LocalizerType } from '../types/Util';
import { DateSeparator } from './DateSeparator';
import classNames from 'classnames';
import { useMemoizedFn } from 'ahooks';

export const StickyDateSeparator = ({
  timestamp,
  i18n,
  autoHideFlag,
  shouldShow,
}: {
  timestamp: number;
  i18n: LocalizerType;
  autoHideFlag?: boolean;
  shouldShow?: boolean;
}) => {
  const [autoHide, setAutoHide] = useState(false);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoHideTimeout = useMemoizedFn(() => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }
  });

  const startAutoHideTimeout = useMemoizedFn(() => {
    clearAutoHideTimeout();
    autoHideTimeoutRef.current = setTimeout(() => {
      setAutoHide(true);
    }, 3000);
  });

  useEffect(() => {
    if (shouldShow) {
      clearAutoHideTimeout();
      setAutoHide(false);
      return;
    }
    if (autoHideFlag) {
      startAutoHideTimeout();
    }
  }, [autoHideFlag, shouldShow]);

  return (
    <div
      className={classNames('sticky-date-wrapper', {
        'should-show': shouldShow,
        'auto-hide': autoHide,
      })}
    >
      <DateSeparator timestamp={timestamp} i18n={i18n} />
    </div>
  );
};
