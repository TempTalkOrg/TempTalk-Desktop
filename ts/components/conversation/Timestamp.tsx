import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { formatRelativeTime, formatTime } from '../../util/formatRelativeTime';

import { LocalizerType } from '../../types/Util';

interface Props {
  timestamp?: number;
  extended?: boolean;
  module?: string;
  withImageNoCaption?: boolean;
  direction?: 'incoming' | 'outgoing';
  i18n: LocalizerType;
  relativeTime?: boolean;
  short?: boolean;
}

const useForceRerender = () => {
  const [, setValue] = useState(0);
  return () => setValue(value => value + 1);
};

const useIsElementVisible = (target: Element | null, options = undefined) => {
  const [isVisible, setIsVisible] = useState(false);
  const forceUpdate = useForceRerender();

  useEffect(() => {
    forceUpdate();
  }, []);

  useEffect(() => {
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => setIsVisible(!!entries?.[0].isIntersecting),
      options
    );
    observer.observe(target);

    return () => observer.unobserve(target);
  }, [target, options]);

  return isVisible;
};

const UPDATE_FREQUENCY = 60 * 1000;

export function Timestamp(props: Props) {
  const {
    timestamp,
    direction,
    module,
    withImageNoCaption,
    i18n,
    extended,
    relativeTime = true,
    short,
  } = props;

  const isValidTimestamp = !(timestamp === null || timestamp === undefined);

  const getTitle = () =>
    isValidTimestamp ? moment(timestamp).format('llll') : '';

  const getText = () =>
    isValidTimestamp
      ? relativeTime
        ? formatRelativeTime(timestamp, { i18n, extended })
        : formatTime(timestamp, { i18n, is24Hour: false, extended, short })
      : '';

  const getClassName = () => {
    const moduleName = module || 'module-timestamp';
    return classNames(
      moduleName,
      direction ? `${moduleName}--${direction}` : null,
      withImageNoCaption ? `${moduleName}--with-image-no-caption` : null
    );
  };

  const bodyRef = useRef<HTMLSpanElement>(null);

  const [title, setTitle] = useState(getTitle);
  const [text, setText] = useState(getText);
  const [className, setClassName] = useState(getClassName);

  const isVisible = useIsElementVisible(bodyRef?.current);

  useEffect(() => {
    const update = () => setText(getText());

    setTitle(getTitle());
    update();

    let timeout: NodeJS.Timeout | undefined;
    let interval: NodeJS.Timeout | undefined;

    if (isValidTimestamp && isVisible) {
      timeout = setTimeout(
        () => {
          interval = setInterval(update, UPDATE_FREQUENCY);
        },
        (Date.now() - timestamp) % UPDATE_FREQUENCY
      );
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };
  }, [timestamp, isVisible]);

  useEffect(() => {
    setClassName(getClassName());
  }, [module, withImageNoCaption, direction]);

  if (!isValidTimestamp) {
    return null;
  }

  return (
    <span ref={bodyRef} className={className} title={title}>
      {text}
    </span>
  );
}
