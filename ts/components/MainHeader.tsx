import React, { useEffect, useRef, useState } from 'react';

import { LocalizerType } from '../types/Util';
import { IconWrapper } from './shared/IconWrapper';
import { IconClearCircle, IconSearch, IconSidebarLayout } from './shared/icons';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import classNames from 'classnames';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';
import { HorizontalNav, HorizontalNavRef } from './HorizontalNav';
import { QuickEntry } from './QuickEntry';
import { ToggleCommonSettingActionType } from '../state/ducks/layout';

export interface Props {
  searchTerm: string;

  // To be used as an ID
  ourNumber: string;
  regionCode: string;

  // For display
  phoneNumber: string;
  isMe: boolean;
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;

  i18n: LocalizerType;
  updateSearchTerm: (searchTerm: string) => void;
  search: (
    query: string,
    options: {
      regionCode: string;
      ourNumber: string;
      noteToSelf: string;
    }
  ) => void;
  clearSearch: () => void;
  updateSidebarStatus: (status: 'expanded' | 'collapsed') => void;
  sidebarStatus: 'expanded' | 'collapsed';
  id?: string;
  currentDockItem: DockItemType;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
  toggleCommonSetting: (open?: boolean) => ToggleCommonSettingActionType;
}

const EmptyMagicString = '{3F29C7A4-E6C8-0FFF-3D56-6283CFD58EB6}';

export const MainHeader = (props: Props) => {
  const {
    i18n,
    clearSearch,
    searchTerm,
    updateSearchTerm,
    search,
    ourNumber,
    regionCode,
    updateSidebarStatus,
    sidebarStatus,
    toggleCommonSetting,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocusSearch, setIsFocusSearch] = useState(false);
  const horizontalNavRef = useRef<HorizontalNavRef>(null);

  const setFocus = useMemoizedFn(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsFocusSearch(true);
    }
  });

  const doClearSearch = useMemoizedFn(() => {
    clearSearch();
    setIsFocusSearch(false);
  });

  const handleKeyUp = useMemoizedFn(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        doClearSearch();
      }
    }
  );

  const { run: debouncedSearch } = useDebounceFn(
    (searchTerm: string) => {
      if (search) {
        search(searchTerm, {
          noteToSelf: i18n('noteToSelf'),
          ourNumber,
          regionCode,
        });
      }
    },
    { wait: 20 }
  );

  const doUpdateSearch = useMemoizedFn(
    (event: React.FormEvent<HTMLInputElement>) => {
      const searchTerm = event.currentTarget.value;
      if (!searchTerm) {
        doClearSearch();
        setIsFocusSearch(true);
        return;
      }

      if (updateSearchTerm) {
        updateSearchTerm(searchTerm);
      }

      if (searchTerm.length < 1) {
        return;
      }

      debouncedSearch(searchTerm);
    }
  );

  const clearSearchNextTick = useMemoizedFn(() => {
    //搜索文字不为空，则不会重置搜索结果
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    setTimeout(() => {
      doClearSearch();
    }, 10);
  });

  const getFocus = useMemoizedFn(() => {
    setIsFocusSearch(true);
    //搜索文字不为空，则不会重置搜索结果
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    updateSearchTerm?.(EmptyMagicString);
    debouncedSearch(EmptyMagicString);
  });

  const handleOpenConversation = useMemoizedFn(() => {
    setIsFocusSearch(false);
    if (horizontalNavRef.current) {
      horizontalNavRef.current.exitSearchMode();
    }
  });

  const onSearchFocus = useMemoizedFn(() => {
    updateSearchTerm?.(EmptyMagicString);
    debouncedSearch(EmptyMagicString);
  });

  const onExitSearchMode = useMemoizedFn(() => {
    doClearSearch();
  });

  const onSearchTextChange = useMemoizedFn((searchText: string) => {
    updateSearchTerm?.(searchText);
    debouncedSearch(searchText);
  });

  useEffect(() => {
    window.addEventListener('open-conversation', handleOpenConversation);

    return () => {
      window.removeEventListener('open-conversation', handleOpenConversation);
    };
  }, []);

  if (sidebarStatus === 'collapsed') {
    return (
      <HorizontalNav
        {...props}
        onSearchFocus={onSearchFocus}
        onExitSearchMode={onExitSearchMode}
        onSearchTextChange={onSearchTextChange}
        toggleCommonSetting={toggleCommonSetting}
        ref={horizontalNavRef}
      />
    );
  }

  return (
    <div
      className={classNames([
        'module-main-header',
        'main-header-container',
        `sidebar-${sidebarStatus}`,
      ])}
    >
      {!isFocusSearch && (
        <IconWrapper
          className="sidebar-layout-icon"
          onClick={updateSidebarStatus}
        >
          <IconSidebarLayout />
        </IconWrapper>
      )}
      {sidebarStatus === 'expanded' ? (
        <div className="module-main-header__search main-header-search">
          <IconSearch className="module-search-icon" onClick={setFocus} />
          <input
            type="text"
            ref={inputRef}
            className="module-main-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            onKeyUp={handleKeyUp}
            value={searchTerm === EmptyMagicString ? '' : searchTerm}
            onChange={doUpdateSearch}
            onBlur={clearSearchNextTick}
            onFocus={getFocus}
            spellCheck={false}
          />
          {searchTerm && searchTerm !== EmptyMagicString ? (
            <IconClearCircle
              className="module-main-header__search__cancel-icon"
              onClick={doClearSearch}
            />
          ) : null}
        </div>
      ) : (
        <IconWrapper className="main-search-entry">
          <IconSearch onClick={setFocus} className="main-search-entry-icon" />
        </IconWrapper>
      )}
      {!isFocusSearch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <QuickEntry i18n={i18n} />
        </div>
      )}
    </div>
  );
};
