import React, { FC } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';

interface IProps {
  visible: boolean;
  userInfo: {
    name: string;
    avatarPath: string;
    id: string;
  };
  i18n: LocalizerType;
  isPassive: boolean;
}

export const RemoteParticipantMask: FC<IProps> = ({
  visible,
  userInfo,
  isPassive,
  i18n,
}) => {
  if (!visible) {
    return null;
  }
  return createPortal(
    <div
      className="1on1-mask"
      style={{
        position: 'absolute',
        top: 40,
        left: 8,
        right: 8,
        bottom: 76,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--dst-color-background-elevate)',
        borderRadius: '0.5rem',
        flexFlow: 'column nowrap',
        gap: 8,
        zIndex: 4,
      }}
    >
      <Avatar
        i18n={i18n}
        conversationType="direct"
        size={80}
        id={userInfo.id}
        name={userInfo.name}
        avatarPath={userInfo.avatarPath}
        notShowStatus={true}
        noClickEvent={true}
      />
      <span
        style={{
          color: 'var(--dst-color-text-primary)',
          userSelect: 'none',
          fontSize: 12,
        }}
      >
        {isPassive
          ? i18n('call_voice_calling_waiting')
          : i18n('call_voice_calling')}
      </span>
    </div>,
    document.body
  );
};
