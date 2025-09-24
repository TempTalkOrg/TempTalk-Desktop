import React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
  ClickEvent as ListItemClickEvent,
} from './ConversationListItem';
import { PropsData as SearchResultsProps } from './SearchResults';

import SearchResults from './SearchResults';

import { LocalizerType } from '../types/Util';
import { CallsStateType, CallType } from '../state/ducks/conversations';

import { ContactListItem } from './ContactListItem';
import ReactDOM from 'react-dom';
import { MenuProps, Popover } from 'antd';
import { ContextMenu } from './shared/ContextMenu';
import { Profile } from './commonSettings/Profile';
import { ConversationListInstantCallItem } from './ConversationListInstantCallItem';
import { getConversationModel } from '../shims/Whisper';
import { formatInstantCallName } from '../util/formatInstantCallName';

interface INotificationType {
  type: number;
  i18nKey: string;
}

export interface Props {
  conversations?: Array<ConversationListItemPropsType>;
  archivedConversations?: Array<ConversationListItemPropsType>;
  searchResults?: SearchResultsProps;
  showArchived?: boolean;
  ourNumber: any;
  calls?: CallsStateType;

  i18n: LocalizerType;

  // Action Creators
  startNewConversation: (
    query: string,
    options: { regionCode: string }
  ) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  showArchivedConversations: () => void;
  showInbox: () => void;
  deleteMessages: (id: string, type: string) => void;
  conversationLeaveGroup: (id: string) => void;
  conversationDisbandGroup: (id: string) => void;
  conversationStick: (id: string, stick: boolean) => void;
  conversationMute: (id: string, mute: boolean) => void;
  // Render Props
  renderMainHeader: () => JSX.Element;
  isArchived: boolean;
  conversationArchived: (id: string) => void;
  leftPaneWidth?: number;
}
export interface State {
  currentCheckConversation: any;
  conversationRef: any;

  currentUnreadIndex: number;
  shownUnreadIndex: number | undefined;

  contextMenuPosition?: [number, number];
  showContextMenu: boolean;
  showProfileModal: boolean;
}

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

// 群通知类型状态代码 和 i18n key 映射关系
const NOTIFICATION_TYPE = [
  {
    type: 0,
    i18nKey: 'notifyAll',
  },
  {
    type: 1,
    i18nKey: 'notifyAtMe',
  },
  {
    type: 2,
    i18nKey: 'notifyNone',
  },
];

export class LeftPane extends React.Component<Props, State> {
  public listScrollTimer: any | undefined;

  public constructor(props: Props) {
    super(props);
    // this.captureListBound = this.captureList.bind(this);
    this.listScrollTimer = 0;

    this.state = {
      currentCheckConversation: undefined,
      conversationRef: undefined,

      currentUnreadIndex: 0,
      shownUnreadIndex: undefined,

      contextMenuPosition: undefined,
      showContextMenu: false,
      showProfileModal: false,
    };
  }

