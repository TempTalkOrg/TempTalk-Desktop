import React from 'react';
import { LocalizerType } from '../../types/Util';

export const LastSeenIndicator = ({
  unreadCount,
  i18n,
}: {
  unreadCount: number;
  i18n: LocalizerType;
}) => {
  return (
    <>
      <div className="module-last-seen-indicator__bar"></div>
      <div className="module-last-seen-indicator__text">
        {unreadCount === 1
          ? i18n('unreadMessage')
          : i18n('unreadMessages', [String(unreadCount)])}
      </div>
    </>
  );
};
