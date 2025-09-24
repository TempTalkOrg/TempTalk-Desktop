import React from 'react';
import { debounce } from 'lodash';
// import { Avatar } from './Avatar';

// import {cleanSearchTerm} from '../util/cleanSearchTerm';
import { LocalizerType } from '../types/Util';
import { IconWrapper } from './shared/IconWrapper';
import { ConfigProvider } from 'antd';
import { ContextMenu } from './shared/ContextMenu';
import { AddFriendModal } from './AddFriendModal';

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

type State = {
  goForwardEnabled: boolean;
  goBackEnabled: boolean;
  isFocusSearch: boolean;
  addFriendModalOpen: boolean;
};

const EmptyMagicString = '{3F29C7A4-E6C8-0FFF-3D56-6283CFD58EB6}';
export class MainHeader extends React.Component<Props, State> {
  private readonly doUpdateSearchBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;
  private readonly doClearSearchBound: () => void;
  private readonly handleKeyUpBound: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  private readonly setFocusBound: () => void;
  private readonly getFocusBound: () => void;
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  private readonly debouncedSearch: (searchTerm: string) => void;
  private readonly clearSearchNextTickBound: () => void;

  constructor(props: Props) {
    super(props);
    this.clearSearchNextTickBound = this.clearSearchNextTick.bind(this);
    this.doUpdateSearchBound = this.doUpdateSearch.bind(this);
    this.doClearSearchBound = this.doClearSearch.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.getFocusBound = this.getFocus.bind(this);
    this.inputRef = React.createRef();
    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.showAddFriendModal = this.showAddFriendModal.bind(this);
    this.state = {
      goForwardEnabled: false,
      goBackEnabled: false,
      isFocusSearch: false,
      addFriendModalOpen: false,
    };
  }

  public search() {
    const { searchTerm, search, i18n, ourNumber, regionCode } = this.props;
    if (search) {
      search(searchTerm, {
        noteToSelf: i18n('noteToSelf'),
        ourNumber,
        regionCode,
      });
    }
  }

  public doUpdateSearch(event: React.FormEvent<HTMLInputElement>) {
    const { updateSearchTerm } = this.props;
    const searchTerm = event.currentTarget.value;
    if (!searchTerm) {
      this.doClearSearch();
      this.setState({ isFocusSearch: true });
      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 1) {
      return;
    }

    // const cleanedTerm = cleanSearchTerm(searchTerm);
    // if (!cleanedTerm) {
    //   return;
    // }

    this.debouncedSearch(searchTerm);
  }

  public doClearSearch() {
    const { clearSearch } = this.props;

    clearSearch();
    this.setState({ isFocusSearch: false });
  }

  public handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      this.doClearSearch();
    }
  }

  public clearSearchNextTick() {
    const { searchTerm } = this.props;
    //搜索文字不为空，则不会重置搜索结果
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    // 不好看，但好用，后期优化
    setTimeout(() => {
      this.doClearSearch();
    }, 10);
  }

  public setFocus() {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
      this.setState({ isFocusSearch: true });
    }
  }

  public getFocus() {
    this.setState({ isFocusSearch: true });
    const { searchTerm } = this.props;
    //搜索文字不为空，则不会重置搜索结果
    if (searchTerm !== '' && searchTerm !== EmptyMagicString) {
      return;
    }

    const { updateSearchTerm } = this.props;

    if (updateSearchTerm) {
      updateSearchTerm(EmptyMagicString);
    }
    this.debouncedSearch(EmptyMagicString);
  }

  public newGroup() {
    (window as any).showNewGroupWindow();
  }

  public showAddFriendModal() {
    this.setState({ addFriendModalOpen: true });
  }

  public handleOpenConversation = () => {
    this.setState({ isFocusSearch: false });
  };

  public handleConversationSwitchEnabled = (event: any) => {
    const { goBackEnabled, goForwardEnabled } = event?.detail || {};
    this.setState({
      goBackEnabled,
      goForwardEnabled,
    });
  };

  componentDidMount() {
    window.addEventListener('open-conversation', this.handleOpenConversation);
    window.addEventListener(
      'conversation-switch-enabled',
      this.handleConversationSwitchEnabled
    );
    const { goBackEnabled, goForwardEnabled } =
      (window as any).getConversationSwitchStatus() || {};
    this.setState({
      goBackEnabled,
      goForwardEnabled,
    });
  }
  componentWillUnmount() {
    window.removeEventListener(
      'open-conversation',
      this.handleOpenConversation
    );
    window.removeEventListener(
      'conversation-switch-enabled',
      this.handleConversationSwitchEnabled
    );
  }

  public getDropdownMenuItems() {
    const { i18n } = this.props;

    const items = [
      {
        key: 'create_group',
        label: (
          <div className="menu-item" onMouseDown={this.newGroup}>
            <div className={'operation'}>
              {i18n('main_header_create_group')}
            </div>
          </div>
        ),
      },
      {
        key: 'invite-friend',
        label: (
          <div className="menu-item" onMouseDown={this.showAddFriendModal}>
            <div className={'operation'}>{i18n('main_header_add_friend')}</div>
          </div>
        ),
      },
    ];

    return items;
  }

  public render() {
    const {
      searchTerm,
      // avatarPath,
      i18n,
      // ourNumber,
      // color,
      // name,
      // phoneNumber,
      // profileName,
    } = this.props;
    const { goBackEnabled, goForwardEnabled, isFocusSearch } = this.state;
    const items = this.getDropdownMenuItems();

    return (
      <div className="module-main-header">
        {/*<Avatar*/}
        {/*  avatarPath={avatarPath}*/}
        {/*  color={color}*/}
        {/*  conversationType="direct"*/}
        {/*  i18n={i18n}*/}
        {/*  name={name}*/}
        {/*  phoneNumber={phoneNumber}*/}
        {/*  profileName={profileName}*/}
        {/*  size={28}*/}
        {/*/>*/}
        <div className="module-main-header__search">
          <div
            role="button"
            className="module-main-header__search__icon"
            onClick={this.setFocusBound}
          />
          <input
            type="text"
            ref={this.inputRef}
            className="module-main-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            onKeyUp={this.handleKeyUpBound}
            value={searchTerm === EmptyMagicString ? '' : searchTerm}
            onChange={this.doUpdateSearchBound}
            onBlur={this.clearSearchNextTickBound}
            onFocus={this.getFocusBound}
            spellCheck={false}
          />
          {searchTerm && searchTerm !== EmptyMagicString ? (
            <div
              role="button"
              className="module-main-header__search__cancel-icon"
              onClick={this.doClearSearchBound}
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
                  goBackEnabled
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
                  goForwardEnabled
                    ? 'conversation-forward'
                    : 'conversation-forward-disable'
                }
                onClick={() => {
                  (window as any).conversationGoForward();
                }}
              />
            </IconWrapper>
            <ConfigProvider
              theme={{
                token: {
                  motionDurationMid: '0s',
                },
              }}
            >
              <ContextMenu
                menu={{ items }}
                trigger={['click']}
                overlayClassName="main-header-operation-menu"
                align={{ offset: [-84, 8] }}
              >
                <IconWrapper>
                  <div className="module-main-header__entry__plus-icon" />
                </IconWrapper>
              </ContextMenu>
            </ConfigProvider>
          </div>
        )}
        <AddFriendModal
          i18n={i18n}
          open={this.state.addFriendModalOpen}
          onCancel={() => this.setState({ addFriendModalOpen: false })}
          onComplete={() => this.setState({ addFriendModalOpen: false })}
        ></AddFriendModal>
      </div>
    );
  }
}
