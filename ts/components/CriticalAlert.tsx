import Button from 'antd/lib/button';
import React, { useEffect, useMemo } from 'react';
import { IconBulb, IconClose } from './shared/icons';
import { useTheme } from './call/hooks/useTheme';
import { LocalizerType } from '../types/Util';
import { useMemoizedFn } from 'ahooks';
import playAudio from './call/PlayAudio';

type PropsType = {
  conversationId: string;
  from: string;
  i18n: LocalizerType;
  title: string;
  isPrivate: boolean;
};

export const CriticalAlert = ({
  conversationId,
  from,
  i18n,
  title,
  isPrivate,
}: PropsType) => {
  useTheme();

  const onClick = useMemoizedFn(() => {
    (window as any).connectConversation(conversationId);
  });

  useEffect(() => {
    playAudio('critical-alert');
  }, []);

  const content = useMemo(() => {
    return i18n(
      `criticalAlert.${isPrivate ? 'privateContent' : 'nonPrivateContent'}`,
      [from]
    );
  }, [isPrivate, from]);

  return (
    <div className="critical-alert-container">
      <IconClose
        className="critical-alert-close-icon"
        onClick={() => (window as any).closeWindow()}
      />
      <div className="critical-alert-icon-wrapper">
        <IconBulb
          color="var(--dst-color-text-white)"
          className="critical-alert-icon"
        />
      </div>
      <div className="critical-alert-info-wrapper">
        <div className="critical-alert-info-title">{title}</div>
        <div className="critical-alert-info-content">{content}</div>
      </div>
      <Button
        type="primary"
        className="critical-alert-connect-button"
        onClick={onClick}
      >
        {i18n('join')}
      </Button>
    </div>
  );
};
