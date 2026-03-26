import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { Avatar } from '.././Avatar';
import ProfileItem from './ProfileItem';

import type { MenuProps } from 'antd/lib/menu';
import Modal from 'antd/lib/modal';
import Tooltip from 'antd/lib/tooltip';

import { ContextMenu } from '../shared/ContextMenu';
import { IconWrapper } from '../shared/IconWrapper';
import { IconCall, IconOfficialAccount } from '../shared/icons';
import { AutoSizeInput } from '../shared/AutoSizeInput';
import { useMemoizedFn } from 'ahooks';

const OFFICIAL_WEBSITE = 'https://yelling.pro';

type ActionKeyType =
  | 'shareContact'
  | 'startCall'
  | 'addFriend'
  | 'deleteContact'
  | 'editRemark';

type ActionsConfig = Partial<Record<ActionKeyType, boolean>>;

export interface Props {
  i18n: LocalizerType;
  avatarPath?: string;

  userInfo: any;
  remarkName: string;
  commonGroupNumber: number;

  onClickCommonGroups?: (e: React.MouseEvent) => void;

  onStartCall?: (e: React.MouseEvent) => void;
  onAddFriend?: (e: React.MouseEvent) => void;
  onDeleteContact?: (e: React.MouseEvent) => Promise<void>;

  actions: ActionsConfig;

  onOpenChat?: (e: React.MouseEvent) => void;
  onShareContact?: (e: React.MouseEvent) => void;

  onEditRemarkName?: (remarkName: string) => Promise<boolean>;
}

interface ProfileItemProps {
  field: string;
  title: string;
  isShowCopy?: boolean;
  isRole?: boolean;
  isShowTip?: boolean;
  onClick?: (event: any) => void;
  isShowArrowimg?: boolean;
  onClickArrowimg?: (event: any) => void;
  getContent?: (data: any) => string;
  renderContent?: () => React.ReactNode;
}

