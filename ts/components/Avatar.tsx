import React, { MouseEvent } from 'react';
import classNames from 'classnames';
import { v4 as uuidv4 } from 'uuid';
import { getInitials } from '../util/getInitials';
import { LocalizerType } from '../types/Util';
import { trigger } from '../shims/events';
import { Profile } from './commonSettings/Profile';

import { MenuProps, Modal, Popover } from 'antd';
import { ContextMenu } from './shared/ContextMenu';
import { IconSaveToNote } from './shared/icons';
// import AntDraggableModal from './AntDraggableModal';

interface Props {
  avatarPath?: string;
  color?: string;
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  noteToSelf?: boolean;
  name?: string;
  profileName?: string;
  accountName?: string;
  size: number;
  id?: string;
  groupChats?: boolean;
  allBots?: boolean;
  onClickAvatar?: (e: MouseEvent) => void; // 只有群ConversationHeader才有，优先级最高
  onDoubleClickAvatar?: (e: MouseEvent) => void;
  withMenu?: boolean;
  addAtPerson?: (id: string) => void;
  canUpload?: () => void;
  canPreviewAvatar?: boolean;
  notShowStatus?: boolean;
  noClickEvent?: boolean; // 不注册单击双击事件，比如会话列表，搜索结果列表
  archiveButton?: boolean;
  nonImageType?: 'search' | 'instant-call';
  isCanUpload?: boolean;
  groupMembersCount?: any;
  direction?: any;
  authorPhoneNumber?: any;
  conversationId?: any;
  fromMainTab?: boolean;
  leftGroup?: any;
}

interface State {
  imageBroken: boolean;
  showProfileDialog?: boolean;
  x: number;
  y: number;
  randomTriggerId: string;
  showUploadCamera: boolean;
  showViewAvatar: boolean;
  popoverPlacement: string;
  isMe?: boolean;
  showAvatarPreviewIcon: boolean;
  showAvatarPreivewModal: boolean;
  styleTop: number;
  styleLeft: number;
}

