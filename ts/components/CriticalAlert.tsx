import Button from 'antd/lib/button';
import React, { useEffect } from 'react';
import { IconBulb } from './shared/icons';
import { useTheme } from './call/hooks/useTheme';
import { LocalizerType } from '../types/Util';
import { useMemoizedFn } from 'ahooks';
import playAudio from './call/PlayAudio';

type PropsType = {
  conversationId: string;
  from: string;
  i18n: LocalizerType;
};

export const CriticalAlert = ({ conversationId, from, i18n }: PropsType) => {
  useTheme();

  const onClick = useMemoizedFn(() => {
    (window as any).connectConversation(conversationId);
  });

  useEffect(() => {
    playAudio('critical-alert');
  }, []);

  return (
    <div className="critical-alert-container">
      <div className="critical-alert-icon-wrapper">
        <IconBulb
          color="var(--dst-color-text-white)"
          className="critical-alert-icon"
        />
      </div>
      <div className="critical-alert-info">
        <div className="critical-alert-info-title">{i18n('urgentCall')}</div>
        <div className="critical-alert-info-content">
          {i18n('from')} {from}
        </div>
      </div>
      <Button
        type="primary"
        className="critical-alert-connect-button"
        onClick={onClick}
      >
        {i18n('connectNow')}
      </Button>
    </div>
  );
};
