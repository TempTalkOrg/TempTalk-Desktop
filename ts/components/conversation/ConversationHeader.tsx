import React from 'react';

import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { Tooltip } from 'antd';
import { simplifySeconds } from '../../util/formatRelativeTime';
import { isBot } from '../../shims/Whisper';
import { IconWrapper } from '../shared/IconWrapper';

interface Props {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  color: string;
  avatarPath?: string;
  email?: string;
  signature?: string;

  isMe: boolean;
  isMeLeftGroup: boolean;
  isGroup: boolean;
  isGroupV2: boolean;
  isGroupV2Owner: boolean;
  isGroupV2Admin: boolean;
  isArchived: boolean;
  groupMembersCount?: number;
  isDirectoryUser?: boolean;

  expireTimer?: number;

  showBackButton: boolean;
  showGroupEditButton: boolean;
  showGroupSaveButton: boolean;

  onDeleteMessages: () => void;
  onLeaveGroup: () => void;
  onDisbandGroup: () => void;

  onShowAllMedia: () => void;
  onGoBack: () => void;
  onGroupSave: () => void;

  onGroupV2AddMembers: () => void;
  onGroupV2RemoveMembers: () => void;

  onArchive: () => void;
  onMoveToInbox: () => void;

  i18n: LocalizerType;
  isStick?: boolean;
  onStick: (stick: boolean) => void;
  headerTitle?: string;
  onOpenSetting: () => void;
  invitationRule?: number; // 邀请其他人入群规则 2:全员允许（默认），1:管理员和群主、0:群主
  onRequestFriend?: () => void;
}

export class ConversationHeader extends React.Component<Props> {
  // public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  // public menuTriggerRef: React.RefObject<any>;
  public showMenuAddBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public menuAddTriggerRef: React.RefObject<any>;

  public constructor(props: Props) {
    super(props);

    // this.menuTriggerRef = React.createRef();
    // this.showMenuBound = this.showMenu.bind(this);
    this.menuAddTriggerRef = React.createRef();
    this.showMenuAddBound = this.showMenuAdd.bind(this);
  }

  // public showMenu(event: React.MouseEvent<HTMLDivElement>) {
  //   if (this.menuTriggerRef.current) {
  //     this.menuTriggerRef.current.handleContextClick(event);
  //   }
  // }

  public showMenuAdd(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuAddTriggerRef.current) {
      this.menuAddTriggerRef.current.handleContextClick(event);
    }
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    if (!showBackButton) {
      return null;
    }

