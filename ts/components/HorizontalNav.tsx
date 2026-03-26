import React, {
  forwardRef,
  Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { LocalizerType } from '../types/Util';
import { useMemoizedFn } from 'ahooks';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';
import { Avatar } from './Avatar';
import {
  IconTabConversationActive,
  IconTabConversation,
  IconTabContactActive,
  IconTabContact,
  IconSidebarLayout,
  IconSearch,
  IconClose,
} from './shared/icons';
import { IconWrapper } from './shared/IconWrapper';
import { QuickEntry } from './QuickEntry';
import { Input } from 'antd';
import type { GetRef } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ReactDOM from 'react-dom';
import { SidebarStatusType } from '../state/ducks/sidebar';
import { ToggleCommonSettingActionType } from '../state/ducks/layout';

type InputRef = GetRef<typeof Input>;

export interface MiniMainMenuProps {
  id?: string;
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;

  i18n: LocalizerType;
  currentDockItem: DockItemType;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
  toggleCommonSetting: (open?: boolean) => ToggleCommonSettingActionType;
}

const MiniMainMenu = (props: MiniMainMenuProps) => {
  const {
    avatarPath,
    i18n,
    color,
    name,
    profileName,
    id,
    currentDockItem,
    currentDockItemChanged,
    toggleCommonSetting,
  } = props;

  const switchTab = useMemoizedFn((tab: DockItemType) => {
    if (currentDockItem === tab) return;

    // chat
    const gutter = document.getElementsByClassName('gutter')[0] as any;
    const conversationStack = document.getElementsByClassName(
      'conversation-stack'
    )[0] as any;

    const contactColumn = document.getElementsByClassName(
      'contact-column'
    )[0] as any;

    toggleCommonSetting(false);

    if (tab === 'chat') {
      // chat
      gutter.style.display = 'block';
      conversationStack.style.display = 'block';

      contactColumn.style.display = 'none';

      currentDockItemChanged('chat');
    } else if (tab === 'contact') {
      gutter.style.display = 'none';
      conversationStack.style.display = 'none';

      contactColumn.style.display = 'flex';

      currentDockItemChanged('contact');
    }

    currentDockItemChanged(tab);
  });

  return (
    <div className="mini-main-menu">
      <div className="menu-divider"></div>
      <Avatar
        className="mini-main-menu-item"
        id={id}
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        profileName={profileName}
        size={20}
        noClickEvent={true}
        fromMainTab={true}
        onClickAvatar={() => {
          toggleCommonSetting();
        }}
      />
      <div className="mini-main-menu-item" onClick={() => switchTab('chat')}>
        {currentDockItem === 'chat' ? (
          <IconTabConversationActive />
        ) : (
          <IconTabConversation />
        )}
      </div>
      <div className="mini-main-menu-item" onClick={() => switchTab('contact')}>
        {currentDockItem === 'contact' ? (
          <IconTabContactActive />
        ) : (
          <IconTabContact />
        )}
      </div>
      <div className="menu-divider"></div>
    </div>
  );
};

export interface Props {
  // For display
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;

  i18n: LocalizerType;
  updateSidebarStatus: (status: SidebarStatusType) => void;
  currentDockItem: DockItemType;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
  onSearchFocus?: () => void;
  onExitSearchMode?: () => void;
  onSearchTextChange?: (searchText: string) => void;
  toggleCommonSetting: (open?: boolean) => ToggleCommonSettingActionType;
}

export interface HorizontalNavRef {
  exitSearchMode: () => void;
}

export const HorizontalNav = forwardRef<HorizontalNavRef, Props>(
  (props: Props, ref: Ref<HorizontalNavRef>) => {
    const {
      updateSidebarStatus,
      onSearchFocus,
      onExitSearchMode,
      onSearchTextChange,
      i18n,
      toggleCommonSetting,
    } = props;
    const [mode, setMode] = useState<'menu' | 'search'>('menu');

    const [searchText, setSearchText] = useState('');
    const searchInputRef = useRef<InputRef>(null);
    const onChangeSearchText = useMemoizedFn(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
        onSearchTextChange?.(e.target.value);
      }
    );

    const enterSearchMode = useMemoizedFn(() => {
      ReactDOM.flushSync(() => {
        setMode('search');
      });
      toggleCommonSetting(false);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    });

    const exitSearchMode = useMemoizedFn(() => {
      setMode('menu');
      onExitSearchMode?.();
    });

    const onFocus = useMemoizedFn(() => {
      if (!searchText) {
        onSearchFocus?.();
      }
    });

    useEffect(() => {
      if (mode !== 'search') {
        setSearchText('');
      }
    }, [mode]);

    useImperativeHandle(ref, () => ({
      exitSearchMode,
    }));

    return (
      <div className="module-horizontal-nav">
        {mode === 'menu' && (
          <>
            <IconWrapper
              className="sidebar-layout-icon"
              onClick={updateSidebarStatus}
            >
              <IconSidebarLayout />
            </IconWrapper>
            <MiniMainMenu {...props} />
            <IconWrapper className="search-entry" onClick={enterSearchMode}>
              <IconSearch className="search-entry-icon" />
            </IconWrapper>
            <QuickEntry i18n={i18n} />
          </>
        )}
        {mode === 'search' && (
          <div className="search-view">
            <Input
              ref={searchInputRef}
              value={searchText}
              onChange={onChangeSearchText}
              placeholder="Search"
              prefix={
                <SearchOutlined
                  style={{ color: 'var(--dst-color-text-third)' }}
                />
              }
              className="universal-input search-input"
              onFocus={onFocus}
            />
            <IconWrapper>
              <IconClose
                className="search-close-icon"
                onClick={exitSearchMode}
              />
            </IconWrapper>
          </div>
        )}
      </div>
    );
  }
);
