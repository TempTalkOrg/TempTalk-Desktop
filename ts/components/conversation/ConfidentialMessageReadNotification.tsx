import React, { useEffect, useRef } from 'react';
import { LocalizerType } from '../../types/Util';
import { useIsElementVisible } from '../../hooks/useIsElementVisible';

export const ConfidentialMessageReadNotification = ({
  onVisible,
  i18n,
}: {
  i18n: LocalizerType;
  onVisible: () => void;
}) => {
  const messageRootRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsElementVisible(messageRootRef.current);

  useEffect(() => {
    if (isVisible) {
      onVisible?.();
    }
  }, [isVisible]);

  return (
    <div className="module-system-notification-message" ref={messageRootRef}>
      {i18n('confidentialMessage.readByOthers')}
    </div>
  );
};
