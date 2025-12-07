import React from 'react';
import { MessageMode, MessageModeButton } from '../MessageModeButton';
import { LocalizerType } from '../../../types/Util';

export interface MessageModeWrapperProps {
  i18n: LocalizerType;
  onChangeMessageMode: (mode: MessageMode) => void;
  mode: MessageMode;
  visible: boolean;
}

export const MessageModeWrapper = ({
  i18n,
  onChangeMessageMode,
  mode,
  visible,
}: MessageModeWrapperProps) => {
  if (!visible) {
    return null;
  }

  return (
    <MessageModeButton
      i18n={i18n}
      onChangeMessageMode={onChangeMessageMode}
      mode={mode}
    />
  );
};
