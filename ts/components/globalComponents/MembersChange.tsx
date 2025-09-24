import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../types/Util';
import { ContactListItem } from '../ContactListItem';
import Dialog from '../Dialog';
import { getConversationModel } from '../../shims/Whisper';

export interface IMembersChangeProps {
  i18n: LocalizerType;
  onClose: () => void;
  onConfirm: (members: Array<string>, options: any) => void;
  type:
    | 'add-group-members'
    | 'remove-group-members'
    | 'add-group-admins'
    | 'remove-group-admins'
    | 'call-add';

  items: Array<any>;
  disabledItems?: Array<any>;
  groupName?: string;
  loading: boolean;
}

export default function MembersChange(props: IMembersChangeProps) {
  const { i18n, onClose, disabledItems } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [currentItems, setCurrentItems] = useState(props.items);
  const [rightItems, setRightItems] = useState<Array<any>>([]);
  const maxGroupNameLength = 64;

  let defaultName = '';

  const [groupName, setGroupName] = useState(defaultName);

  useEffect(() => {
    const { items } = props;
    const conversations: any = [];
    for (let i = 0; i < items.length; i += 1) {
      if (isSearchMatch(items[i], searchText)) {
        conversations.push(items[i]);
      }
    }
    setCurrentItems(conversations);
  }, [searchText]);

  const setInputFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const inputTextChanged = (event: React.FormEvent<HTMLInputElement>) => {
    setSearchText(event.currentTarget.value || '');
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

  const renderLeftRow = ({ index, style }: any): JSX.Element => {
    const conversation = currentItems[index];
    const isBot = (window as any).Signal.ID.isBotId(conversation.id);

    let checked =
      (disabledItems?.includes(conversation.id) ||
        rightItems.includes(conversation.id)) &&
      !isBot;

    if (['remove-group-members', 'remove-group-admins'].includes(props.type)) {
      const isMe = getConversationModel(conversation.id)?.isMe?.();
      checked = checked && !isMe;
    }

    const disabled = disabledItems?.includes(conversation.id) || isBot;

    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        style={style}
        onClick={() => {
          if (disabled) {
            return;
          }

          // 不允许临时会议邀请敏感用户
          if (props.type === 'call-add') {
            let forbidArray = ['609066'];

            for (let i = 0; i < forbidArray.length; i += 1) {
              if (conversation.id.endsWith(forbidArray[i])) {
                alert('You are not authorized to invite this user.');
                return;
              }
            }
          }

          // 已选中
          if (rightItems.includes(conversation.id)) {
            for (let i = 0; i < rightItems.length; i += 1) {
              if (rightItems[i] === conversation.id) {
                rightItems.splice(i, 1);
                break;
              }
            }
            setRightItems([...rightItems]);
          } else {
            // 未选中
            setRightItems([...rightItems, conversation.id]);
          }
          if (inputRef.current?.value) {
            inputRef.current.value = '';
            setSearchText('');
            setTimeout(() => {
              setInputFocus();
            }, 0);
          }
        }}
        withCheckbox={true}
        checkboxChecked={checked}
        disableCheckbox={disabled}
      />
    );
  };

  const renderRightRow = ({ index, style }: any): JSX.Element => {
    const { items } = props;
    const id = rightItems[index];
    let conversation: any;
    for (let i = 0; i < items.length; i += 1) {
      if (id === items[i].id) {
        conversation = items[i];
        break;
      }
    }
    if (!conversation) {
      throw Error('Bad right items.');
    }

    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        style={style}
        onClick={() => {
          for (let i = 0; i < rightItems.length; i += 1) {
            if (rightItems[i] === conversation.id) {
              rightItems.splice(i, 1);
              break;
            }
          }
          setRightItems([...rightItems]);
        }}
      />
    );
  };

  const renderLeftList = () => {
    return (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={0}
        style={{ height: '376px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={currentItems}
              height={height}
              rowCount={currentItems.length}
              rowHeight={56}
              rowRenderer={renderLeftRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderRightList = () => {
    return (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={1}
        style={{ height: '440px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={rightItems}
              height={height}
              rowCount={rightItems.length}
              rowHeight={56}
              rowRenderer={renderRightRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderInput = () => {
    if (!defaultName) {
      return null;
    }

    return (
      <div className={'name-container universal-modal-top-input'}>
        <span className="universal-modal-top-input__text">{i18n('name')}</span>
        <input
          className="universal-modal-top-input__input"
          defaultValue={defaultName}
          maxLength={maxGroupNameLength}
          onChange={event => {
            let text = event.target.value?.trim();
            if (text && text.length > maxGroupNameLength) {
              text = text.substr(0, maxGroupNameLength);
            }
            setGroupName(text);
          }}
        />
      </div>
    );
  };

  const renderMiddle = () => {
    return (
      <div style={{ width: '603px', height: '442px', borderRadius: '4px' }}>
        <div className={classNames('universal-modal-left')}>
          <div
            className="module-main-header__search"
            style={{ margin: '16px' }}
          >
            <div
              role="button"
              className="module-main-header__search__icon"
              onClick={setInputFocus}
            />
            <input
              type="text"
              ref={inputRef}
              className="module-main-header__search__input"
              style={{ width: '100%' }}
              placeholder={i18n('search')}
              dir="auto"
              onChange={inputTextChanged}
              spellCheck={false}
            />
            {searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={() => {
                  setSearchText('');
                  if (inputRef.current) {
                    inputRef.current.value = '';
                  }
                }}
              />
            ) : null}
          </div>
          {currentItems && currentItems.length ? (
            renderLeftList()
          ) : (
            <div style={{ textAlign: 'center', marginTop: '5px' }}>
              {i18n('noSearchResults', [searchText])}
            </div>
          )}
        </div>
        <div className="universal-modal-right">{renderRightList()}</div>
      </div>
    );
  };

  let okButtonDisabled = rightItems.length === 0;
  let title;
  if (props.type === 'add-group-members') {
    title = i18n('group_editor_add_group_members_title');
  }
  if (props.type === 'remove-group-members') {
    title = i18n('group_editor_remove_group_members');
  }
  if (props.type === 'add-group-admins') {
    title = i18n('group_editor_add_group_moderator');
  }
  if (props.type === 'remove-group-admins') {
    title = i18n('group_editor_remove_group_moderator');
  }
  if (props.type === 'call-add') {
    title = i18n('call.AddMembers');
  }

  const renderFullLoading = () => {
    if (!props.loading) {
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
          zIndex: 200,
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

  return (
    <Dialog onClose={onClose} escClose={!props.loading}>
      <div className="settings-members-change-dialog">
        <h3>{title}</h3>
        {renderInput()}
        {renderMiddle()}
        <div style={{ textAlign: 'right' }} className="universal-modal-footer">
          <button onClick={onClose} className="button-default">
            {i18n('cancel')}
          </button>
          <button
            disabled={okButtonDisabled}
            className={`button-primary ${
              okButtonDisabled ? ' button-disabled' : ''
            }`}
            onClick={() => {
              props.onConfirm(rightItems, { groupName });
            }}
          >
            {i18n('confirmNumber', ['' + (rightItems.length || '')])}
          </button>
        </div>
        {renderFullLoading()}
      </div>
    </Dialog>
  );
}
