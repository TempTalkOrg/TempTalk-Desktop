import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { ContactListItem } from './ContactListItem';
import { AutoSizer, List, ScrollParams } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { IconClearCircle, IconSearch, IconSidebarLayout } from './shared/icons';
import { useMemoizedFn } from 'ahooks';
import type { SidebarStatusType } from '../state/ducks/sidebar';
import { HorizontalNav } from './HorizontalNav';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';
import { ToggleCommonSettingActionType } from '../state/ducks/layout';
import { IconWrapper } from './shared/IconWrapper';

type PropsType = {
  i18n: LocalizerType;
  contacts: Array<ConversationType>;
  setSearchText: (query: string) => void;
  clickItem: (id: string) => void;
  isContactNewPane?: boolean;
  isShown: boolean;
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

export const ContactCollect = (props: PropsType) => {
  const {
    i18n,
    clickItem,
    isContactNewPane,
    contacts,
    sidebarStatus,
    updateSidebarStatus,
    currentDockItemChanged,
    currentDockItem,
    avatarPath,
    color,
    toggleCommonSetting,
  } = props;

  const [searchText, setSearchText] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [externItems] = useState(3);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);

  const searching = Boolean(searchText && searchText.length > 0);

  const handleChange = useMemoizedFn(event => {
    const { value: search } = event.target;

    props.setSearchText?.(search);
    setSearchText(search);
  });

  const onSearchTextChange = useMemoizedFn((search: string) => {
    props.setSearchText?.(search);
    setSearchText(search);
  });

  const clearSearch = useMemoizedFn(() => {
    props.setSearchText?.('');
    setSearchText('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  });

  const getRowHeight = useMemoizedFn(({ index }) => {
    if (!searching && index === externItems - 1) {
      return 2;
    } else {
      return searching ? 76 : 56;
    }
  });

  const [selectedId, setSelectedId] = useState(-1);

  const renderRow = useMemoizedFn(({ index, style }) => {
    if (!searching) {
      if (index === 0) {
        return (
          <ContactListItem
            key={'add_contact'}
            style={style}
            phoneNumber={''}
            name={i18n('main_header_add_contact')}
            description={i18n('main_header_add_contact_description')}
            color={'group-white'}
            avatarPath={''}
            i18n={i18n}
            onClick={() => {
              clickItem('add_contact');
            }}
            addContact={true}
            isContactNewPane={isContactNewPane}
          />
        );
      } else if (index === 1) {
        return (
          <ContactListItem
            key={'group_chats'}
            style={style}
            phoneNumber={''}
            name={i18n('groupChatsTitle')}
            color={'group-white'}
            avatarPath={''}
            i18n={i18n}
            onClick={() => {
              clickItem('group_chats');
              setSelectedId(1);
            }}
            groupChats={true}
            isContactNewPane={isContactNewPane}
            isSelected={selectedId === 1}
          />
        );
      } else if (index === 2) {
        return (
          <div
            key={'contacts-title'}
            className="module-left-pane__contact-list-title"
            style={style}
          ></div>
        );
      } else {
        index = index - externItems;
      }
    }
    const c: any = contacts[index];

    return (
      <ContactListItem
        key={c.id}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={false}
        name={c.name}
        color={c.color}
        profileName={c.profileName}
        avatarPath={c.avatarPath}
        accountName={c.accountName}
        i18n={i18n}
        onClick={() => {
          clickItem(c.id);
          setSelectedId(-1);
        }}
        useDefaultAvatarClick={true}
        email={c.email}
        signature={c.signature}
        protectedConfigs={c.protectedConfigs}
        firstMatch={c.firstMatch}
        showExtraInfo={searching}
        timeZone={c.timeZone}
        isContactNewPane={isContactNewPane}
        isSelected={false}
        isOfficialAccount={c.isOfficialAccount}
      />
    );
  });

  const noRowsRender = useMemoizedFn(() => {
    return (
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        {i18n('noSearchResults', [searchText])}
      </div>
    );
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.recomputeRowHeights(1);
    }
  }, [searchText]);

  useEffect(() => {
    if (currentDockItem !== 'contact') {
      onSearchTextChange('');
    }
  }, [currentDockItem]);

  const [searchFocus, setSearchFocus] = useState(false);

  const onSearchFocus = useMemoizedFn(() => {
    setSearchFocus(true);
  });

  const onSearchBlur = useMemoizedFn(() => {
    setSearchFocus(false);
  });

  if (!props.isShown) {
    return null;
  }

  const topStyle = { height: '100%' };
  const bodyStyle: CSSProperties = {
    height: 'calc(100% - 58px)',
    overflow: 'auto',
    overflowX: 'hidden',
  };

  let contactLen = contacts ? contacts.length + externItems : externItems;
  if (searching) {
    contactLen = contactLen - externItems;
  }

  return (
    <div style={topStyle}>
      <div className="module-main-header">
        {sidebarStatus === 'expanded' && (
          <div className="module-main-header-container">
            {!searchFocus && (
              <IconWrapper
                className="sidebar-layout-icon"
                onClick={updateSidebarStatus}
              >
                <IconSidebarLayout />
              </IconWrapper>
            )}
            <div className="module-main-header__search contact-collect-search">
              <IconSearch className="module-search-icon" />
              <input
                type="text"
                ref={inputRef}
                className="module-main-header__search__input_contact"
                placeholder={i18n('search')}
                dir="auto"
                value={searchText}
                onChange={handleChange}
                spellCheck={false}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
              />
              {searchText ? (
                <IconClearCircle
                  className="module-main-header__search__cancel-icon"
                  onClick={clearSearch}
                />
              ) : null}
            </div>
          </div>
        )}
        {sidebarStatus === 'collapsed' && (
          <HorizontalNav
            i18n={i18n}
            updateSidebarStatus={updateSidebarStatus}
            currentDockItemChanged={currentDockItemChanged}
            currentDockItem={currentDockItem}
            onSearchTextChange={onSearchTextChange}
            onExitSearchMode={() => onSearchTextChange('')}
            avatarPath={avatarPath}
            toggleCommonSetting={toggleCommonSetting}
            color={color}
          />
        )}
      </div>
      <div style={bodyStyle}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={contactLen}
              rowHeight={getRowHeight}
              rowRenderer={renderRow}
              width={width}
              noRowsRenderer={noRowsRender}
              rerenderWhenChanged={contacts}
              onScroll={({ scrollTop }: ScrollParams) =>
                setScrollTop(scrollTop)
              }
              scrollTop={scrollTop}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
};