export class Avatar extends React.Component<Props, State> {
  public handleImageErrorBound: () => void;
  public avatarClickTimer: NodeJS.Timeout | undefined;
  public avatarRef: React.RefObject<HTMLDivElement>;
  public positionChecker: NodeJS.Timeout | undefined;
  public profileCardCloseTimer: NodeJS.Timeout | undefined;
  public avatarUpdateTimer: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);
    this.avatarRef = React.createRef();
    this.handleImageErrorBound = this.handleImageError.bind(this);

    this.state = {
      imageBroken: false,
      x: 0,
      y: 0,
      randomTriggerId: props.withMenu ? uuidv4() : '',
      showUploadCamera: false,
      showViewAvatar: false,
      popoverPlacement: 'rightTop',
      showAvatarPreviewIcon: false,
      showAvatarPreivewModal: false,
      styleTop: 100,
      styleLeft: 0,
    };
  }

  // 计算是否超出屏幕;超出后停止移动监听
  inWindow = (
    left: number,
    top: number,
    startPosX: number,
    startPosY: number
  ) => {
    const H = document.body.clientHeight;
    const W = document.body.clientWidth;
    if (
      (left < 20 && startPosX > left) ||
      (left > W - 20 && startPosX < left) ||
      (top < 20 && startPosY > top) ||
      (top > H - 20 && startPosY < top)
    ) {
      document.body.onmousemove = null;
      document.body.onmouseup = null;
      return false;
    }
    return true;
  };

  onMouseDown = (e: {
    preventDefault: () => void;
    clientX: any;
    clientY: any;
  }) => {
    e.preventDefault(); // 记录初始移动的鼠标位置
    const startPosX = e.clientX;
    const startPosY = e.clientY;
    const { styleLeft, styleTop } = this.state; // 添加鼠标移动事件
    document.body.onmousemove = e => {
      const left = e.clientX - startPosX + styleLeft;
      const top = e.clientY - startPosY + styleTop;
      if (this.inWindow(e.clientX, e.clientY, startPosX, startPosY)) {
        this.setState({
          styleLeft: left,
          styleTop: top,
        });
      }
    }; // 鼠标放开时去掉移动事件
    document.body.onmouseup = function () {
      document.body.onmousemove = null;
    };
  };

  public getPrivateUserId = () => {
    const {
      id,
      groupChats,
      allBots,
      conversationType,
      archiveButton,
      nonImageType,
    } = this.props;
    if (
      !nonImageType &&
      !groupChats &&
      !allBots &&
      conversationType === 'direct' &&
      !archiveButton
    ) {
      if (!id) {
        console.log('Avatar Bad Props, No ID!!!!');
      }
      return id;
    }
    return undefined;
  };

  public isBot = () => {
    const userId = this.getPrivateUserId();
    return userId && userId.length <= 6;
  };

  public componentDidMount = () => {
    const { id } = this.props;
    if (id) {
      this.updateAvatar(id);

      if ((window as any).ConversationController) {
        try {
          const conversation = (window as any).ConversationController.get(id);
          if (conversation) {
            this.setState({ isMe: conversation.isMe() });
          }
        } catch (error) {
          console.log('ConversationController is not ready:', error);
        }
      }
    }
  };

  public componentWillUnmount = () => {
    if (this.avatarClickTimer) {
      clearTimeout(this.avatarClickTimer);
      this.avatarClickTimer = undefined;
    }

    if (this.avatarUpdateTimer) {
      clearTimeout(this.avatarUpdateTimer);
      this.avatarUpdateTimer = undefined;
    }

    this.clearPositionChecker();
    this.clearProfileCardCloseTimer();
  };

  public componentDidUpdate(
    prevProps: Readonly<Props> /*, prevState: Readonly<State> */
  ) {
    if (this.props.id === prevProps.id) {
      return;
    }

    const { id } = this.props;
    if (id) {
      this.updateAvatar(id);

      try {
        const conversation = (window as any).conversationController?.get(id);
        if (conversation) {
          this.setState({ isMe: conversation.isMe() });
        }
      } catch (error) {
        console.log('ConversationController is not ready:', error);
      }
    }
  }

  public updateAvatar(id: string) {
    if (this.avatarUpdateTimer) {
      clearTimeout(this.avatarUpdateTimer);
    }

    this.avatarUpdateTimer = setTimeout(() => {
      trigger('update-avatar', id);
      this.avatarUpdateTimer = undefined;
    }, 5000);
  }

  public handleImageError() {
    console.log('Avatar: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
  }

  public openChat = () => {
    const { id } = this.props;
    trigger('showConversation', id);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
  };

  public menuAddAtPerson = () => {
    const { id, addAtPerson } = this.props;
    if (addAtPerson && id) {
      addAtPerson(id);
    }
  };

  public getMenuItems() {
    const { i18n, name, accountName, direction } = this.props;
    const showName = accountName || name;

    const menuItems: MenuProps['items'] = [
      {
        key: 'send-message',
        label: i18n('sendMessageToContact'),
        onClick: this.openChat,
      },
    ];

    if (direction === 'incoming') {
      menuItems.push({
        key: 'at-person',
        label: (
          <span className="module-avatar__context-menu-item">
            {'@' + showName}
          </span>
        ),
        onClick: ({ domEvent }) => {
          this.stopShowPopover(domEvent as MouseEvent<HTMLDivElement>);
          this.menuAddAtPerson();
        },
      });
    }

    return menuItems;
  }

  public renderImage() {
    const { avatarPath, i18n, name, id, profileName, size } = this.props;
    const { imageBroken } = this.state;

    if (!avatarPath || imageBroken) {
      return null;
    }

    const title = `${name || id}${
      !name && profileName ? ` ~${profileName}` : ''
    }`;

    // 重新设置头像大小，有圈和没圈一样大
    let resetSize = `${size}px`;

    return (
      <img
        alt={i18n('contactAvatarAlt', [title])}
        onError={this.handleImageErrorBound}
        src={avatarPath}
        style={{ width: resetSize, height: resetSize }}
      />
    );
  }
  public renderNoImage() {
    const {
      conversationType,
      name,
      noteToSelf,
      size,
      id,
      groupChats,
      allBots,
      archiveButton,
      nonImageType,
    } = this.props;

    const initials = id === 'MENTIONS_ALL' ? '@' : getInitials(name);
    const isGroup = conversationType === 'group';

    // 重新设置头像大小，有圈和没圈一样大
    const resetSize = `${size}px`;

    if (archiveButton) {
      return (
        <div
          className={classNames(
            'module-avatar__icon',
            'module-avatar__icon--archive-button',
            `module-avatar__icon--${size}`
          )}
        />
      );
    }

    if (groupChats) {
      return (
        <div
          className={classNames(
            'module-avatar__icon',
            'module-avatar__icon--group-chats',
            `module-avatar__icon--${size}`
          )}
        />
      );
    }
    if (allBots) {
      return (
        <div
          className={classNames(
            'module-avatar__icon',
            'module-avatar__icon--all-bots',
            `module-avatar__icon--${size}`
          )}
        />
      );
    }

    if (noteToSelf) {
      return (
        <div className="module-avatar__icon module-avatar__icon--note-to-self-wrapper">
          <IconSaveToNote
            height={25}
            width={25}
            color="var(--dst-color-text-white)"
          />
        </div>
      );
    }

    switch (nonImageType) {
      case 'search':
        return (
          <div
            className={classNames(
              'module-avatar__icon',
              'module-avatar__icon--search',
              `module-avatar__icon--${size}`
            )}
          />
        );
      case 'instant-call':
        return (
          <div
            className={classNames(
              'module-avatar__label',
              `module-avatar__label--${size}`,
              'module-avatar__label-instant-call'
            )}
          ></div>
        );
    }

    if (!isGroup && initials) {
      return (
        <div
          style={{ width: resetSize, height: resetSize, lineHeight: resetSize }}
          className={classNames(
            'module-avatar__label',
            `module-avatar__label--${size}`
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <div
        className={classNames(
          'module-avatar__icon',
          `module-avatar__icon--${conversationType}`,
          `module-avatar__icon--${size}`
        )}
      />
    );
  }

  public previewNoImageAvatar() {
    const { conversationType, name, id, nonImageType } = this.props;

    const initials = id === 'MENTIONS_ALL' ? '@' : getInitials(name);
    const isGroup = conversationType === 'group';

    switch (nonImageType) {
      case 'instant-call':
        return (
          <div
            className={classNames(
              'module-avatar__label',
              `module-avatar__label--200`,
              'module-avatar__label-instant-call'
            )}
          >
            {initials || '#'}
          </div>
        );
    }

    if (!isGroup && initials) {
      return (
        <div
          className={classNames(
            'module-avatar__label',
            `module-avatar__label--200`
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <div
        className={classNames(
          'module-avatar__icon',
          `module-avatar__icon--${conversationType}`,
          `module-avatar__icon--200`
        )}
      />
    );
  }

  public renderUploadMark() {
    if (this.props.canUpload && this.state.showUploadCamera) {
      return (
        <div
          className={classNames(
            'module-avatar__icon',
            'module-avatar__icon--camera-border',
            `module-avatar__icon--80`
          )}
        >
          <div
            className={classNames(
              'module-avatar__icon',
              'module-avatar__icon--camera',
              `module-avatar__icon--80`
            )}
          />
        </div>
      );
    }
    return null;
  }

  public ifCanUpload = () => {
    const { canUpload } = this.props;
    if (canUpload) {
      return (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        canUpload();
      };
    }

    return null;
  };

  public renderAvatarPreview() {
    if (!this.props.canPreviewAvatar) {
      return null;
    }

    const { imageBroken, showAvatarPreivewModal } = this.state;
    if (!showAvatarPreivewModal) {
      return null;
    }

    const { noteToSelf, avatarPath } = this.props;

    const hasImage = !noteToSelf && avatarPath && !imageBroken;
    const { color, groupChats, nonImageType } = this.props;
    const backgroundColors = [
      'rgb(255,69,58)',
      'rgb(255,159,11)',
      'rgb(254,215,9)',
      'rgb(49,209,91)',
      'rgb(120,195,255)',
      'rgb(11,132,255)',
      'rgb(94,92,230)',
      'rgb(213,127,245)',
      'rgb(114,126,135)',
      'rgb(255,79,121)',
    ];
    let backgroundColor: any;
    const userId = this.getPrivateUserId();

    if (userId) {
      const sub = userId.substr(userId.length - 1, 1);
      const index = parseInt(sub, 10) % 10;
      if (index || index === 0) {
        backgroundColor = backgroundColors[index];
      } else {
        backgroundColor = backgroundColors[sub.charCodeAt(0) % 10];
      }
    }

    if (hasImage || noteToSelf || groupChats || nonImageType) {
      backgroundColor = undefined;
    }
    const { styleLeft, styleTop } = this.state;
    const style = { left: styleLeft, top: styleTop };

    return (
      <div
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Modal
          width={400}
          keyboard={true}
          closable={false}
          className={'view-avatar-modal'}
          open={showAvatarPreivewModal}
          mask={false}
          footer={null}
          zIndex={9999}
          destroyOnClose={true}
          onCancel={this.handleCancel}
          style={style}
        >
          <div className="view-avatar-header" onMouseDown={this.onMouseDown}>
            <span
              className={'apple-close'}
              onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
                event.stopPropagation();
                this.setState({
                  showAvatarPreivewModal: false,
                });
              }}
            />
          </div>
          {hasImage ? (
            <img
              src={avatarPath}
              className={'view-avatar'}
              height={400}
              width={400}
            />
          ) : (
            <div className={'view-no-image-avatar-div'}>
              <div
                style={{ width: 400, height: 400, backgroundColor }}
                className={classNames(
                  'module-avatar',
                  `module-avatar--200`,
                  hasImage
                    ? 'module-avatar--with-image'
                    : 'module-avatar--no-image',
                  !hasImage ? `module-avatar--${color}` : null
                )}
              >
                {this.previewNoImageAvatar()}
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }
  public renderMainAvatar() {
    const {
      // id,
      avatarPath,
      color,
      size,
      groupChats,
      noteToSelf,
      withMenu,
      canUpload,
      canPreviewAvatar,
      onClickAvatar,
      noClickEvent,
      nonImageType,
    } = this.props;
    const { imageBroken } = this.state;
    const hasImage = !noteToSelf && avatarPath && !imageBroken;

    if (
      size !== 20 &&
      size !== 24 &&
      size !== 28 &&
      size !== 36 &&
      size !== 48 &&
      size !== 64 &&
      size !== 80 &&
      size !== 56 &&
      size !== 88 &&
      size !== 100
    ) {
      throw new Error(`Size ${size} is not supported!`);
    }

    // 重新设置头像大小，有圈和没圈一样大
    let resetSize = `${size}px`;

    const backgroundColors = [
      'rgb(255,69,58)',
      'rgb(255,159,11)',
      'rgb(254,215,9)',
      'rgb(49,209,91)',
      'rgb(120,195,255)',
      'rgb(11,132,255)',
      'rgb(94,92,230)',
      'rgb(213,127,245)',
      'rgb(114,126,135)',
      'rgb(255,79,121)',
    ];
    let backgroundColor: any;

    // 1v1会话
    const userId = this.getPrivateUserId();
    if (userId) {
      const sub = userId.substr(userId.length - 1, 1);
      const index = parseInt(sub, 10) % 10;
      if (index || index === 0) {
        backgroundColor = backgroundColors[index];
      } else {
        backgroundColor = backgroundColors[sub.charCodeAt(0) % 10];
      }
    }

    // 群先不设置颜色
    // if (id && id.length > 1 && isGroup) {
    //   const sub = id.substr(id.length - 2, 2);
    //   const index = parseInt(sub, 16) % 4;
    //   backgroundColor = backgroundColors[index];
    //   if (!backgroundColor) {
    //     backgroundColor = backgroundColors[1];
    //   }
    // }

    if (hasImage || noteToSelf || groupChats || nonImageType) {
      backgroundColor = undefined;
    }

    if (withMenu) {
      return (
        <ContextMenu menu={{ items: this.getMenuItems() }}>
          <div
            role="button"
            onClick={
              this.ifCanUpload() ||
              onClickAvatar ||
              (canPreviewAvatar ? this.handleShowPreview : null) ||
              (noClickEvent ? this.stopShowPopover : this.onAvatarClickBound)
            }
            onDoubleClick={
              noClickEvent
                ? this.stopShowPopover
                : this.onAvatarDoubleClickBound
            }
            style={{ width: resetSize, height: resetSize, backgroundColor }}
            className={classNames(
              'module-avatar',
              `module-avatar--${size}`,
              hasImage
                ? 'module-avatar--with-image'
                : 'module-avatar--no-image',
              !hasImage ? `module-avatar--${color}` : null
            )}
          >
            {hasImage ? this.renderImage() : this.renderNoImage()}
          </div>
        </ContextMenu>
      );
    }

    const cursor = noClickEvent ? 'auto' : 'pointer';
    return (
      <div
        role="button"
        onClick={
          this.ifCanUpload() ||
          onClickAvatar ||
          (canPreviewAvatar ? this.handleShowPreview : null) ||
          (noClickEvent ? this.stopShowPopover : this.onAvatarClickBound)
        }
        onDoubleClick={
          noClickEvent ? this.stopShowPopover : this.onAvatarDoubleClickBound
        }
        style={{ width: resetSize, height: resetSize, backgroundColor, cursor }}
        className={classNames(
          'module-avatar',
          `module-avatar--${size}`,
          hasImage ? 'module-avatar--with-image' : 'module-avatar--no-image',
          !hasImage ? `module-avatar--${color}` : null
        )}
        onMouseOver={() => {
          if (canUpload) {
            this.setState({ showUploadCamera: true });
          }
        }}
        onMouseLeave={() => {
          this.setState({
            showUploadCamera: false,
            showAvatarPreviewIcon: false,
          });
        }}
      >
        {hasImage ? this.renderImage() : this.renderNoImage()}
        {this.renderUploadMark()}
      </div>
    );
  }

  public renderGroupMembersCount() {
    const { conversationType, groupMembersCount } = this.props;
    if (conversationType !== 'group' || !Boolean(groupMembersCount))
      return null;
    return (
      <div className="module-avatar-group-members-count">
        {groupMembersCount}
      </div>
    );
  }

  public renderProfile() {
    const { i18n, avatarPath, isCanUpload } = this.props;

    const id = this.getPrivateUserId();
    if (!id) {
      return null;
    }

    return (
      <div
        onMouseEnter={() => this.clearProfileCardCloseTimer()}
        // onMouseLeave={() => this.setupProfileCardCloseTimer()}
      >
        <Profile
          id={id}
          i18n={i18n}
          onClose={() => {
            this.setState({ showProfileDialog: false });
          }}
          x={0}
          y={0}
          avatarPath={avatarPath}
          allowUpload={isCanUpload ? true : false}
        />
      </div>
    );
  }

  public getPlacement() {
    const { popoverPlacement } = this.state;

    switch (popoverPlacement) {
      case 'left':
        return 'left';
      case 'leftTop':
        return 'leftTop';
      case 'leftBottom':
        return 'leftBottom';
      case 'right':
        return 'right';
      case 'rightTop':
        return 'rightTop';
      case 'rightBottom':
        return 'rightBottom';
    }

    return undefined;
  }

  public clearPositionChecker() {
    if (this.positionChecker) {
      clearInterval(this.positionChecker);
      this.positionChecker = undefined;
    }
  }

  public handlePopoverVisibleChange(visible: boolean) {
    this.setState({ showProfileDialog: visible });

    this.clearPositionChecker();

    const rect = this.avatarRef?.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    if (visible) {
      this.positionChecker = setInterval(() => {
        const currRect = this.avatarRef?.current?.getBoundingClientRect();
        if (!currRect) {
          this.clearPositionChecker();
          return;
        }

        const deltaX = Math.abs(rect.x - currRect.x);
        const deltaY = Math.abs(rect.y - currRect.y);

        const minDelta = 0;
        if (deltaX > minDelta || deltaY > minDelta) {
          this.clearPositionChecker();
          this.setState({ showProfileDialog: false });
        }
      }, 100);
    }
  }

  public setupProfileCardCloseTimer() {
    this.clearProfileCardCloseTimer();

    if (this.state.isMe) {
      return;
    }

    if (this.state.showProfileDialog) {
      this.profileCardCloseTimer = setTimeout(() => {
        this.clearProfileCardCloseTimer();
        this.setState({ showProfileDialog: false });
      }, 100);
    }
  }

  public clearProfileCardCloseTimer() {
    if (this.profileCardCloseTimer) {
      clearTimeout(this.profileCardCloseTimer);
      this.profileCardCloseTimer = undefined;
    }
  }

  public render() {
    const { fromMainTab, onClickAvatar } = this.props;

    return (
      <Popover
        overlayClassName={
          onClickAvatar
            ? 'group-avatar-context-popover'
            : 'avatar-context-popover'
        }
        placement={this.getPlacement()}
        content={this.renderProfile()}
        trigger="click"
        open={!fromMainTab && this.state.showProfileDialog}
        onOpenChange={visible => this.handlePopoverVisibleChange(visible)}
        destroyTooltipOnHide={true}
        // getPopupContainer={() => this.avatarRef.current || document.body}
        // fix jump problem
        // https://github.com/ant-design/ant-design/issues/27102
        transitionName=""
      >
        <div
          className={'only-for-before-join-meeting'}
          style={{
            borderRadius: '50%',
            position: 'relative',
            pointerEvents: 'none',
          }}
          ref={this.avatarRef}
          onMouseEnter={() => this.clearProfileCardCloseTimer()}
          // onMouseLeave={() => this.setupProfileCardCloseTimer()}
        >
          {this.renderGroupMembersCount()}
          {this.renderMainAvatar()}
          {this.renderAvatarPreview()}
        </div>
      </Popover>
    );
  }

  // 左右侧显示
  public showProfileCardLeftRight = (rect: DOMRect) => {
    const padding = 8;
    // const profileDialogHeight = 380 + 36;
    const profileDialogWidth = 280;

    // const maxY = window.innerHeight - profileDialogHeight - padding;
    const maxX = window.innerWidth - profileDialogWidth - padding;

    const x = rect.x + rect.width + padding;
    const y = rect.y;

    const maxCardHeight = 498;
    const halfHeight = maxCardHeight / 2;

    const getTopBottom = () => {
      if (y < halfHeight && y < window.innerHeight - maxCardHeight) {
        // top
        return 'Top';
      } else if (
        y >= maxCardHeight - 36 ||
        window.innerHeight - y + 30 < halfHeight
      ) {
        // bottom
        return 'Bottom';
      } else {
        // middle
        return '';
      }
    };

    const getLeftRight = () => {
      if (x > maxX) {
        return 'left';
      } else {
        return 'right';
      }
    };

    const placement = getLeftRight() + getTopBottom();

    this.clearProfileCardCloseTimer();
    this.setState({
      popoverPlacement: placement,
    });
    this.handlePopoverVisibleChange(true);
  };

  // 点击头像实际执行事件, onClickAvatar会覆盖show profile事件
  public doClickAvatarAction = () => {
    const { noteToSelf } = this.props;
    if (noteToSelf) {
      return;
    }

    // 只有单人才显示profile，群不显示profile
    if (this.avatarRef.current && this.getPrivateUserId()) {
      // window.screenLeft，window.screenTop 表示窗口左上角相对于screen的位置
      const rect = this.avatarRef.current.getBoundingClientRect();
      return this.showProfileCardLeftRight(rect);
    }
  };

  public onAvatarClickBound = (event: React.MouseEvent<HTMLDivElement>) => {
    const { showProfileDialog } = this.state;
    event.stopPropagation();
    if (showProfileDialog) {
      this.setState({
        showProfileDialog: false,
      });
      return;
    }
    const { onDoubleClickAvatar } = this.props;
    if (this.avatarClickTimer) {
      clearTimeout(this.avatarClickTimer);
      this.avatarClickTimer = undefined;
    }

    // 这种情况需要定时器
    if (onDoubleClickAvatar) {
      this.avatarClickTimer = setTimeout(() => {
        if (this.avatarClickTimer) {
          clearTimeout(this.avatarClickTimer);
        }
        this.avatarClickTimer = undefined;
        this.doClickAvatarAction();
      }, 200);
    } else {
      this.doClickAvatarAction();
    }
  };

  public onAvatarDoubleClickBound = (event: MouseEvent<HTMLDivElement>) => {
    const { onDoubleClickAvatar } = this.props;
    if (this.avatarClickTimer) {
      clearTimeout(this.avatarClickTimer);
      this.avatarClickTimer = undefined;
    }

    if (onDoubleClickAvatar) {
      onDoubleClickAvatar(event);
    }
  };

  public handleShowPreview = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    this.setState({
      showAvatarPreivewModal: true,
    });
  };

  public handleCancel = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    this.setState({
      showAvatarPreivewModal: false,
    });
  };

  public stopShowPopover = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    this.setState({
      showAvatarPreivewModal: false,
    });
  };
}
