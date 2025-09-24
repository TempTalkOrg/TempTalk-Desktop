import React, { useMemo } from 'react';
import { IconArrowDown } from '../shared/icons';

export const ScrollDownButton = ({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) => {
  const buttonClass = useMemo(
    () => (count > 0 ? 'module-scroll-down__button--new-messages' : ''),
    [count]
  );

  return (
    <button
      className={`text module-scroll-down__button ${buttonClass}`}
      onClick={onClick}
    >
      <IconArrowDown className="module-scroll-down__icon"></IconArrowDown>
    </button>
  );
};