const BottomActions = (props: {
  i18n: LocalizerType;
  actions: ActionsConfig;
  openChat: (e: React.MouseEvent) => void;
  openCall?: (e: React.MouseEvent) => void;
  shareContact?: (e: React.MouseEvent) => void;
  addFriend?: (e: React.MouseEvent) => void;
}) => {
  const { i18n, actions, openChat, openCall, shareContact, addFriend } = props;
  return (
    <div className="bottom-actions">
      <div className="bottom-div">
        <Tooltip
          title={i18n('chat')}
          placement={'top'}
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
        >
          <label className={'chat-btn'} onClick={openChat} />
        </Tooltip>
        {actions.startCall ? (
          <Tooltip
            title={i18n('call')}
            placement={'top'}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            <label className={'voice-btn'} onClick={openCall}>
              <IconCall color="var(--dst-color-icon)" />
            </label>
          </Tooltip>
        ) : null}
        {actions.shareContact ? (
          <Tooltip
            title={i18n('forward')}
            placement={'top'}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            <label className={'share-btn'} onClick={shareContact} />
          </Tooltip>
        ) : null}
        {actions.addFriend ? (
          <Tooltip
            title={i18n('addFriend.profileEntry')}
            placement={'top'}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            <label className={'add-friend-btn'} onClick={addFriend} />
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};

type ProfileInfoListType = {
  i18n: LocalizerType;
  userInfo: any;
  commonGroupNumber: number;
  onClickCommonGroups?: (e: React.MouseEvent) => void;
};

const ProfileInfoList = (props: ProfileInfoListType) => {
  const { i18n, userInfo, commonGroupNumber, onClickCommonGroups } = props;

  if (!userInfo) {
    return null;
  }

  const contactItems: Array<ProfileItemProps> = [];
  contactItems.push({
    field: 'customUid',
    title: i18n('customUid'),
    isShowCopy: false,
    isRole: false,
    isShowTip: false,
    getContent: (data: any) => data.customUid || data.uid,
  });
  contactItems.push({
    field: 'joinedAt',
    title: i18n('joined_at'),
    isShowCopy: false,
    isRole: false,
    isShowTip: false,
  });
  if (!userInfo.isMe) {
    if (userInfo.directoryUser) {
      contactItems.push({
        field: 'met',
        title: i18n('how_you_met'),
        isShowCopy: false,
        isRole: false,
        isShowTip: false,
      });
    }

    if (userInfo?.isOfficialAccount) {
      contactItems.push({
        field: 'website',
        title: i18n('website'),
        isShowCopy: false,
        renderContent: () => <a href={OFFICIAL_WEBSITE}>{OFFICIAL_WEBSITE}</a>,
      });
    } else {
      contactItems.push({
        field: 'commonGroupNumber',
        title: i18n('common_groups'),
        isShowCopy: false,
        isRole: commonGroupNumber > 0 ? true : false,
        isShowTip: commonGroupNumber > 0 ? true : false,
        isShowArrowimg: commonGroupNumber > 0 ? true : false,
        onClickArrowimg: onClickCommonGroups,
      });
    }
  }

  const profileInfo = useMemo(() => {
    return { ...userInfo, commonGroupNumber, website: OFFICIAL_WEBSITE };
  }, [userInfo, commonGroupNumber]);

  return (
    <div className="contact-info-container">
      {contactItems.map(item => {
        const content = item.getContent
          ? item.getContent(profileInfo)
          : profileInfo[item.field];

        if (content?.length || typeof content === 'number') {
          return (
            <ProfileItem
              key={item.field}
              isShowTip={!!item.isShowTip}
              isShowCopy={!!item.isShowCopy}
              isShowArrowimg={!!item.isShowArrowimg}
              title={item?.title}
              content={content}
              onCopied={() => {}}
              isRole={!!item.isRole}
              onClick={item.onClick}
              onClickArrowimg={item.onClickArrowimg}
              renderContent={item.renderContent}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export const Profile = (props: Props) => {
  const {
    i18n,
    userInfo,
    avatarPath,
    commonGroupNumber,
    onClickCommonGroups,
    actions,
    onStartCall,
    onOpenChat,
    onAddFriend,
    onShareContact,
    onEditRemarkName,
    onDeleteContact,
  } = props;
  const profileRef = useRef<HTMLDivElement>(null);
  const [remarkName, setRemarkName] = useState<string>('');
  const [editingRemarkName, setEditingRemarkName] = useState(false);
  const isMe = useMemo(() => userInfo?.isMe, [userInfo]);

  useEffect(() => {
    if (props.remarkName) {
      setRemarkName(props.remarkName);
    }
  }, [props.remarkName]);

  const stopPropagation = useMemoizedFn(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
    }
  );

  const shareContact = useMemoizedFn(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onShareContact?.(e);
  });

  const openChat = useMemoizedFn((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onOpenChat?.(e);
  });

  const remarkNameEditComplete = useMemoizedFn(
    async (textComplete: string | undefined) => {
      const text = textComplete;
      if (
        remarkName === text ||
        (!remarkName && text === userInfo?.accountName)
      ) {
        setEditingRemarkName(false);
        return;
      }

      setEditingRemarkName(false);

      try {
        const newRemarkName = (text || '').trim();

        const success = await onEditRemarkName?.(newRemarkName);
        if (!success) {
          return;
        }

        setRemarkName(newRemarkName);
      } catch (e: any) {
        console.log('edit remark name failed: ', e?.message);
        setEditingRemarkName(false);
      }
    }
  );

  const deleteContact = useMemoizedFn(async () => {
    Modal.confirm({
      title: '',
      icon: null,
      content: i18n('deleteContactConfirmation'),
      getContainer: () => {
        return profileRef.current as HTMLElement;
      },
      okButtonProps: {
        danger: true,
        ghost: true,
      },
      cancelButtonProps: {
        ghost: true,
        type: 'primary',
      },
      okText: i18n('delete'),
      cancelText: i18n('cancel'),
      onOk: onDeleteContact,
    });
  });

  const getProfileOperations = useMemoizedFn(() => {
    const operations: MenuProps['items'] = [];
    if (actions.editRemark) {
      operations.push({
        label: <span>{i18n('editContact')}</span>,
        key: 'edit-contact',
        onClick: () => {
          setEditingRemarkName(true);
        },
      });
    }
    if (actions.deleteContact) {
      operations.push({
        label: (
          <span style={{ color: 'var(--dst-color-text-error)' }}>
            {i18n('deleteContact')}
          </span>
        ),
        key: 'delete-contact',
        onClick: deleteContact,
      });
    }

    return operations;
  });

  return (
    <div
      onDoubleClick={stopPropagation}
      ref={profileRef}
      className={'profile-wrapper'}
    >
      <div className="profile-header">
        <div className="profile-avatar">
          <Avatar
            id={userInfo?.id}
            conversationType={'direct'}
            i18n={i18n}
            size={56}
            avatarPath={userInfo?.avatarPath || avatarPath}
            name={userInfo?.accountName}
            accountName={userInfo?.accountName}
            canUpload={undefined}
            canPreviewAvatar={true}
            noClickEvent={true}
          />
        </div>
        <div className="profile-name-container">
          {editingRemarkName ? (
            <AutoSizeInput
              content={remarkName || userInfo?.accountName}
              maxLength={30}
              onComplete={remarkNameEditComplete}
              className="signature-input name-input edit-remark-input"
            />
          ) : (
            <>
              <div className="profile-name">
                <span className={'profile-name-text'}>
                  {remarkName || userInfo?.accountName}
                  {userInfo?.isOfficialAccount && (
                    <IconOfficialAccount className="profile-official-account-badge" />
                  )}
                </span>
                {!isMe && (
                  <ContextMenu
                    menu={{ items: getProfileOperations() }}
                    trigger={['click']}
                    align={{
                      offset: [4, 0],
                    }}
                  >
                    <IconWrapper>
                      <div className="module-gear-icon"></div>
                    </IconWrapper>
                  </ContextMenu>
                )}
              </div>
              {userInfo?.isOfficialAccount && (
                <div className="official-account-desc">
                  {i18n('officialAccountDesc')}
                </div>
              )}
              {remarkName ? (
                <span
                  className={'profile-account-name'}
                  title={userInfo?.accountName || ''}
                >
                  {i18n('accountName')}: {userInfo?.accountName ?? null}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="profile-info-container">
        <div className="div-scroll">
          <ProfileInfoList
            i18n={i18n}
            userInfo={userInfo}
            commonGroupNumber={commonGroupNumber}
            onClickCommonGroups={onClickCommonGroups}
          ></ProfileInfoList>
        </div>
      </div>
      <BottomActions
        i18n={i18n}
        actions={actions}
        openChat={openChat}
        openCall={onStartCall}
        shareContact={shareContact}
        addFriend={onAddFriend}
      />
    </div>
  );
};
