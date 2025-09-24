import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../types/Util';
import { ContactListItem } from '../ContactListItem';
import Dialog from '../Dialog';

export interface ICreateGroupProps {
  i18n: LocalizerType;
  onClose: () => void;
  onConfirm: (members: Array<string>, options: any) => void;
  type: 'new-group' | 'quick-group' | 'group-quick-group';
  items: Array<any>;
  disabledItems?: Array<any>;
  groupName?: string;
  loading?: boolean;
}

import { Spin } from 'antd';

export default function CreateGroup(props: ICreateGroupProps) {
  const { i18n, onClose, disabledItems } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [currentItems, setCurrentItems] = useState(props.items);
  const [rightItems, setRightItems] = useState<Array<any>>([]);
  const maxGroupNameLength = 64;
  const [loading, setLoading] = useState(false);

  let defaultName = '';
  if (props.type === 'new-group') {
    defaultName = i18n('new_group');
  }

  if (props.type === 'quick-group') {
    defaultName = 'Quick Group';
    if (props.disabledItems && props.disabledItems.length === 2) {
      for (let i = 0; i < props.items.length; i++) {
        if (props.items[i].id === props.disabledItems[0]) {
          defaultName = props.items[i].accountName + ', ';
        }
        if (props.items[i].id === props.disabledItems[1]) {
          defaultName += props.items[i].accountName;
          break;
        }
      }
    }
  }
  if (props.type === 'group-quick-group') {
    const existsGroupName = props.groupName || '';
    defaultName = i18n('group_editor_title_template_for_quick_group', [
      existsGroupName,
    ]);

    const nameLen = defaultName.length;
    if (nameLen > 64) {
      const keptLen = 2 * existsGroupName.length - nameLen;
      defaultName = i18n('group_editor_title_template_for_quick_group', [
        existsGroupName.substring(0, keptLen - 3) + '...',
      ]);
    }
  }

  const [groupName, setGroupName] = useState(defaultName);

  useEffect(() => {
    const { items } = props;
    const conversations: any = [];

    for (let i = 0; i < items.length; i += 1) {
      if (isSearchMatch(items[i], searchText)) {
        conversations.push(items[i]);
      }
    }

    setLoading(false);
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

    const checked =
      (disabledItems?.includes(conversation.id) ||
        rightItems.includes(conversation.id)) &&
      !isBot;

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
        }}
        withCheckbox={true}
        checkboxChecked={checked}
        disableCheckbox={disabled}
        isCreateGroup={true}
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
          if (disabledItems?.includes(conversation.id)) {
            return;
          }
          for (let i = 0; i < rightItems.length; i += 1) {
            if (rightItems[i] === conversation.id) {
              rightItems.splice(i, 1);
              break;
            }
          }
          setRightItems([...rightItems]);
        }}
        isCreateGroup={true}
      />
    );
  };

  const renderLeftList = () => {
    return (
      <div
        className={classNames(
          'module-left-pane__list',
          'scroll-background-create-group'
        )}
        key={0}
        style={{ height: '366px' }}
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
        className={classNames(
          'module-left-pane__list',
          'scroll-background-create-group'
        )}
        key={1}
        style={{ height: '386px' }}
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
      <div className={'create-group-name-container'}>
        <p className={'label'}>{i18n('name')}</p>
        <input
          className={'name-input'}
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

  const handleDragMainContainer = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  const renderMainContainer = () => {
    return (
      <div
        className={classNames('select-container')}
        onDragStart={handleDragMainContainer}
      >
        <div
          className={classNames('list-container')}
          style={{ marginRight: '16px', marginLeft: '5px' }}
        >
          <div className="search-container">
            <div
              role="button"
              className="search-icon"
              onClick={setInputFocus}
            />
            <input
              type="text"
              ref={inputRef}
              className="search-input"
              placeholder={i18n('search')}
              dir="auto"
              onChange={inputTextChanged}
              spellCheck={false}
            />
            {searchText && (
              <div
                id={'clear-search-icon'}
                role="button"
                className="clear-search-icon"
                onClick={() => {
                  setSearchText('');
                  setInputFocus();
                  if (inputRef.current) {
                    inputRef.current.value = '';
                  }
                }}
              />
            )}
          </div>
          {!loading &&
            currentItems &&
            (currentItems.length ? renderLeftList() : renderNoResult())}
          {loading && renderLoading()}
        </div>
        <div className={classNames('list-container')}>
          <div className={'selected-members'}>{i18n('selected-members')}</div>
          {renderRightList()}
        </div>
      </div>
    );
  };

  const renderLoading = () => {
    return (
      <div className={'loading-box'}>
        <div className={'loading-item'}>
          <Spin />
          <p className={'loading-label'}>Loading...</p>
        </div>
      </div>
    );
  };

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

  const renderNoResult = () => {
    const { i18n } = props;

    return (
      <div className={'common-noresult'}>
        {i18n('noSearchResults', [searchText])}
      </div>
    );
  };

  useEffect(() => {
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, []);
  const handleClick = (event: MouseEvent) => {
    if (event) {
      // 点击输入框（获取焦点），其他的列表都应该消失， 然后根据当前选择的条件来判断该显示哪个列表
      if (inputRef.current && inputRef.current.contains(event.target as Node)) {
        return;
      }

      // 点击清除输入条件的按钮，会清空输入内容，然后焦点重新聚集到输入框，这边根据当前的条件显示对应的list即可。这边不用 ref 的方式，因为清除后按钮会消失，取不到
      if ((event.target as HTMLDivElement).id === 'clear-search-icon') {
        return;
      }
    }
  };

  let okButtonDisabled = rightItems.length === 0;
  let title;
  if (props.type === 'new-group' || props.type === 'quick-group') {
    title = i18n('group_editor_create_new_group');
  }
  if (props.type === 'quick-group') {
    okButtonDisabled = false;
  }
  if (props.type === 'group-quick-group') {
    title = i18n('group_editor_dialog_title_for_quick_group');
    okButtonDisabled = false;
  }
  return (
    <Dialog onClose={onClose} escClose={!props.loading}>
      <div className="settings-members-change-dialog-create-group">
        <div className={'header'}>
          <h3 className={'title'}>{title}</h3>
          <div onClick={onClose} className={'close'} />
        </div>
        {renderInput()}
        {renderMainContainer()}
        <div style={{ textAlign: 'right' }}>
          <button className={'btn-white'} onClick={onClose}>
            {i18n('cancel')}
          </button>
          <button
            disabled={okButtonDisabled}
            className={classNames(
              'btn-blue',
              !okButtonDisabled ? 'btn-blue-able' : 'btn-blue-disable'
            )}
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