    return (
      <IconWrapper style={{ marginRight: 4 }}>
        <div
          onClick={onGoBack}
          role="button"
          className="module-conversation-header__back-icon"
        />
      </IconWrapper>
    );
  }

  // public renderSignOrPhoneNumberAndEmail(
  //   signature: string | undefined,
  //   phoneNumber: string,
  //   email: string | undefined
  // ) {
  //   if (signature) {
  //     return (
  //       <div className="module-conversation-header__title-sign">
  //         {signature}
  //       </div>
  //     );
  //   }
  //   if (phoneNumber && email) {
  //     return (
  //       <div className="module-conversation-header__title-sign">  {`${phoneNumber} | ${email}`}</div>
  //     );
  //   }
  //   if (phoneNumber) {
  //     return (
  //       <div className="module-conversation-header__title-sign">
  //         {phoneNumber}
  //       </div>
  //     );
  //   }
  //   return null;
  // }

  public renderExpiry() {
    const { expireTimer } = this.props;

    if (expireTimer && expireTimer > 0) {
      return (
        <div className="module-conversation-header__title-sign">
          {simplifySeconds(expireTimer)}
        </div>
      );
    }

    return null;
  }

  public formatSecond(sec: number | undefined) {
    const { i18n } = this.props;

    if (!sec) {
      return '';
    }

    if (sec < 60 * 60) {
      return i18n('active_minutes_ago', [`${Math.floor(sec / 60)}`]);
    }

    if (sec < 60 * 60 * 24) {
      return i18n('active_hours_ago', [`${Math.floor(sec / 60 / 60)}`]);
    }

    if (sec < 60 * 60 * 24 * 7) {
      return i18n('active_days_ago', [`${Math.floor(sec / 60 / 60 / 24)}`]);
    }

    if (sec < 60 * 60 * 24 * 30) {
      return i18n('active_weeks_ago', [
        `${Math.floor(sec / 60 / 60 / 24 / 7)}`,
      ]);
    }

    return i18n('active_months_ago');
  }

  public renderTitle() {
    const {
      // phoneNumber,
      i18n,
      profileName,
      isMe,
      // email,
      isGroup,
      // signature,
      groupMembersCount,
    } = this.props;
    let name = this.props.name;
    if (isMe) {
      name = i18n('noteToSelf');
    }

    if (isGroup && groupMembersCount) {
      name += '(' + groupMembersCount + ')';
    }

    if (!name) {
      name = this.props.id;
    }

    return (
      <div className="module-conversation-header__title">
        {name ? (
          <span className="module-conversation-header__title-no-drag">
            {name}
          </span>
        ) : null}
        {/*{name && phoneNumber ? ' · ' : null}*/}
        {/*{phoneNumber ? phoneNumber : null}{' '}*/}
        {profileName && !name ? (
          <span className="module-conversation-header__title__profile-name">
            {profileName}
          </span>
        ) : null}
        {/* {this.renderSignOrPhoneNumberAndEmail(signature, phoneNumber, email)} */}
        {this.renderExpiry()}
      </div>
    );
  }

  public renderAvatar() {
    const {
      id,
      avatarPath,
      color,
      i18n,
      isGroup,
      isMe,
      name,
      profileName,
      onOpenSetting,
    } = this.props;

    const conversationType = isGroup ? 'group' : 'direct';

    return (
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
          size={28}
          onClickAvatar={e => {
            e.stopPropagation();
            onOpenSetting();
          }}
        />
      </span>
    );
  }

  // public renderSave() {
  //   const {
  //     showBackButton,
  //     showGroupSaveButton,
  //     onGroupSave,
  //   } = this.props;
  //
  //   if (showBackButton && showGroupSaveButton) {
  //     return (
  //       <div
  //         role="button"
  //         onClick={onGroupSave}
  //         className="module-conversation-header__save-icon"
  //       />
  //     );
  //   }
  //
  //   return null;
  // }

  // public renderGear(triggerId: string) {
  //   const {
  //     isGroupV2,
  //     isGroupV2Owner,
  //     showBackButton,
  //     showGroupEditButton,
  //     onGroupV2AddMembers,
  //     onGroupV2RemoveMembers,
  //   } = this.props;
  //
  //   if (showGroupEditButton) {
  //     if (isGroupV2) {
  //       return (
  //         <>
  //           <div
  //             role="button"
  //             onClick={onGroupV2AddMembers}
  //             className="module-conversation-header__group-add-icon"
  //           />
  //           {
  //             isGroupV2Owner
  //               ?
  //               <div
  //                 role="button"
  //                 onClick={onGroupV2RemoveMembers}
  //                 className="module-conversation-header__group-remove-icon"
  //               />
  //               : null
  //           }
  //         </>
  //       );
  //     } else {
  //       return (
  //         <div
  //           role="button"
  //           onClick={}
  //           className="module-conversation-header__plus-icon"
  //         />
  //       );
  //     }
  //   }
  //
  //   if (showBackButton) {
  //     return null;
  //   }
  //
  //   return (
  //     <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
  //       <div
  //         role="button"
  //         onClick={this.showMenuBound}
  //         className="module-conversation-header__gear-icon"
  //       />
  //     </ContextMenuTrigger>
  //   );
  // }

  public setStick = () => {
    const { onStick } = this.props;
    if (onStick) {
      onStick(true);
    }
  };

  public unStick = () => {
    const { onStick } = this.props;
    if (onStick) {
      onStick(false);
    }
  };

  // public renderMenu(triggerId: string) {
  //   const {
  //     i18n,
  //     isMe,
  //     // isMeLeftGroup,
  //     isGroup,
  //     isGroupV2,
  //     // isGroupV2Owner,
  //     // isArchived,
  //     // onLeaveGroup,
  //     // onDisbandGroup,
  //     onDeleteMessages,
  //     onShowAllMedia,
  //     // onArchive,
  //     // onMoveToInbox,
  //     isStick,
  //   } = this.props;
  //
  //   return (
  //     <ContextMenu id={triggerId}>
  //       {
  //         isStick ?
  //           (<MenuItem onClick={this.unStick}>{i18n('removeFromTop')}</MenuItem>) :
  //           (<MenuItem onClick={this.setStick}>{i18n('stickToTop')}</MenuItem>)
  //       }
  //       <MenuItem onClick={onShowAllMedia}>{i18n('viewAllMedia')}</MenuItem>
  //       {isGroup ?
  //         <MenuItem onClick={}>
  //           {isGroupV2 ? i18n('showDetails') : i18n('showMembers')}
  //         </MenuItem>
  //         : null
  //       }
  //       {/*{isArchived ? (*/}
  //       {/*  <MenuItem onClick={onMoveToInbox}>*/}
  //       {/*    {i18n('moveConversationToInbox')}*/}
  //       {/*  </MenuItem>*/}
  //       {/*) : (*/}
  //       {/*  <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>*/}
  //       {/*)}*/}
  //       <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
  //       {
  //         // isGroup && isGroupV2Owner && !isMeLeftGroup ?
  //         //   <MenuItem onClick={onDisbandGroup}>{i18n('disbandGroup')}</MenuItem>
  //         // : isGroup && !isGroupV2Owner && !isMeLeftGroup ?
  //         //     <MenuItem onClick={onLeaveGroup}>{i18n('leaveGroup')}</MenuItem>
  //         //   : null
  //       }
  //     </ContextMenu>
  //   );
  // }

  // public renderMenuAdd(triggerId: string) {
  //   const { id, name, i18n, onGroupV2AddMembers } = this.props;

  //   return (
  //     <ContextMenu id={triggerId}>
  //       <MenuItem onClick={() => (window as any).quickCreateGroupFromGroup(name, id)}>
  //         {i18n('group_editor_menu_item_fast_group')}
  //       </MenuItem>
  //       <MenuItem onClick={onGroupV2AddMembers}>
  //         {i18n('group_editor_menu_item_add_members')}
  //       </MenuItem>
  //     </ContextMenu>
  //   );
  // }

  // public renderAddButton(triggerId: string) {
  //   const {
  //     id,
  //     i18n,
  //     isMe,
  //     isGroup,
  //     isGroupV2,
  //   } = this.props;

  //   if (isMe) {
  //     return null;
  //   }

  //   if (isGroup && isGroupV2) {
  //     return (
  //       <ContextMenuTrigger id={triggerId} ref={this.menuAddTriggerRef}>
  //         <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('addGroupMembersTooltip')}>
  //           <div
  //             role="button"
  //             onClick={this.showMenuAddBound}
  //             className="module-conversation-header__group-add-icon"
  //           />
  //         </Tooltip>
  //       </ContextMenuTrigger>
  //     );
  //   } else {
  //     return (
  //       <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('addGroupMembersTooltip')}>
  //         <div
  //           role="button"
  //           onClick={() => (window as any).quickCreateGroup(id)}
  //           className="module-conversation-header__group-add-icon"
  //         />
  //       </Tooltip>
  //     );
  //   }
  // }

  public renderAddButtonOnly() {
    const {
      id,
      i18n,
      isMe,
      isGroup,
      isGroupV2,
      onGroupV2AddMembers,
      isGroupV2Owner,
      isGroupV2Admin,
      invitationRule,
      isDirectoryUser,
      onRequestFriend,
    } = this.props;

    if (isMe) {
      return null;
    }

    if (isGroup && isGroupV2) {
      if (invitationRule === 1 && !isGroupV2Owner && !isGroupV2Admin) {
        return null;
      }
      return (
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
      );
    } else {
      if (isDirectoryUser) {
        if (isBot(id)) {
          return null;
        }
        return (
          // <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('quickGroupTooltip')}>
          <IconWrapper>
            <div
              role="button"
              onClick={() => (window as any).quickCreateGroup(id)}
              className="module-conversation-header__group-add-icon"
            />
          </IconWrapper>
          // </Tooltip>
        );
      } else {
        return (
          <IconWrapper>
            <div
              role="button"
              onClick={onRequestFriend}
              className="module-conversation-header__friend-add-icon"
            />
          </IconWrapper>
        );
      }
    }
  }

  public renderRightButtons() {
    const {
      // id,
      // i18n,
      isMeLeftGroup,
      // onOpenSetting,
      showBackButton,
    } = this.props;

    if (isMeLeftGroup || showBackButton) {
      return null;
    }

    // const triggerId = `conversation-${id}`;

    return (
      <>
        {/* <div
        role="button"
        onClick={() => (window as any).showLocalSearch('', id)}
        className="module-conversation-header__history-icon"
      /> */}
        {this.renderAddButtonOnly()}
        {/* {this.renderAddButton(triggerId)} */}
        {/* {this.renderMenuAdd(triggerId)} */}
        {/* <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="bottomRight"
          title={i18n('sessionInformationTooltip')}
        >
          <IconWrapper style={{ marginLeft: 10 }}>
            <div
              role="button"
              onClick={onOpenSetting}
              className="module-conversation-header__gear-icon"
            />
          </IconWrapper>
        </Tooltip> */}
      </>
    );
  }

  public render() {
    const { headerTitle } = this.props;

    return (
      <div className="module-conversation-header">
        {this.renderBackButton()}
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
              {this.renderAvatar()}
              {this.renderTitle()}
            </div>
          )}
        </div>
        {/*{this.renderGear(triggerId)}*/}
        {/*{this.renderSave()}*/}
        {/*{this.renderMenu(triggerId)}*/}
        {this.renderRightButtons()}
      </div>
    );
  }
}
