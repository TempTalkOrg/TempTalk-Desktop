import React from 'react';

import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { Tooltip } from 'antd';
import { simplifySeconds } from '../../util/formatRelativeTime';
import { isBot } from '../../shims/Whisper';
import { IconWrapper } from '../shared/IconWrapper';
import { IconOfficialAccount } from '../shared/icons';

interface Props {
  id: string;
  name?: string;
  accountName?: string;

  profileName?: string;
  color: string;
  avatarPath?: string;

  isMe: boolean;
  isMeLeftGroup: boolean;
  isGroup: boolean;
  isGroupV2: boolean;
  isGroupV2Owner: boolean;
  isGroupV2Admin: boolean;
  groupMembersCount?: number;
  isDirectoryUser?: boolean;
  isOfficialAccount: boolean;

  expireTimer?: number;

  showBackButton: boolean;

  onGoBack: () => void;

  onGroupV2AddMembers: () => void;

  i18n: LocalizerType;
  headerTitle?: string;
  onOpenSetting: () => void;
  invitationRule?: number; // 邀请其他人入群规则 2:全员允许（默认），1:管理员和群主、0:群主
  onRequestFriend?: () => void;
}

export const ConversationHeader = (props: Props) => {
  const {
    headerTitle,
    showBackButton,
    onGoBack,
    id,
    avatarPath,
    color,
    i18n,
    isGroup,
    isGroupV2,
    invitationRule,
    isGroupV2Owner,
    isGroupV2Admin,
    isMe,
    name,
    profileName,
    onOpenSetting,
    groupMembersCount,
    expireTimer,
    isMeLeftGroup,
    isDirectoryUser,
    onGroupV2AddMembers,
    onRequestFriend,
    accountName,
    isOfficialAccount,
  } = props;

  const conversationType = isGroup ? 'group' : 'direct';

  let title = name;
  if (isMe) {
    title = i18n('noteToSelf');
  }

  if (isGroup && groupMembersCount) {
    title += '(' + groupMembersCount + ')';
  }

  const rightButtonsVisible = !(isMeLeftGroup || showBackButton || isMe);
  const isGroupConversation = isGroup && isGroupV2;

  const visibleInGroupConversation = rightButtonsVisible && isGroupConversation;
  const visibleInPrivateConversation =
    rightButtonsVisible && !isGroupConversation;

  const addMemberButtonVisible =
    visibleInGroupConversation &&
    !(invitationRule === 1 && !isGroupV2Owner && !isGroupV2Admin);

  const quickGroupButtonVisible =
    visibleInPrivateConversation && isDirectoryUser && !isBot(id);

  const requestFriendButtonVisible =
    visibleInPrivateConversation && !isDirectoryUser;

  return (
    <div className="module-conversation-header">
      {showBackButton ? (
        <IconWrapper style={{ marginRight: 4 }}>
          <div
            onClick={onGoBack}
            role="button"
            className="module-conversation-header__back-icon"
          />
        </IconWrapper>
      ) : null}
      <div className="module-conversation-header__title-container">
        {headerTitle ? (
          <div className="module-conversation-header__title-middle">
            <div
              className="module-conversation-header__title-no-drag"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {headerTitle}
            </div>
          </div>
        ) : (
          <div className="module-conversation-header__title-flex">
            <span className="module-conversation-header__avatar module-conversation-header__title-no-drag">
              <Avatar
                id={id}
                avatarPath={avatarPath}
                color={color}
                conversationType={conversationType}
                i18n={i18n}
                noteToSelf={isMe}
                name={name}
                profileName={profileName}
                accountName={accountName}
                size={28}
                onClickAvatar={e => {
                  e.stopPropagation();
                  onOpenSetting();
                }}
              />
            </span>
            <div className="module-conversation-header__title conversation-header">
              {title ? (
                <span className="module-conversation-header__title-no-drag conversation-header-title">
                  {title}
                  {isOfficialAccount && (
                    <IconOfficialAccount className="official-account-icon" />
                  )}
                </span>
              ) : null}
              {profileName && !title ? (
                <span className="module-conversation-header__title__profile-name">
                  {profileName}
                </span>
              ) : null}
              <div className="extra-info">
                {expireTimer && expireTimer > 0 ? (
                  <div className="module-conversation-header__title-sign">
                    {simplifySeconds(expireTimer)}
                  </div>
                ) : null}
                {isOfficialAccount && (
                  <>
                    <span className="dot-divider">・</span>
                    <span className="official-account-desc">
                      {i18n('officialAccountDesc')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {addMemberButtonVisible && (
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="bottomRight"
          title={i18n('addGroupMembersTooltip')}
        >
          <IconWrapper>
            <div
              role="button"
              onClick={onGroupV2AddMembers}
              className="module-conversation-header__group-add-icon"
            />
          </IconWrapper>
        </Tooltip>
      )}
      {quickGroupButtonVisible && (
        <IconWrapper>
          <div
            role="button"
            onClick={() => (window as any).quickCreateGroup(id)}
            className="module-conversation-header__group-add-icon"
          />
        </IconWrapper>
      )}
      {requestFriendButtonVisible && (
        <IconWrapper>
          <div
            role="button"
            onClick={onRequestFriend}
            className="module-conversation-header__friend-add-icon"
          />
        </IconWrapper>
      )}
    </div>
  );
};
