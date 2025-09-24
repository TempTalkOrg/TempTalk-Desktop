import React, { useEffect, useMemo, useRef, useState } from 'react';
import PollModal from '../../PollModal';
import { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';
import GroupMemberList from './GroupMemberList';
import { Input, Modal, Space } from 'antd';
// import moment from 'moment';
// import { Popover } from 'antd';
import { humanizeSeconds } from '../../../util/humanizeSeconds';
import { ConversationType } from '../../../state/ducks/conversations';
import {
  getConversationModel,
  getConversationProps,
} from '../../../shims/Whisper';
import { getConversationComparator } from '../../../state/selectors/conversations';
import { StateType } from '../../../state/reducer';
import { SearchOutlined } from '@ant-design/icons';
import { useMemoizedFn } from 'ahooks';
import { AutoSizer, List } from 'react-virtualized';
import { ContactListItem } from '../../ContactListItem';
import { IconWrapper } from '../../shared/IconWrapper';

type TempShowInfo = {
  id: string;
  timestamp: number;
};

interface Props {
  id: string;
  name?: string;
  profileName?: string;
  color: string;
  avatarPath?: string;
  ourNumber?: string;

  i18n: LocalizerType;
  isPrivate: boolean;
  stick?: boolean;
  onStick: (stick: boolean) => void;
  onShowAllMedia: () => void;
  onLeaveGroup: () => void;
  onDisbandGroup: () => void;
  onRenameGroupName: (newName: string) => boolean;
  onForwardTo: (conversationIds: any, groupLink: string) => void;
  onTransferGroupOwner: (id: string) => void;

  groupMembersCount?: number;
  members: Array<any>;
  notifyIndex: number;
  setNotifyIndex: (notification: number) => void;
  setMuteSetting: (isMute: boolean) => void;
  mute?: boolean | undefined;
  mute_setting_init?: boolean;

  isMeLeftGroup: boolean;
  isGroupV2Owner: boolean;
  isGroupV2Admin: boolean;
  isDirectoryUser?: boolean;
  onCancel: () => void;

  invitationRule?: number; // 邀请其他人入群规则 2:全员允许（默认），1:管理员和群主、0:群主
  setInvitationRule: (ruleIndex: number) => void;

  // anyoneRemove?: boolean;
  // setAnyoneRemove: (b: boolean) => void;

  // rejoin: boolean;
  // setRejoin: (b: boolean) => void;

  publishRule?: number;
  setPublishRule: (ruleIndex: number) => void;

  defaultMessageExpiry: number;
  currentMessageExpiry: number;
  messageExpiryOptions: Array<number>;
  onChangeMessageExpiry: (messageExpiry: number) => Promise<void>;
  reminderValue: string;
  reminderOptionValues: Array<string>;
  onChangeReminder: (remindCycle: string | undefined) => Promise<void>;

  anyoneChangeName?: boolean;
  setAnyoneChangeName: (anyoneChangeName: boolean) => void;

  linkInviteSwitch?: boolean;
  setLinkInviteSwitch: (linkInviteSwitch: boolean) => void;

  tempShowInfo?: TempShowInfo;
  onClearTempShow?: () => void;
  onDeleteMessages?: () => void;
  onBlockUser?: () => void;
}

export const SettingDialog = (props: Props) => {
  const {
    id,
    i18n,
    members,
    currentMessageExpiry,
    messageExpiryOptions,
    // reminderValue,
    // reminderOptionValues,
    isPrivate,
    tempShowInfo,
    onClearTempShow,
    onBlockUser,
    onCancel,
  } = props;

  const initIndex = messageExpiryOptions.indexOf(currentMessageExpiry);
  const expiryOptionsToRender =
    initIndex === -1
      ? [currentMessageExpiry, ...messageExpiryOptions]
      : messageExpiryOptions;

  // const reminderIndex = reminderOptionValues.indexOf(reminderValue);
  // const reminderOptionsToRender = ['off', ...reminderOptionValues];
  // const reminderValueToInit = reminderIndex === -1 ? 'off' : reminderValue;

  const [operationLoading, setOperationLoading] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showGroupManagerModerators, setShowGroupManagerModerators] =
    useState(false);
  const [showGroupManagerTransfer, setShowGroupManagerTransfer] =
    useState(false);
  const maxGroupNameLength = 64;

  const [showCommonGroups, setShowCommonGroups] = useState(false);
  const [commonGroups, setCommonGroups] = useState<ConversationType[]>([]);

  const [messageExpiryModalInstance, messageExpiryModalContextHolder] =
    Modal.useModal();

  useEffect(() => {
    let lookupId;
    let shouldShow;

    if (tempShowInfo?.id) {
      lookupId = tempShowInfo.id;
      shouldShow = true;
    } else {
      shouldShow = false;
      lookupId = isPrivate ? id : undefined;
    }

    setShowCommonGroups(shouldShow);

    if (!lookupId) {
      setCommonGroups([]);
      return;
    }

    const state = (window as any).inboxStore.getState();
    const { memberGroupLookup } = (state as StateType).conversations;

    const groups = memberGroupLookup[lookupId];
    if (groups) {
      setCommonGroups(
        groups
          .map(id => getConversationProps(id))
          .filter(props => props.isAliveGroup)
          .sort(getConversationComparator(state))
      );
    }
  }, [tempShowInfo]);

  const renderBackBtn = () => {
    return (
      <IconWrapper style={{ position: 'absolute', left: '15px', top: '16px' }}>
        <span
          className={'common-back'}
          onMouseDown={() => {
            if (showCommonGroups) {
              setShowCommonGroups(false);
              onClearTempShow?.();
              return;
            }

            if (showGroupManagerModerators) {
              setShowGroupManagerModerators(false);
              return;
            }
            if (showGroupManagerTransfer) {
              setShowGroupManagerTransfer(false);
              return;
            }
            if (showGroupManager) {
              setShowGroupManager(false);
              return;
            }
          }}
        />
      </IconWrapper>
    );
  };

  const renderCloseBtn = () => {
    return (
      <IconWrapper style={{ position: 'absolute', right: '15px', top: '16px' }}>
        <span
          className={'common-close'}
          onMouseDown={(event: React.MouseEvent<HTMLSpanElement>) => {
            event.stopPropagation();

            props.onCancel();
          }}
        />
      </IconWrapper>
    );
  };

  const renderOperationLoading = () => {
    if (!operationLoading) {
      return null;
    }
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 9999,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <div className={'waiting-border'}>
            <div
              className="waiting"
              style={{ width: 40, height: 40, margin: 10 }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderTitle = () => {
    if (showCommonGroups) {
      const groupCount = commonGroups.length;

      const countTitleKey =
        groupCount > 1 ? 'groupCountTitle2' : 'groupCountTitle1';

      let anotherName = props.name || props.id;
      const id = tempShowInfo?.id;
      if (id) {
        anotherName = getConversationModel(id)?.getName() || id;
      }

      return (
        <div className="header-container">
          <div className="header-title">
            <div className="header-title-main">
              {' '}
              {i18n(countTitleKey, [`${groupCount}`])}
            </div>
            <div className="header-title-sub">
              {i18n('youAndContactName', [anotherName])}
            </div>
          </div>
        </div>
      );
    }

    if (showGroupManagerModerators) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_moderators')}</h3>
        </div>
      );
    }
    if (showGroupManagerTransfer) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_transfer')}</h3>
        </div>
      );
    }

    if (showGroupManager) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_manager')}</h3>
        </div>
      );
    }

    return (
      <div className={'header-container'}>
        <h3>{i18n('settings')}</h3>
      </div>
    );
  };

  const canInviteJoinGroup = () => {
    const {
      invitationRule,
      isGroupV2Owner,
      isGroupV2Admin,
      id,
      isDirectoryUser,
      isPrivate,
    } = props;
    const isBot = (window as any).Signal.ID.isBotId(id);
    // 仅群主和管理员允许邀请人，并且是普通群成员

    if (isPrivate) {
      return !isBot && isDirectoryUser;
    }

    return !(invitationRule === 1 && !isGroupV2Owner && !isGroupV2Admin);
  };

  const [searchText, setSearchText] = useState('');
  const listRef = useRef<List>(null);

  //
  const onChangeSearchText = useMemoizedFn(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value ?? '');
    }
  );

  const isSearchMatch = useMemoizedFn((c: any, searchTerm: string) => {
    const search = searchTerm.toLowerCase();
    let name = c.id;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.name;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.profileName;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.title;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.email;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.signature;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    // for self
    if (c.isMe) {
      name = i18n('noteToSelf');
      if (name.toLowerCase().includes(search)) {
        return true;
      }
    }

    return false;
  });

  const [filterMembers, setFilterMembers] = useState<Array<any>>(members);

  const dealMembers = (members: any) => {
    // if (isCommonGroups) {
    //   setFilterMembers(members);
    //   return;
    // }

    let result = [];
    let hasManagers = false;
    let hasUsers = false;
    for (let i = 0; i < members.length; i += 1) {
      if (members[i].role === 0 || members[i].role === 1) {
        if (!hasManagers) {
          hasManagers = true;
          result.push({
            isLabel: true,
            name: i18n('conversation_settings_admin'),
          });
        }
      } else {
        if (!hasUsers) {
          hasUsers = true;
          result.push({
            isLabel: true,
            shouldRecomputeHeight: true,
            name: i18n('conversation_settings_user'),
          });
        }
      }
      result.push(members[i]);
    }
    setFilterMembers(result);
  };

  useEffect(() => {
    if (!searchText) {
      dealMembers(members);
    } else {
      const f = [];
      for (let i = 0; i < members.length; i += 1) {
        if (isSearchMatch(members[i], searchText)) {
          f.push(members[i]);
        }
      }
      dealMembers(f);
    }
  }, [members, searchText]);

  const renderSearchMember = () => {
    const {
      // id,
      // name,
      // profileName,
      // color,
      // avatarPath,
      isPrivate,
    } = props;
    if (isPrivate) {
      return null;
    }

    return (
      <>
        <div className="search-member-container">
          <Input
            value={searchText}
            onChange={onChangeSearchText}
            placeholder="Search Member"
            prefix={
              <SearchOutlined
                style={{ color: 'var(--dst-color-text-third)' }}
              />
            }
            className="search-member-input"
          />
        </div>
        {searchText ? (
          <>
            {filterMembers.length ? (
              <div
                className={'member-list-container'}
                style={{ marginTop: 10 }}
              >
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      ref={listRef}
                      height={height}
                      rowCount={filterMembers.length}
                      rowRenderer={renderRow}
                      rowHeight={rowHeight}
                      width={width}
                      rerenderWhenChanged={filterMembers}
                    />
                  )}
                </AutoSizer>
                {/* {renderFirstLevelMenus()} */}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '5px' }}>
                {i18n('noSearchResults', [searchText])}
              </div>
            )}
          </>
        ) : null}
      </>
    );
  };

  const renderRow = ({ index, style }: any): JSX.Element => {
    const c = filterMembers[index];
    if (c.isLabel) {
      return (
        <div key={index} style={style} className={'label-container'}>
          {c.name}
        </div>
      );
    }

    // if (isCommonGroups) {
    //   return (
    //     <ConversationListItem
    //       key={c.id}
    //       {...c}
    //       isStick={undefined}
    //       onClick={() => {
    //         trigger('showConversation', c.id);
    //         const myEvent = new Event('event-toggle-switch-chat');
    //         window.dispatchEvent(myEvent);
    //       }}
    //       style={{
    //         ...style,
    //         maxWidth: '100%',
    //         paddingLeft: '8px',
    //         paddingRight: '8px',
    //       }}
    //       i18n={i18n}
    //       isMyGroup={true}
    //       showMembersPreview={true}
    //     />
    //   );
    // }

    return (
      <ContactListItem
        key={index}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        name={c.name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={(c as any).email}
        i18n={props.i18n}
        useDefaultAvatarClick={true}
        // onClick={async (event: any) => {
        //   if (event && event.button === 2) {
        //     // setCurrentEditMember(c);
        //     showFirstLevelMenu(event);
        //     return;
        //   }
        //   if (transferGroupOwner) {
        //     if ((window as any).Signal.ID.isBotId(c.id)) {
        //       alert(i18n('conversation_settings_group_transfer_bot'));
        //       return;
        //     }
        //     const confirmText = i18n('transferOwnerOfTheGroup', [
        //       c.name || c.id,
        //     ]);

        //     if (isLinux()) {
        //       if (await (window as any).whisperConfirm(confirmText)) {
        //         transferGroupOwner(c.id);
        //       }
        //     } else {
        //       if (confirm(confirmText)) {
        //         transferGroupOwner(c.id);
        //       }
        //     }

        //     return;
        //   }
        //   trigger('showConversation', c.id);
        //   const myEvent = new Event('event-toggle-switch-chat');
        //   window.dispatchEvent(myEvent);
        // }}
      />
    );
  };

  const rowHeight = ({ index }: any) => {
    if (filterMembers[index].isLabel) {
      return 20;
    }
    return 58;
  };

  const [editGroupNameVisible, setEditGroupNameVisible] = useState(false);
  const [inputGroupName, setInputGroupName] = useState(props.name || '');
  const { onRenameGroupName } = props;

  const showEditGroupName = useMemoizedFn(() => {
    setEditGroupNameVisible(true);
  });

  const onEditGroupName = useMemoizedFn(async () => {
    setOperationLoading(true);
    try {
      if (!inputGroupName || inputGroupName.trim() === '') {
        setInputGroupName(props.name ?? '');
        return setEditGroupNameVisible(false);
      }
      const result = await onRenameGroupName(inputGroupName);
      if (result) {
        setEditGroupNameVisible(false);
      }
    } finally {
      setOperationLoading(false);
    }
  });

  const renderGroupAvatarHeader = () => {
    const { id, name, profileName, color, avatarPath, isPrivate } = props;
    if (isPrivate) {
      return null;
    }

    const conversationType = isPrivate ? 'direct' : 'group';
    return (
      <div className={'group-header-container'}>
        <div
          style={{
            display: 'flex',
            justifyItems: 'center',
            alignItems: 'center',
            maxWidth: 'calc(100% - 30px)',
            padding: '10px 0',
          }}
        >
          <Avatar
            id={id}
            avatarPath={avatarPath}
            color={color}
            conversationType={conversationType}
            i18n={i18n}
            noteToSelf={false}
            name={name}
            profileName={profileName}
            size={48}
          />
          {!editGroupNameVisible ? (
            <span style={{ margin: '8px 0 8px 10px', wordBreak: 'break-word' }}>
              {name}
            </span>
          ) : (
            <Input
              className="edit-group-name-input"
              value={inputGroupName}
              maxLength={maxGroupNameLength}
              style={{ width: 244, marginLeft: 12, marginRight: 16 }}
              onChange={e => setInputGroupName(e.target.value)}
            />
          )}
          {renderEditButton()}
        </div>
        {/* {canInviteJoinGroup() ? <span className={'forward-icon'} /> : null} */}
      </div>
    );
  };

  const [groupMemberCollapsed, setGroupMemberCollapsed] = useState(true);

  const groupMembersForDisplay = useMemo(() => {
    if (groupMemberCollapsed) {
      return members.slice(0, 16);
    } else {
      return members;
    }
  }, [members, groupMemberCollapsed]);

  const renderGroupMembers = () => {
    const {
      id,
      name,
      profileName,
      avatarPath,
      // isPrivate,
      isGroupV2Owner,
      isGroupV2Admin,
      // anyoneRemove,
    } = props;

    const membersForDisplay = isPrivate
      ? [
          <div key={id} className="group-member-item">
            <Avatar
              i18n={i18n}
              conversationType={'direct'}
              id={id}
              avatarPath={avatarPath}
              profileName={profileName}
              name={name}
              size={36}
            />
            <div className="group-member-name" title={name}>
              {name}
            </div>
          </div>,
        ]
      : groupMembersForDisplay.map((item, index) => {
          return (
            <div key={index} className="group-member-item">
              <Avatar
                i18n={i18n}
                conversationType={'direct'}
                id={item.id}
                avatarPath={item.avatarPath}
                profileName={item.profileName}
                name={item.name}
                size={36}
              />
              <div className="group-member-name" title={item.name}>
                {item.name}
              </div>
            </div>
          );
        });

    return (
      <div className={'group-members-container'}>
        {isPrivate ? (
          <div
            className="setting-dialog-members-placeholder"
            style={{ height: 26 }}
          ></div>
        ) : (
          <div className={'members'}>
            <span>{i18n('conversation_settings_group_members')}</span>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            ></div>
          </div>
        )}
        <div className="group-member-list">
          {membersForDisplay}
          {canInviteJoinGroup() ? (
            <div className="group-member-item">
              <span
                className={'member-add-icon'}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isPrivate) {
                    (window as any).quickCreateGroup(id);
                  } else {
                    (window as any).showAddGroupMembersWindow(id);
                  }
                }}
              />
            </div>
          ) : null}
          {isGroupV2Owner || isGroupV2Admin ? (
            <div className="group-member-item">
              <span
                className={'member-reduce-icon'}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  (window as any).showRemoveGroupMembersWindow(id);
                }}
              />
            </div>
          ) : null}
        </div>
        {isPrivate ? (
          <div
            className="setting-dialog-members-placeholder"
            style={{ height: 11 }}
          ></div>
        ) : (
          <div
            className="group-members-collapse-control"
            onClick={() => setGroupMemberCollapsed(prev => !prev)}
          >
            {groupMemberCollapsed ? (
              <Space align="center">
                <span className="group-members-collapse-control-text">
                  View All
                </span>
                <div className="arrow-down-icon"></div>
              </Space>
            ) : (
              <Space align="center">
                <span className="group-members-collapse-control-text">
                  Collapse
                </span>
                <div className="arrow-up-icon"></div>
              </Space>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroupModerators = () => {
    const { id, isPrivate } = props;
    if (isPrivate) {
      return null;
    }

    const adminCount = members.filter(item => {
      return item.role !== 2;
    }).length;
    const max5members = members.map((item, index) => {
      // 最多显示5个
      if (index > 4 || item.role === 2) {
        return null;
      }
      return (
        <div key={index} style={{ marginRight: '10px' }}>
          <Avatar
            i18n={i18n}
            conversationType={'direct'}
            id={item.id}
            avatarPath={item.avatarPath}
            profileName={item.profileName}
            name={item.name}
            size={36}
          />
        </div>
      );
    });

    return (
      <div
        className={'group-members-container'}
        onClick={() => {
          setShowGroupManagerModerators(true);
        }}
      >
        <div className={'members'}>
          <span>{i18n('conversation_settings_group_moderators')}</span>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12px' }}>{adminCount}</span>
            <span className={'forward-icon'} />
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {max5members}
          <span
            className={'member-add-icon'}
            style={{ marginRight: 10 }}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              (window as any).showAddGroupAdminsWindow(id);
            }}
          />
          {adminCount > 1 ? (
            <span
              className={'member-reduce-icon'}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                (window as any).showRemoveGroupAdminsWindow(id);
              }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const renderGroupManager = () => {
    const { isGroupV2Owner } = props;
    if (!isGroupV2Owner) {
      return null;
    }
    return (
      <div
        className={'common-container'}
        onClick={() => {
          setShowGroupManager(true);
        }}
      >
        <span>{i18n('conversation_settings_group_manager')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  const renderStick = () => {
    const { stick, onStick } = props;
    return (
      <div
        className={'stick-container'}
        style={{ marginTop: 0 }}
        onClick={() => {
          onStick(!stick);
        }}
      >
        <span>{i18n('stickToTop')}</span>
        <input
          className="checkbox-item"
          type="checkbox"
          checked={!!stick}
          onChange={() => {}}
        />
      </div>
    );
  };

  // const renderTipsContent = () => {
  //   const { i18n } = props;
  //   return (
  //     <div className="module-archive-indicator__tips-content">
  //       <span>{i18n('canRejoinTip1')}</span>
  //       <br></br>
  //       <span>{i18n('canRejoinTip2')}</span>
  //     </div>
  //   );
  // };

  // const renderReminderTipsContent = () => {
  //   const { i18n } = props;
  //   return (
  //     <div className="module-archive-indicator__tips-content">
  //       <span>{i18n('reminderTips')}</span>
  //     </div>
  //   );
  // };

  const renderInviteRule = () => {
    const { invitationRule, setInvitationRule } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => {
          if (invitationRule === 2) {
            setInvitationRule(1);
          }
          if (invitationRule === 1) {
            setInvitationRule(2);
          }
        }}
      >
        <span>{i18n('onlyAdminCanInvite')}</span>
        <input
          className="checkbox-item"
          type="checkbox"
          checked={invitationRule === 1}
          readOnly
        />
      </div>
    );
  };

  const renderPublishOnlyGroup = () => {
    const { publishRule, setPublishRule } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => {
          if (publishRule === 2) {
            setPublishRule(1);
          }
          if (publishRule === 0) {
            setPublishRule(2);
          }
          if (publishRule === 1) {
            setPublishRule(2);
          }
        }}
      >
        <div style={{ display: 'flex' }}>{i18n('onlyModeratorsCanSpeak')}</div>
        <input
          className="checkbox-item"
          type="checkbox"
          checked={publishRule === 1}
          readOnly
        />
      </div>
    );
  };

  // const renderAnyoneRemove = () => {
  //   const { anyoneRemove, setAnyoneRemove } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => {
  //         setAnyoneRemove(!anyoneRemove);
  //       }}
  //     >
  //       <span>{i18n('anyoneCanRemoveMember')}</span>
  //       <input type="checkbox" checked={anyoneRemove} readOnly />
  //     </div>
  //   );
  // };
  // const renderRejoin = () => {
  //   const { rejoin, setRejoin } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => {
  //         setRejoin(!rejoin);
  //       }}
  //     >
  //       <div style={{ display: 'flex' }}>
  //         {i18n('memberCanRejoin')}
  //         <Popover
  //           destroyTooltipOnHide={true}
  //           trigger="hover"
  //           content={renderTipsContent()}
  //           title={i18n('canRejoinTip')}
  //           align={{
  //             offset: [0, 5],
  //           }}
  //           overlayClassName={'module-archive-indicator__popover'}
  //         >
  //           <div className={'rejoin-tip'} />
  //         </Popover>
  //       </div>
  //       <input type="checkbox" checked={rejoin} readOnly />
  //     </div>
  //   );
  // };

  // const renderAnyoneChangeName = () => {
  //   const { anyoneChangeName, setAnyoneChangeName } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => setAnyoneChangeName(!anyoneChangeName)}
  //     >
  //       <span>{i18n('anyoneCanChangeGroupName')}</span>
  //       <input type="checkbox" checked={anyoneChangeName} readOnly />
  //     </div>
  //   );
  // };

  const renderViewMedia = () => {
    const { onShowAllMedia } = props;
    return (
      <div
        className={'common-container'}
        style={{ marginTop: 0 }}
        onClick={() => {
          onShowAllMedia();
          props.onCancel();
        }}
      >
        <span>{i18n('viewAllMedia')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  const renderNotifications = () => {
    const { isPrivate, notifyIndex, setNotifyIndex } = props;
    if (isPrivate) {
      return null;
    }

    return (
      <div className={'common-container'} style={{ marginTop: 0 }}>
        <span>{i18n('notifications')}</span>
        <div className="select-wrapper">
          <select
            value={notifyIndex}
            onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
              setOperationLoading(true);
              await setNotifyIndex(parseInt(e.target.value));
              setOperationLoading(false);
            }}
          >
            <option value={0}>{i18n('notifyAll')}</option>
            <option value={1}>{i18n('notifyAtMe')}</option>
            <option value={2}>{i18n('notifyNone')}</option>
          </select>
        </div>
      </div>
    );
  };

  const onSwitchChange = async () => {
    const { mute, setMuteSetting } = props;
    setMuteSetting(!mute);
  };

  const renderMute = () => {
    const { mute } = props;
    return (
      <div className={'common-container'} onClick={onSwitchChange}>
        <span>{i18n('mute')}</span>
        <input
          className="checkbox-item"
          type="checkbox"
          checked={!!mute}
          readOnly
        />
      </div>
    );
  };

  const renderHistorySearchEntry = () => {
    return (
      <div
        className={'common-container'}
        onClick={() => {
          (window as any).showLocalSearch('', props.id);
        }}
      >
        <span>{i18n('historySearchTitle')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  const renderMessageExpiryOption = (optionValue: number, index: number) => {
    if (optionValue === -1) {
      const { defaultMessageExpiry } = props;

      return (
        <option value={index} key={index}>
          {i18n('messageDefaultExpiry', [
            humanizeSeconds(defaultMessageExpiry),
          ])}
        </option>
      );
    } else if (optionValue === 0) {
      if (messageExpiryOptions.indexOf(0) === -1) {
        return (
          <option value={index} key={index}>
            {i18n('messageDefaultExpiry', [i18n('messageNeverExpiry')])}
          </option>
        );
      } else {
        return (
          <option value={index} key={index}>
            {i18n('messageNeverExpiry')}
          </option>
        );
      }
    } else if (optionValue > 0) {
      return (
        <option value={index} key={index}>
          {humanizeSeconds(optionValue)}
        </option>
      );
    } else {
      return null;
    }
  };

  const onMessageExpirySelectChanged = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { onChangeMessageExpiry } = props;

    const index = parseInt(e.target.value);
    const optionValue = expiryOptionsToRender[index];

    // unexpected value
    if (optionValue === -1) {
      return;
    }

    try {
      const operation =
        optionValue > currentMessageExpiry ? 'extend' : 'shorten';

      const config = {
        icon: null,
        title: i18n(`messageExpiry.${operation}.title`),
        content: i18n(`messageExpiry.${operation}.content`),
        okText: i18n('ok'),
        cancelText: i18n('cancel'),
        wrapClassName: 'set-message-expiry-modal',
      };

      const confirmed = await messageExpiryModalInstance.confirm(config);

      if (!confirmed) {
        return;
      }

      setOperationLoading(true);
      await onChangeMessageExpiry(optionValue);
    } catch (e) {
      console.log('update message expiry failed', e);
    } finally {
      setOperationLoading(false);
    }
  };

  // const onReminderSelectChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //   const { onChangeReminder } = props;

  //   const optionValue = e.target.value;

  //   // unexpected value
  //   if (!optionValue || optionValue.length === 0) {
  //     return;
  //   }

  //   setOperationLoading(true);
  //   const value = optionValue === 'off' ? 'none' : optionValue;
  //   onChangeReminder(value).finally(() => {
  //     setOperationLoading(false);
  //   });
  // };

  const renderMessageExpirySettings = () => {
    const {
      onChangeMessageExpiry,
      messageExpiryOptions,
      // isGroupV2Admin,
      ourNumber,
      id,
    } = props;

    if (id && ourNumber && id === ourNumber) {
      return null;
    }

    // if (isPrivate) {
    //   return null;
    // }

    // anyone can edit group expiry
    // if (!isGroupV2Owner && !isGroupV2Admin) {
    //   return null;
    // }

    if (!onChangeMessageExpiry || !messageExpiryOptions) {
      return null;
    }

    return (
      <div className={'common-container'}>
        <span>{i18n('messageExpiry')}</span>
        <div className="select-wrapper">
          <select
            value={initIndex === -1 ? 0 : initIndex}
            onChange={onMessageExpirySelectChanged}
          >
            {expiryOptionsToRender.map(renderMessageExpiryOption)}
          </select>
        </div>
      </div>
    );
  };

  // const renderGroupRemindCycle = () => {
  //   const { isPrivate } = props;
  //   if (isPrivate) return null;

  //   return (
  //     <div className={'common-container'}>
  //       <span>{i18n('reminder')}</span>
  //       <Popover
  //         destroyTooltipOnHide={true}
  //         trigger="hover"
  //         content={renderReminderTipsContent()}
  //         // title={i18n('reminderTips')}
  //         align={{
  //           offset: [0, 5],
  //         }}
  //         overlayClassName={'module-archive-indicator__popover'}
  //       >
  //         <div className={'rejoin-tip'} style={{ marginLeft: '-45px' }} />
  //       </Popover>
  //       <select value={reminderValueToInit} onChange={onReminderSelectChanged}>
  //         {reminderOptionsToRender.map((r, index) => {
  //           if (!r || r.length === 0) return null;
  //           return (
  //             <option value={r} key={index}>
  //               {i18n(r)}
  //             </option>
  //           );
  //         })}
  //       </select>
  //     </div>
  //   );
  // };

  // const renderLinkInviteSwitch = () => {
  //   const { linkInviteSwitch, setLinkInviteSwitch } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => setLinkInviteSwitch(!linkInviteSwitch)}
  //     >
  //       <span>{i18n('enableGroupInviteLink')}</span>
  //       <input type="checkbox" checked={linkInviteSwitch} readOnly />
  //     </div>
  //   );
  // };

  const renderLeaveButton = () => {
    const { isPrivate, onLeaveGroup, isGroupV2Owner } = props;
    if (isPrivate || isGroupV2Owner) {
      return null;
    }
    return (
      <div className={'leave-container'}>
        <button
          onClick={() => {
            onLeaveGroup();
            props.onCancel();
          }}
        >
          {' '}
          {i18n('leaveGroup')}
        </button>
      </div>
    );
  };

  const renderDisbandButton = () => {
    const { isPrivate, onDisbandGroup, isGroupV2Owner } = props;
    if (isPrivate) {
      return null;
    }
    if (!isGroupV2Owner) {
      return null;
    }
    return (
      <div className={'leave-container'}>
        <button
          onClick={() => {
            onDisbandGroup();
            props.onCancel();
          }}
        >
          {i18n('disbandGroup')}
        </button>
      </div>
    );
  };

  const renderDeleteContactButton = () => {
    const {
      isPrivate,
      id,
      ourNumber,
      isDirectoryUser,
      onDeleteMessages,
      onCancel,
    } = props;
    if (!isPrivate || isDirectoryUser === false) {
      return null;
    }
    // Note
    if (id && ourNumber && id === ourNumber) {
      return null;
    }
    return (
      <div className={'leave-container'}>
        <button
          onClick={() => {
            onDeleteMessages?.();
            onCancel?.();
          }}
        >
          {i18n('clearChatHistory')}
        </button>
      </div>
    );
  };

  const renderEditButton = () => {
    return editGroupNameVisible ? (
      <div className="confirm-edit-btn" onClick={onEditGroupName}></div>
    ) : (
      <div className="edit-btn" onClick={showEditGroupName}></div>
    );
  };

  if (showCommonGroups) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={commonGroups}
            isCommonGroups={true}
          />
        </div>
      </PollModal>
    );
  }

  if (showGroupManagerModerators) {
    const admins = members.filter(item => {
      return item.role !== 2;
    });
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList i18n={i18n} members={admins} />
        </div>
      </PollModal>
    );
  }

  if (showGroupManagerTransfer) {
    const users = members.filter(item => {
      return item.role !== 0;
    });
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={users}
            transferGroupOwner={(id: string) => {
              props.onTransferGroupOwner(id);
              props.onCancel();
            }}
          />
        </div>
      </PollModal>
    );
  }

  if (showGroupManager) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          {renderGroupModerators()}
          {
            <div
              className={'common-container'}
              onClick={() => {
                setShowGroupManagerTransfer(true);
              }}
            >
              <span>{i18n('conversation_settings_group_transfer')}</span>
              <span className={'forward-icon'} />
            </div>
          }
          {renderInviteRule()}
          {/* {renderAnyoneRemove()} */}
          {/* {renderRejoin()} */}
          {renderPublishOnlyGroup()}
          {/* {renderAnyoneChangeName()} */}
          {/* {renderLinkInviteSwitch()} */}
        </div>
      </PollModal>
    );
  }

  const renderCommonGroups = () => {
    if (!isPrivate) {
      return null;
    }

    const groupCount = commonGroups.length;
    const countTitleKey =
      groupCount > 1 ? 'groupCountTitle2' : 'groupCountTitle1';

    return (
      <div
        className={'common-container'}
        onClick={() => {
          if (commonGroups.length) {
            setShowCommonGroups(true);
          }
        }}
      >
        <span>{i18n('commonGroupTitle')}</span>
        <span className="common-groups-count">
          {i18n(countTitleKey, [`${groupCount}`])}
        </span>
        <span className={groupCount > 0 ? 'forward-icon' : ''} />
      </div>
    );
  };

  const handleBlockUser = async () => {
    try {
      await Modal.confirm({
        icon: null,
        title: i18n('blockUser'),
        content: i18n('blockUserConfirmation'),
        onOk: () => {
          onBlockUser?.();
        },
        okButtonProps: {
          danger: true,
        },
        okText: i18n('block'),
        cancelText: i18n('cancel'),
        cancelButtonProps: {
          className: 'default-button',
        },
      });
    } catch (e) {
      console.log('user cancel block user');
    }
  };

  const renderBlockUser = () => {
    if (!isPrivate) {
      return null;
    }

    return (
      <div
        className={'common-container'}
        onClick={() => {
          handleBlockUser?.();
          onCancel?.();
        }}
      >
        <span className="text-error">{i18n('blockUser')}</span>
      </div>
    );
  };

  return (
    <PollModal onClose={props.onCancel} escClose={true}>
      <div className="conversation-settings-dialog">
        {renderOperationLoading()}
        {renderCloseBtn()}
        {renderTitle()}
        <div className="conversation-settings-item-list">
          {renderSearchMember()}
          {searchText ? null : (
            <>
              {renderGroupAvatarHeader()}
              {renderGroupMembers()}

              {renderHistorySearchEntry()}
              {renderViewMedia()}

              {renderGroupManager()}

              {renderMute()}
              {renderStick()}
              {renderNotifications()}
              {renderMessageExpirySettings()}
              {/* {renderGroupRemindCycle()} */}
              {renderCommonGroups()}
              {renderBlockUser()}
            </>
          )}
        </div>
        {!searchText ? (
          <>
            {renderLeaveButton()}
            {renderDisbandButton()}
            {renderDeleteContactButton()}
          </>
        ) : null}
        {messageExpiryModalContextHolder}
      </div>
    </PollModal>
  );
};
