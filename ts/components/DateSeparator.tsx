import React from 'react';
import { formatDateSeparator } from '../util/formatRelativeTime';
import { LocalizerType } from '../types/Util';

export const DateSeparator = ({
  timestamp,
  i18n,
}: {
  timestamp: number;
  i18n: LocalizerType;
}) => {
  return (
    <div className="date-separator">
      <div className="date-separator-inner">
        {formatDateSeparator(timestamp, { i18n })}
      </div>
    </div>
  );
};