  public getInstantCalls = () => {
    const result: any = [];
    const { calls } = this.props;
    if (!calls) {
      return result;
    }
    const callList = Object.values(calls);
    for (const call of callList) {
      if (call?.type === 'instant') {
        const { uid } = call.caller;
        const conversationModel = getConversationModel(uid);
        const name = formatInstantCallName(conversationModel);
        result.push({ ...call, name });
      }
    }
    return result;
  };

  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      archivedConversations,
      conversations,
      ourNumber,
      i18n,
      openConversationInternal,
      showArchived,
      calls,
    } = this.props;

    if (!conversations || !archivedConversations) {
      throw new Error(
        'renderRow: Tried to render without conversations or archivedConversations'
      );
    }

    if (!showArchived) {
      const instantCalls = this.getInstantCalls();
      if (index < instantCalls.length) {
        return (
          <ConversationListInstantCallItem
            key={key}
            style={style}
            i18n={i18n}
            ourNumber={ourNumber}
            call={instantCalls[index]}
          />
        );
      }
      index -= instantCalls.length;
    }

    // if (!showArchived && index === conversations.length) {
    //   return this.renderArchivedButton({ key, style });
    // }

    const conversation = showArchived
      ? archivedConversations[index]
      : conversations[index];

    let call: CallType | undefined = undefined;

    const current = conversations[index];
    if (calls && calls[current.id]) {
      call = calls[current.id];
    } else {
      call = undefined;
    }

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...conversation}
        ourNumber={ourNumber}
        onClick={(id: string, event?: ListItemClickEvent) => {
          console.log('LeftPan.tx click item.');
          // should open conversation except right clicking
          if (event?.button !== 2) {
            console.log('LeftPan.tx click openConversationInternal.');
            openConversationInternal(id);
          } else {
            console.log('LeftPan.tx click NOT openConversationInternal.');

            this.setState({
              currentCheckConversation: conversation,
            });
            this.showConversationOperationMenu(event);
            // $('.module-left-pane__virtual-list').css('overflow', 'hidden');
          }
        }}
        onDoubleClick={() => {
          //@ts-ignore
          const { markAsRead } = conversation;
          if (markAsRead) {
            markAsRead();
          }
        }}
        i18n={i18n}
        call={call}
        showExpireTimer={true}
      />
    );
  };

  public showConversationOperationMenu = (event: ListItemClickEvent): void => {
    // force destroy for next clicked position
    ReactDOM.flushSync(() => {
      this.setState({ showContextMenu: false, showProfileModal: false });
    });

    this.setState({
      contextMenuPosition: [event.pageX, event.pageY],
      showContextMenu: true,
    });
  };

  public renderArchivedButton({
    key,
    style,
  }: {
    key: string;
    style: Object;
  }): JSX.Element {
    const { archivedConversations, i18n, showArchivedConversations } =
      this.props;

    if (!archivedConversations || !archivedConversations.length) {
      throw new Error(
        'renderArchivedButton: Tried to render without archivedConversations'
      );
    }

    return (
      <ContactListItem
        key={key}
        style={style}
        phoneNumber={''}
        name={
          i18n('archivedConversations') +
          '(' +
          archivedConversations.length +
          ')'
        }
        color={'archive-yellow'}
        avatarPath={''}
        i18n={i18n}
        onClick={showArchivedConversations}
        archiveButton={true}
      />
    );

    // return (
    //   <div
    //     key={key}
    //     className="module-left-pane__archived-button"
    //     style={style}
    //     role="button"
    //     onClick={showArchivedConversations}
    //   >
    //     {i18n('archivedConversations')}{' '}
    //     <span className="module-left-pane__archived-button__archived-count">
    //       {archivedConversations.length}
    //     </span>
    //   </div>
    // );
  }

  public onListScroll = () => {
    this.setState({ shownUnreadIndex: undefined });
  };

  public renderList(): JSX.Element | Array<JSX.Element | null> {
    const {
      archivedConversations,
      i18n,
      conversations,
      openConversationInternal,
      startNewConversation,
      searchResults,
      showArchived,
    } = this.props;

    if (searchResults) {
      return (
        <SearchResults
          {...searchResults}
          openConversation={openConversationInternal}
          startNewConversation={startNewConversation}
          i18n={i18n}
        />
      );
    }

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    // That extra 1 element added to the list is the 'archived converastions' button
    const length = showArchived
      ? archivedConversations.length
      : conversations.length;

    const archived = showArchived ? (
      <div className="module-left-pane__archive-helper-text" key={0}>
        {i18n('archiveHelperText')}
      </div>
    ) : null;

    // We ensure that the listKey differs between inbox and archive views, which ensures
    //   that AutoSizer properly detects the new size of its slot in the flexbox. The
    //   archive explainer text at the top of the archive view causes problems otherwise.
    //   It also ensures that we scroll to the top when switching views.
    const listKey = showArchived ? 1 : 0;

    const { showContextMenu, showProfileModal } = this.state;
    let theClasses = 'module-left-pane__virtual-list';
    if (showContextMenu || showProfileModal) {
      theClasses += ' overflow-style-hidden';
    } else {
      theClasses += ' overflow-style-normal';
    }

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.

    const list = (
      <div className="module-left-pane__list" key={listKey}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              id={'left-pane-list-id'}
              scrollToAlignment="start"
              className={theClasses}
              conversations={conversations}
              height={height}
              rowCount={length}
              rowHeight={56}
              rowRenderer={this.renderRow}
              width={width - 1}
              onScroll={this.onListScroll}
              scrollToIndex={this.state.shownUnreadIndex}
            />
          )}
        </AutoSizer>
      </div>
    );

    if (conversations.length === 0 && archivedConversations.length === 0) {
      return (
        <div className={'no-conversaion-box'}>
          <div className={'logo'}>
            <img
              style={{ height: '70px', width: '70px' }}
              src="./images/LOGO.svg"
              alt={''}
            />
          </div>
          <div className={'tip'}>{i18n('all-no-conversation-tip')}</div>
        </div>
      );
    }
    return [archived, list];
  }

  public renderArchivedHeader(): JSX.Element {
    const { i18n, showInbox } = this.props;

    return (
      <div className="module-left-pane__archive-header">
        <div
          role="button"
          onClick={showInbox}
          className="module-left-pane__to-inbox-button"
        />
        <div className="module-left-pane__archive-header-text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  }

  public handleMenuStick = () => {
    const { conversationStick } = this.props;
    const { currentCheckConversation } = this.state;
    if (conversationStick) {
      conversationStick(
        currentCheckConversation.id,
        !currentCheckConversation.isStick
      );
    }
  };
  public handleConversationMute = async () => {
    const { conversationMute } = this.props;
    const { currentCheckConversation } = this.state;
    if (conversationMute) {
      conversationMute(
        currentCheckConversation.id,
        !currentCheckConversation.isMute
      );
    }
  };

  public handleMenuDeleteMessage = () => {
    const { deleteMessages } = this.props;
    const { currentCheckConversation } = this.state;
    if (deleteMessages) {
      const type =
        currentCheckConversation.type === 'direct'
          ? 'private'
          : currentCheckConversation.type;
      deleteMessages(currentCheckConversation.id, type);
    }
  };

  public handleConversationOperate = (event: any) => {
    // 如果当前搜索结果列表， 不予操作。
    if (this.props.searchResults) {
      return;
    }

    this.setState({ conversationRef: event.detail.refCurrent });
  };

  public restoreStyle() {
    // $('.conversation-operation-menu').css('display', 'none');
    $('.module-conversation-list-item').css('outline', 'none');
    // $('.module-left-pane__virtual-list').css('overflow', 'auto');
  }

  public handleMouseDown = (event: MouseEvent) => {
    if (!event) {
      return;
    }

    const { button } = event;
    if (button === 0) {
      this.setState({ showContextMenu: false });
      this.restoreStyle();
    } else if (button === 2) {
      const { conversationRef } = this.state;
      if (conversationRef && !conversationRef.contains(event.target as Node)) {
        this.setState({
          showContextMenu: false,
          showProfileModal: false,
        });

        // $('.conversation-operation-menu').css('display', 'none');
        $('.module-conversation-list-item').css('outline', 'none');
        // $('.module-left-pane__virtual-list').css('overflow', 'auto');
      }
    } else {
      //
    }
  };

  public handleClick = (event: MouseEvent) => {
    if (event) {
      this.setState({ showContextMenu: false });
      this.restoreStyle();
    }
  };

  async componentDidMount() {
    window.addEventListener(
      'event-scroll-to-unread-message',
      this.scrollToUnreadMessage
    );

    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('click', this.handleClick);

    window.addEventListener(
      'conversation-operation',
      this.handleConversationOperate
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      'event-scroll-to-unread-message',
      this.scrollToUnreadMessage
    );

    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('click', this.handleClick);

    window.removeEventListener(
      'conversation-operation',
      this.handleConversationOperate
    );
  }

  public async updateNotificationType(
    event: React.MouseEvent,
    m: INotificationType
  ) {
    const { currentCheckConversation } = this.state;
    const { ourNumber } = this.props;

    if (
      event &&
      event.button === 0 &&
      m.type !== currentCheckConversation.notificationSetting
    ) {
      await (window as any).setGroupNotifyType(
        m.type,
        currentCheckConversation.id,
        ourNumber
      );
    } else {
      console.log('check same notification type, skip......');
    }
  }

  public notificationTypeList() {
    const { currentCheckConversation } = this.state;
    const { i18n } = this.props;
    return NOTIFICATION_TYPE.map(m => {
      return {
        key: `notification-${m.type}`,
        label: (
          <div
            key={`notification-${m.type}`}
            className={'notification-menu-item'}
            onMouseDown={e => this.updateNotificationType(e, m)}
          >
            {currentCheckConversation &&
            currentCheckConversation.notificationSetting === m.type ? (
              <div className={'check-icon'} />
            ) : null}
            <div className={'check-name'}>{i18n(m.i18nKey)}</div>
          </div>
        ),
      };
    });
  }

  public renderLeaveGroup() {
    const { i18n, conversationLeaveGroup } = this.props;
    const { currentCheckConversation } = this.state;
    const style = {
      color: '#f84135',
    };
    if (currentCheckConversation.type !== 'group') {
      return null;
    }
    if (currentCheckConversation.isGroupV2Owner) {
      return null;
    }
    if (!currentCheckConversation.isAliveGroup) {
      return null;
    }
    return (
      <div className={'left-pane-contextmenu-item-delete'}>
        <div
          className={'conversation-operation'}
          style={style}
          onMouseDown={event => {
            if (event && event.button === 0) {
              conversationLeaveGroup(currentCheckConversation.id);
            }
          }}
        >
          {i18n('leaveGroup')}
        </div>
      </div>
    );
  }

  public renderDisbandGroup() {
    const { i18n, conversationDisbandGroup } = this.props;
    const { currentCheckConversation } = this.state;
    const style = {
      color: '#f84135',
    };

    if (currentCheckConversation.type !== 'group') {
      return null;
    }
    if (!currentCheckConversation.isGroupV2Owner) {
      return null;
    }
    if (!currentCheckConversation.isAliveGroup) {
      return null;
    }
    return (
      <div className={'left-pane-contextmenu-item-delete'}>
        <div
          className={'conversation-operation'}
          style={style}
          onMouseDown={event => {
            if (event && event.button === 0) {
              conversationDisbandGroup(currentCheckConversation.id);
            }
          }}
        >
          {i18n('disbandGroup')}
        </div>
      </div>
    );
  }

  public scrollToUnreadMessage = () => {
    const { archivedConversations, conversations, searchResults } = this.props;

    if (searchResults) {
      return;
    }

    if (!conversations || !archivedConversations) {
      throw new Error(
        'render: must provided conversations and archivedConverstions if no search results are provided'
      );
    }

    let unreadArray = conversations
      ?.map((conversation: any, index: number) => {
        if (conversation.unreadCount > 0 && !conversation.isMute) {
          return index;
        } else {
          return;
        }
      })
      .filter(i => i) as number[];

    // 没有红未读, 那就统计灰未读
    if (unreadArray.length === 0) {
      // 处理一种异常情况，第一个是红色未读会话的情况
      const tempConversations = conversations;

      if (
        tempConversations.length &&
        tempConversations[0].unreadCount > 0 &&
        !tempConversations[0].isMute
      ) {
        this.setState({ shownUnreadIndex: 0 });
        const elmt = document.getElementById('left-pane-list-id');
        if (elmt) {
          elmt.scrollTop = 0;
        }
        return;
      }

      unreadArray = conversations
        ?.map((conversation: any, index: number) => {
          if (conversation.unreadCount > 0 && conversation.isMute) {
            return index;
          } else {
            return;
          }
        })
        .filter(i => i) as number[];
    }

    const unreadMessagesIndices = [0].concat(unreadArray);
    if (unreadMessagesIndices.length <= 1) {
      this.setState({ shownUnreadIndex: 0 });
      const elmt = document.getElementById('left-pane-list-id');
      if (elmt) {
        elmt.scrollTop = 0;
      }
      return;
    }

    // @ts-ignore
    const currentIndex = this.state.currentUnreadIndex;
    // @ts-ignore
    if (currentIndex >= unreadMessagesIndices?.length - 1) {
      this.setState({ shownUnreadIndex: unreadMessagesIndices[0] });
      this.setState({ currentUnreadIndex: 0 });
    } else {
      this.setState({
        shownUnreadIndex: unreadMessagesIndices[currentIndex + 1],
      });
      this.setState(prevState => ({
        // @ts-ignore
        currentUnreadIndex: prevState.currentUnreadIndex + 1,
      }));
    }
    console.log(
      unreadMessagesIndices,
      'shown index',
      // @ts-ignore
      this.state.shownUnreadIndex,
      'current index',
      // @ts-ignore
      this.state.currentUnreadIndex
    );
  };

  public renderMarkAsReadOrUnRead() {
    const { i18n } = this.props;
    const { currentCheckConversation } = this.state;

    if (!currentCheckConversation) {
      return;
    }

    let i18nKey;
    let handler: () => void;

    if (currentCheckConversation.unreadCount) {
      i18nKey = 'markAsRead';
      handler = currentCheckConversation.markAsRead;
    } else {
      i18nKey = 'markAsUnread';
      handler = currentCheckConversation.markAsUnread;
    }

    if (!handler) {
      return;
    }

    return (
      <div
        className={'left-pane-contextmenu-item'}
        onMouseDown={event => {
          if (event && event.button === 0) {
            handler();
          }
        }}
      >
        {/*<div className={'mute-icon'} />*/}
        <div className={'conversation-operation'}>{i18n(i18nKey)}</div>
      </div>
    );
  }

  public deleteConversation(event: React.MouseEvent) {
    if (event && event.button === 0) {
      this.handleMenuDeleteMessage();
    }
  }

  public renderConversationOperationMenu() {
    const { i18n } = this.props;
    const {
      currentCheckConversation,

      contextMenuPosition,
      showContextMenu,
    } = this.state;

    if (!currentCheckConversation) {
      return null;
    }

    const items: MenuProps['items'] = [];

    if (!currentCheckConversation.isArchived) {
      if (currentCheckConversation.isStick) {
        items.push({
          key: 'unstick',
          label: (
            <div
              className={'left-pane-contextmenu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleMenuStick();
                }
              }}
            >
              {/*<div className={'remove-stick-icon'} />*/}
              <div className={'conversation-operation'}>
                {i18n('removeFromTop')}
              </div>
            </div>
          ),
        });
      } else {
        items.push({
          key: 'stick',
          label: (
            <div
              className={'left-pane-contextmenu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleMenuStick();
                }
              }}
            >
              {/*<div className={'stick-to-top-icon'} />*/}
              <div className={'conversation-operation'}>
                {i18n('stickToTop')}
              </div>
            </div>
          ),
        });
      }
      if (currentCheckConversation.isMute) {
        items.push({
          key: 'unmute',
          label: (
            <div
              className={'left-pane-contextmenu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleConversationMute();
                }
              }}
            >
              {/*<div c lassName={'unmute-icon'} />*/}
              <div className={'conversation-operation'}>{i18n('unmute')}</div>
            </div>
          ),
        });
      } else {
        items.push({
          key: 'mute',
          label: (
            <div
              className={'left-pane-contextmenu-item'}
              onMouseDown={event => {
                if (event && event.button === 0) {
                  this.handleConversationMute();
                }
              }}
            >
              {/*<div className={'mute-icon'} />*/}
              <div className={'conversation-operation'}>{i18n('mute')}</div>
            </div>
          ),
        });
      }

      items.push({
        key: 'mark-as-read-or-unread',
        label: this.renderMarkAsReadOrUnRead(),
      });

      if (currentCheckConversation.type === 'group') {
        items.push({
          key: 'notifications',
          label: (
            <div className={'left-pane-contextmenu-item'}>
              <div className={'conversation-operation'}>
                {i18n('notifications')}
              </div>
            </div>
          ),
          children: this.notificationTypeList(),
        });
      }
    }

    if (currentCheckConversation.type !== 'group') {
      items.push({
        key: 'show-profile',
        label: this.renderShowProfile(),
      });
    }

    // archived 只有 delete / leave 等操作，不需要 divider 分割
    if (!currentCheckConversation.isArchived) {
      items.push({ type: 'divider' });
    }

    items.push({
      key: 'delete-conversation',
      label: (
        <>
          <div
            className={'left-pane-contextmenu-item-delete'}
            style={{
              borderTop: currentCheckConversation.isArchived ? '0px solid' : '',
            }}
            onMouseDown={event => this.deleteConversation(event)}
          >
            <div className={'conversation-operation-delete'}>
              {i18n('delete')}
            </div>
          </div>
        </>
      ),
    });

    if (
      !(
        currentCheckConversation.type !== 'group' ||
        !currentCheckConversation.isGroupV2Owner ||
        !currentCheckConversation.isAliveGroup
      )
    ) {
      items.push({
        key: 'disband-group',
        label: this.renderDisbandGroup(),
      });
    }

    if (
      !(
        currentCheckConversation.type !== 'group' ||
        currentCheckConversation.isGroupV2Owner ||
        !currentCheckConversation.isAliveGroup
      )
    ) {
      items.push({
        key: 'leave-group',
        label: this.renderLeaveGroup(),
      });
    }

    return (
      <ContextMenu
        position={contextMenuPosition}
        trigger={['click']}
        menu={{ items }}
        open={showContextMenu}
        align={{ offset: [0, 0] }}
        overlayStyle={{ padding: 0 }}
      ></ContextMenu>
    );
  }

  private renderShowProfile() {
    const { i18n } = this.props;

    return (
      <div
        className={'left-pane-contextmenu-item'}
        onMouseDown={event => {
          if (event && event.button === 0) {
            ReactDOM.flushSync(() => {
              this.setState({
                showProfileModal: false,
                showContextMenu: false,
              });
            });

            this.setState({ showProfileModal: true });
          }
        }}
      >
        <div className={'conversation-operation'}>{i18n('profile')}</div>
      </div>
    );
  }

  public renderProfileModal = () => {
    const { i18n } = this.props;
    const { showProfileModal, contextMenuPosition } = this.state;
    if (!showProfileModal || !contextMenuPosition) {
      return;
    }

    return (
      <Popover
        open={showProfileModal}
        content={() => (
          <Profile
            id={this.state.currentCheckConversation.id}
            i18n={i18n}
            onClose={() => {
              this.setState({ showProfileModal: false });
            }}
            x={0}
            y={0}
            avatarPath={''}
          />
        )}
        overlayClassName={'avatar-context-popover'}
        placement={'right'}
        trigger="click"
        destroyTooltipOnHide={true}
        onOpenChange={open =>
          this.setState({
            showProfileModal: open,
          })
        }
      >
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition[0],
            top: contextMenuPosition[1],
            height: 1,
            width: 1,
            pointerEvents: 'none',
          }}
        ></div>
      </Popover>
    );
  };

  public render(): JSX.Element {
    const { renderMainHeader, showArchived } = this.props;

    return (
      <div className="module-left-pane" style={{ width: '100%' }}>
        <div className="module-left-pane__header">
          {showArchived ? this.renderArchivedHeader() : renderMainHeader()}
        </div>
        {this.renderList()}
        {this.renderConversationOperationMenu()}
        {this.renderProfileModal()}
      </div>
    );
  }
}
