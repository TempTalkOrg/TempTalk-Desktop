import React, { useEffect, useRef, useState } from 'react';

import { LocalizerType } from '../types/Util';
import { IconWrapper } from './shared/IconWrapper';
import { IconClearCircle, IconSearch } from './shared/icons';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import { QuickEntry } from './QuickEntry';

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
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocusSearch, setIsFocusSearch] = useState(false);
  const [navStatus, setNavStatus] = useState({
    goBackEnabled: false,
    goForwardEnabled: false,
  });

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
  });

  const handleConversationSwitchEnabled = useMemoizedFn((event: any) => {
    const { goBackEnabled, goForwardEnabled } = event?.detail || {};
    setNavStatus({
      goBackEnabled,
      goForwardEnabled,
    });
  });

  useEffect(() => {
    window.addEventListener('open-conversation', handleOpenConversation);
    window.addEventListener(
      'conversation-switch-enabled',
      handleConversationSwitchEnabled
    );

    return () => {
      window.removeEventListener('open-conversation', handleOpenConversation);
      window.removeEventListener(
        'conversation-switch-enabled',
        handleConversationSwitchEnabled
      );
    };
  }, []);

  useEffect(() => {
    const { goBackEnabled, goForwardEnabled } =
      (window as any).getConversationSwitchStatus() || {};
    setNavStatus({
      goBackEnabled,
      goForwardEnabled,
    });
  }, []);

  return (
    <div className="module-main-header">
      <div className="module-main-header__search">
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
      {!isFocusSearch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <IconWrapper>
            <div
              className={
                navStatus.goBackEnabled
                  ? 'conversation-back'
                  : 'conversation-back-disable'
              }
              onClick={() => {
                (window as any).conversationGoBack();
              }}
            />
          </IconWrapper>
          <IconWrapper>
            <div
              className={
                navStatus.goForwardEnabled
                  ? 'conversation-forward'
                  : 'conversation-forward-disable'
              }
              onClick={() => {
                (window as any).conversationGoForward();
              }}
            />
          </IconWrapper>
          <QuickEntry i18n={i18n} />
        </div>
      )}
    </div>
  );
};
