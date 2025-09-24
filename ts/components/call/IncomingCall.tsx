import React from 'react';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import {
  IconIncomingCallAccept,
  IconIncomingCallReject,
} from '../shared/icons';
import { useIncomingCall } from './hooks/useIncomingCall';
import { useTheme } from './hooks/useTheme';

export const IncomingCall = ({ i18n }: { i18n: LocalizerType }) => {
  useTheme();

  const {
    onReject,
    onAccept,
    name,
    inviteName,
    avatarPath,
    renderDefaultAvatar,
  } = useIncomingCall({
    i18n,
  });

  return (
    <div className="incoming-call-container">
      <div className="caller-avatar">
        <Avatar
          avatarPath={avatarPath}
          i18n={i18n}
          size={36}
          conversationType={renderDefaultAvatar ? 'group' : 'direct'}
          name={name}
          noClickEvent={true}
        />
      </div>
      <div className="caller-name">{name}</div>
      <div className="call-invite-text">
        {inviteName && <span className="call-invite-name">{inviteName}</span>}
        <span>{i18n('incomingCallInvite')}</span>
      </div>
      <div className="call-operations">
        <div className="call-operation-button reject-button" onClick={onReject}>
          <IconIncomingCallReject />
        </div>
        <div className="call-operation-button accept-button" onClick={onAccept}>
          <IconIncomingCallAccept />
        </div>
      </div>
    </div>
  );
};
