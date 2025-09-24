import React, { useEffect, useState, useRef } from 'react';
import { ContactListItem } from '../../ContactListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../../types/Util';
import { trigger } from '../../../shims/events';
import { isLinux } from '../../../OS';
import { ConversationListItem } from '../../ConversationListItem';

type PropsType = {
  i18n: LocalizerType;
  members: Array<any>;
  transferGroupOwner?: (id: string) => void;
  isCommonGroups?: boolean;
};

export default function GroupMemberList(props: PropsType) {
  const { i18n, members, transferGroupOwner, isCommonGroups } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);
  const [searchText, setSearchText] = useState('');
  const [filterMembers, setFilterMembers] = useState<Array<any>>(members);
  const [oldSecondLabelIndex, setOldSecondLabelIndex] = useState(-1);

  const dealMembers = (members: any) => {
    if (isCommonGroups) {
      setFilterMembers(members);
      return;
    }

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

  // 强制刷新label元素高度
  useEffect(() => {
    if (
      oldSecondLabelIndex >= 0 &&
      oldSecondLabelIndex < filterMembers.length
    ) {
      listRef.current?.recomputeRowHeights(oldSecondLabelIndex);
    }
    for (let i = 0; i < filterMembers.length; i += 1) {
      if (filterMembers[i].shouldRecomputeHeight) {
        listRef.current?.recomputeRowHeights(i);
        setOldSecondLabelIndex(i);
        break;
      }
    }
  }, [filterMembers]);

  const renderRow = ({ index, style }: any): JSX.Element => {
    const c = filterMembers[index];
    if (c.isLabel) {
      return (
        <div key={index} style={style} className={'label-container'}>
          {c.name}
        </div>
      );
    }

    if (isCommonGroups) {
      return (
        <ConversationListItem
          key={c.id}
          {...c}
          isStick={undefined}
          onClick={() => {
            trigger('showConversation', c.id);
            const myEvent = new Event('event-toggle-switch-chat');
            window.dispatchEvent(myEvent);
          }}
          style={{
            ...style,
            maxWidth: '100%',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
          i18n={i18n}
          isMyGroup={true}
          showMembersPreview={true}
        />
      );
    }

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
        onClick={async (event: any) => {
          if (event && event.button === 2) {
            return;
          }

          if (transferGroupOwner) {
            if ((window as any).Signal.ID.isBotId(c.id)) {
              alert(i18n('conversation_settings_group_transfer_bot'));
              return;
            }
            const confirmText = i18n('transferOwnerOfTheGroup', [
              c.name || c.id,
            ]);

            if (isLinux()) {
              if (await (window as any).whisperConfirm(confirmText)) {
                transferGroupOwner(c.id);
              }
            } else {
              if (confirm(confirmText)) {
                transferGroupOwner(c.id);
              }
            }

            return;
          }
          trigger('showConversation', c.id);
          const myEvent = new Event('event-toggle-switch-chat');
          window.dispatchEvent(myEvent);
        }}
      />
    );
  };

  const handleChange = (event: any) => {
    const { value: search } = event.target;
    setSearchText(search);
  };

  const isSearchMatch = (c: any, searchTerm: string) => {
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
  };

  const clearSearch = () => {
    setSearchText('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const rowHeight = ({ index }: any) => {
    if (filterMembers[index].isLabel) {
      return 20;
    }
    return 58;
  };

  return (
    <div
      className={'select-contact-smaller-dialog'}
      style={{
        width: '100%',
        height: 'calc(100% - 58px)',
        fontSize: '13px',
        userSelect: 'none',
      }}
    >
      <div style={{ width: '100%', height: '100%', float: 'left' }}>
        <div className="module-main-header" style={{ width: '100%' }}>
          <div className="module-main-header__search" style={{ width: '100%' }}>
            <div role="button" className="module-main-header__search__icon" />
            <input
              style={{ width: '100%' }}
              type="text"
              ref={inputRef}
              className={
                'module-main-header__search__input select-contact-smaller-input input-background'
              }
              placeholder={props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={handleChange}
              // onBlur={this.blurSearchInput}
              spellCheck={false}
            />
            {searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={clearSearch}
              />
            ) : null}
          </div>
        </div>
        {filterMembers.length ? (
          <div className={'member-list-container'}>
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
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '5px' }}>
            {i18n('noSearchResults', [searchText])}
          </div>
        )}
      </div>
    </div>
  );
}
