import React, { useEffect, useState, useRef } from 'react';
import { ContactListItem } from './ContactListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';

type PropsType = {
  i18n: LocalizerType;
  selectedMembers: Array<ConversationType>;
  members: Array<ConversationType>;
  addItem: (id: string) => void;
  removeItem: (id: string) => void;
  onClose: () => void;
};

export default function SelectContactSmaller(props: PropsType) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);
  const [searchText, setSearchText] = useState('');
  const [filterMembers, setFilterMembers] = useState<Array<ConversationType>>(
    []
  );
  const { i18n, members, selectedMembers } = props;

  const handleClickOutside = (event: MouseEvent) => {
    if (
      event &&
      wrapperRef.current &&
      !wrapperRef.current.contains(event.target as Node)
    ) {
      props.onClose();
    }
  };

  // https://stackoverflow.com/questions/32553158/detect-click-outside-react-component
  useEffect(() => {
    inputRef.current?.focus();
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!searchText) {
      setFilterMembers(members);
    } else {
      const f = [];
      for (let i = 0; i < members.length; i += 1) {
        if (isSearchMatch(members[i], searchText)) {
          f.push(members[i]);
        }
      }
      setFilterMembers(f);
    }
  }, [members, searchText]);

  const renderLeftRow = ({ index, style }: any): JSX.Element => {
    const { addItem } = props;

    const c = filterMembers[index];

    return (
      <ContactListItem
        key={index}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={c.isMe}
        name={c.name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={(c as any).email}
        i18n={props.i18n}
        notShowStatus={true}
        onClick={() => {
          // 黑魔法临时解决问题（问题：点击item框消失的BUG）
          setTimeout(() => {
            addItem(c.id);
          }, 0);
        }}
      />
    );
  };

  const renderRightRow = ({ index, style }: any): JSX.Element => {
    const { selectedMembers, removeItem } = props;

    const c = selectedMembers[index];

    return (
      <ContactListItem
        key={index}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={c.isMe}
        name={c.name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={(c as any).email}
        i18n={props.i18n}
        notShowStatus={true}
        onClick={() => {
          // 黑魔法临时解决问题（问题：点击item框消失的BUG）
          setTimeout(() => {
            removeItem(c.id);
          }, 0);
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

  return (
    <div
      ref={wrapperRef}
      className={'select-contact-smaller-dialog'}
      style={{
        width: '481px',
        height: '400px',
        fontSize: '13px',
        userSelect: 'none',
      }}
    >
      <div style={{ width: '240px', height: '100%', float: 'left' }}>
        <div className="module-main-header">
          <div className="module-main-header__search">
            <div role="button" className="module-main-header__search__icon" />
            <input
              style={{ width: '210px' }}
              type="text"
              ref={inputRef}
              className={
                'module-main-header__search__input select-contact-smaller-input'
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
          <div style={{ height: 'calc(100% - 58px)', overflow: 'auto' }}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  ref={listRef}
                  className="module-left-pane__virtual-list"
                  height={height}
                  rowCount={filterMembers.length}
                  rowRenderer={renderLeftRow}
                  rowHeight={58}
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
      <div
        style={{
          width: '241px',
          height: '100%',
          display: 'inline-block',
          borderLeft: '1px solid #e8e8e8',
        }}
      >
        <div style={{ height: '100%', overflow: 'auto' }}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                className="module-left-pane__virtual-list"
                height={height}
                rowCount={selectedMembers.length}
                rowRenderer={renderRightRow}
                rowHeight={58}
                width={width}
                rerenderWhenChanged={selectedMembers}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    </div>
  );
}
