import React, { useEffect, useRef, useState } from 'react';
import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from './ConversationListItem';
import { PropsData as MessageSearchResultPropsType } from './MessageSearchResult';

import { StartHistorySearch } from './StartHistorySearch';

import { LocalizerType } from '../types/Util';
import { AutoSizer, List } from 'react-virtualized';

export type PropsData = {
  contacts: Array<ConversationListItemPropsType>;
  conversations: Array<ConversationListItemPropsType>;
  hideMessagesHeader: boolean;
  messages: Array<MessageSearchResultPropsType>;
  regionCode: string;
  searchTerm: string;
  showStartNewConversation: boolean;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  openConversation: (id: string, messageId?: string) => void;
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
};

type Props = PropsData & PropsHousekeeping;

// ref components/MainHeader.tsx, the magic string should same as ""
const EmptyMagicString = '{3F29C7A4-E6C8-0FFF-3D56-6283CFD58EB6}';
export default function SearchResults(props: Props) {
  const { conversations, contacts, i18n, openConversation, searchTerm } = props;

  const recentHeader = 'recentHeader';
  const contactsHeader = 'contactsHeader';
  const groupsHeader = 'groupsHeader';

  const listRef = useRef<List>(null);

  const [listItems, setListItems] = useState<Array<any>>([]);
  const [lastHeaderIndex, setLastHeaderIndex] = useState<Array<number>>([]);
  const [changedHeaderIndex, setChangedHeaderIndex] = useState<Array<number>>(
    []
  );

  useEffect(() => {
    const combinedItems: React.SetStateAction<any[]> = [];
    const headerIndex: React.SetStateAction<number[]> = [];

    const pushItems = (headerTitle: string, items: Array<any>) => {
      headerIndex.push(items.length);
      combinedItems.push(headerTitle);
      combinedItems.push(...items);
    };

    if (conversations.length) {
      pushItems(
        recentHeader,
        conversations.map(c => {
          return {
            ...c,
            searchResult: 'recent',
            searchResultOfRecent: true,
          };
        })
      );
    }

    if (contacts.length) {
      const privateContacts: any[] = [];
      const groupContacts: any[] = [];

      contacts.forEach(c => {
        if (c.type === 'group') {
          groupContacts.push(c);
        } else if (c.directoryUser) {
          privateContacts.push(c);
        }
      });

      if (privateContacts.length) {
        pushItems(
          contactsHeader,
          privateContacts.map(c => {
            return {
              ...c,
              searchResult: 'privateContacts',
              searchResultOfContacts: true,
            };
          })
        );
      }

      if (groupContacts.length) {
        pushItems(
          groupsHeader,
          groupContacts.map(c => {
            return {
              ...c,
              searchResult: 'groupContacts',
              searchResultOfContacts: true,
            };
          })
        );
      }
    }

    setListItems(combinedItems);
    setLastHeaderIndex(headerIndex);
    setChangedHeaderIndex([...lastHeaderIndex, ...headerIndex]);
  }, [conversations, contacts]);

  // 强制刷新label元素高度
  useEffect(() => {
    changedHeaderIndex.forEach(index => {
      listRef.current?.recomputeRowHeights(index);
    });
  }, [changedHeaderIndex]);

  const renderNoResults = () => {
    if (listItems.length) {
      return null;
    }

    // fix fake empty result
    if (searchTerm === EmptyMagicString) {
      return null;
    }

    return (
      <div className="module-search-results__no-results">
        {/* {i18n('noSearchResults', [searchTerm])} */}
        {i18n('messageSearchNoResult')}
      </div>
    );
  };

  const renderHistorySearchEntry = () => {
    return (
      <StartHistorySearch
        i18n={i18n}
        onClick={() => {
          (window as any).showLocalSearch(
            searchTerm === EmptyMagicString ? '' : searchTerm,
            ''
          );
        }}
      />
    );
  };

  const renderRow = ({ key, index, style }: any): JSX.Element => {
    const item = listItems[index];

    const itemType = typeof item;
    if (itemType === 'string') {
      return (
        <div
          key={key}
          style={style}
          className={'module-search-results__group-header'}
        >
          {i18n(item)}
        </div>
      );
    } else {
      return (
        <ConversationListItem
          key={key}
          {...item}
          onClick={id => openConversation(id)}
          i18n={i18n}
          style={style}
          searchResult
        />
      );
    }
  };

  const rowHeight = ({ index }: any) => {
    const value = listItems[index];
    if (typeof value === 'string') {
      return 36;
    }

    const contactIndex = listItems.indexOf(contactsHeader);
    const groupIndex = listItems.indexOf(groupsHeader);

    //不包含contact List
    if (contactIndex === -1) {
      return 52;
    }
    //recent set 70
    if (index < contactIndex) {
      return 70;
    }

    if (
      value.firstMatch &&
      contactIndex < index &&
      (groupIndex === -1 ? true : groupIndex > index)
    ) {
      return 70;
    }

    return 52;
  };

  const renderSearchResultList = () => {
    if (!listItems.length) {
      return null;
    }

    return (
      <div className={'module-search-result__list'}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              className="module-left-pane__virtual-list"
              height={height}
              rowCount={listItems.length}
              rowRenderer={renderRow}
              rowHeight={rowHeight}
              width={width}
              rerenderWhenChanged={listItems}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  return (
    <div className="module-search-results">
      {renderHistorySearchEntry()}
      {renderNoResults()}
      {renderSearchResultList()}
    </div>
  );
}
