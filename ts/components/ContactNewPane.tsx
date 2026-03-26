import React, { useState } from 'react';
import { ContactCollect } from './ContactCollect';
import { ContactSearchChangedActionType } from '../state/ducks/contactSearch';
import { ConversationType } from '../state/ducks/conversations';
import { LocalizerType } from '../types/Util';
import { trigger } from '../shims/events';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';
import { AddFriendModal } from './AddFriendModal';
import { useMemoizedFn } from 'ahooks';
import type { SidebarStatusType } from '../state/ducks/sidebar';
import { ToggleCommonSettingActionType } from '../state/ducks/layout';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  contactSearchChanged: (query: string) => ContactSearchChangedActionType;
  openConversationInternal: (id: string, messageId?: string) => void;
  sidebarStatus: SidebarStatusType;
  updateSidebarStatus: (status: SidebarStatusType) => void;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
  currentDockItem: DockItemType;
  avatarPath: string;
  toggleCommonSetting: (open?: boolean) => ToggleCommonSettingActionType;
  color: string;
};

export function ContactNewPane(props: PropsType) {
  const {
    i18n,
    contacts,
    contactSearchChanged,
    openConversationInternal,
    sidebarStatus,
    updateSidebarStatus,
    currentDockItemChanged,
    currentDockItem,
    avatarPath,
    color,
    toggleCommonSetting,
  } = props;
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);

  const clickItem = useMemoizedFn((id: string) => {
    if (id === 'group_chats') {
      trigger('showGroupChats');
    } else if (id === 'add_contact') {
      setAddContactModalVisible(true);
    } else {
      openConversationInternal(id);
      const myEvent = new Event('event-toggle-switch-chat');
      window.dispatchEvent(myEvent);
    }
  });

  const childProps = {
    i18n,
    contacts,
    setSearchText: contactSearchChanged,
    clickItem,
    isContactNewPane: true,
    isShown: currentDockItem === 'contact',
    avatarPath,
    color,
  };

  return (
    <>
      <ContactCollect
        {...childProps}
        sidebarStatus={sidebarStatus}
        updateSidebarStatus={updateSidebarStatus}
        currentDockItemChanged={currentDockItemChanged}
        currentDockItem={currentDockItem}
        toggleCommonSetting={toggleCommonSetting}
      />
      <AddFriendModal
        i18n={i18n}
        open={addContactModalVisible}
        onCancel={() => {
          setAddContactModalVisible(false);
        }}
        onComplete={() => {
          setAddContactModalVisible(false);
        }}
      />
    </>
  );
}
