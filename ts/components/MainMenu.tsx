import React from 'react';
import { Avatar } from './Avatar';
import { LocalizerType } from '../types/Util';
import { ForwardDialog } from './ForwardDialog';
import { Tooltip, Drawer, Popover } from 'antd';
import Load from './globalComponents/Load';
import { CommonSetting } from './commonSettings/CommonSetting';
import ProfileModal from './commonSettings/ProfileModal';
import { Profile } from './commonSettings/Profile';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';
import { getConversationModel } from '../shims/Whisper';

export interface Props {
  // To be used as an ID
  id: string;
  regionCode: string;

  // For display
  isMe: boolean;
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  ourNumber: string;
  clearSearch: () => void;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
  leftPaneWidth: number;
}

type UpdateDetailEx = {
  version: string;
  osVersion: string;
  minOSVersion?: string;
  error?: string;
};

declare global {
  interface WindowEventMap {
    'event-show-update-button': CustomEvent<UpdateDetailEx>;
  }
}

interface State {
  barState: number; // 0-chat 1-contact
  redCount: number;
  greyCount: number;
  showForwardDialog: boolean;
  conversations: any;
  user: string;
  showCommonSetting?: boolean;
  showProfileDialog?: boolean;
  updateButton?: boolean;
  updateDetail?: UpdateDetailEx;
  profileUid: string;
  pos: any;
  allowUpload: boolean;

  reverseShareDirection?: boolean;
  forwardDialogTitle?: string;
}

export class MainMenu extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);

    this.state = {
      barState: 0,
      redCount: 0,
      greyCount: 0,
      showForwardDialog: false,
      conversations: [],
      user: '',
      profileUid: '',
      pos: undefined,
      allowUpload: true,
      showCommonSetting: false,
      showProfileDialog: false,
      updateButton: false,
      updateDetail: undefined,
    };
  }

  public componentDidMount = () => {
    window.addEventListener(
      'main-header-set-badge-count',
      this.updateBadgeCount
    );
    (window as any).queryBadgeCount();
    window.addEventListener(
      'event-toggle-switch-chat',
      this.toggleButtonSwitchChat
    );
    (window as any).registerSearchUser((infos: any) => {
      const info = infos.userId || infos;
      const isMac = infos.isMac;
      const extern = infos.extern;
      const conversationsCollection = (window as any).getConversations();
      const conversations = conversationsCollection.map(
        (conversation: { cachedProps: any }) => conversation.cachedProps
      );
      const lookup = (window as any).Signal.Util.makeLookup(
        conversations,
        'id'
      );
      if (lookup.hasOwnProperty(info)) {
        const item = lookup[info];
        (window as any).sendSearchUser({
          id: info,
          name: item.name || item.id,
          avatar: item.avatarPath,
          isMac,
          extern,
        });
      } else {
        (window as any).sendSearchUser({ id: info, name: info, isMac, extern });
      }
    });

    // show forward profile
    window.addEventListener('event-share-user-contact', this.showUserContact);

    window.addEventListener(
      'open-profile-with-position',
      this.openProfileCenter
    );
    window.addEventListener('event-open-user-setting', this.openCommonSetting);
    window.addEventListener('event-show-update-button', this.ShowUpdateButton);
  };

  public componentWillUnmount() {
    window.removeEventListener(
      'main-header-set-badge-count',
      this.updateBadgeCount
    );
    window.removeEventListener(
      'event-toggle-switch-chat',
      this.toggleButtonSwitchChat
    );
    (window as any).registerSearchUser(null);
    window.removeEventListener(
      'event-share-user-contact',
      this.showUserContact
    );

    window.removeEventListener(
      'open-profile-with-position',
      this.openProfileCenter
    );
    window.removeEventListener(
      'event-open-user-setting',
      this.openCommonSetting
    );
    window.removeEventListener(
      'event-show-update-button',
      this.ShowUpdateButton
    );
  }

  public renderUnreadCount() {
    const { redCount, greyCount } = this.state;
    if (redCount || greyCount) {
      let right = '17px';
      if (
        (redCount && redCount > 99) ||
        (!redCount && greyCount && greyCount > 99)
      ) {
        right = '10px';
      }
      return (
        <div
          className={
            redCount
              ? 'module-conversation-list-item__unread-count'
              : 'module-conversation-list-item__unread-count-mute'
          }
          style={{ right, top: '42px', fontSize: '10px', lineHeight: '15.7px' }}
        >
          {redCount
            ? redCount > 99
              ? '99+'
              : redCount
            : greyCount > 99
              ? '99+'
              : greyCount}
        </div>
      );
    }
    return null;
  }

  public renderForwardDialog() {
    const { showForwardDialog, user, conversations, forwardDialogTitle } =
      this.state;
    if (!showForwardDialog) {
      return null;
    }

    const { i18n } = this.props;

    return (
      <ForwardDialog
        i18n={i18n}
        onForwardToContact={this.onForwardToContact}
        sendContact={user}
        conversations={conversations}
        onClose={this.closeForwardDialog}
        onCancel={this.closeForwardDialog}
        title={forwardDialogTitle}
      />
    );
  }

  public renderUpdateButtonContent = () => {
    const { i18n } = this.props;
    const { updateDetail } = this.state;

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '12px',
          backgroundColor: '#056FFA',
          height: 32,
          width: 85,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
        }}
        onClick={async () => {
          const { error } = updateDetail || {};
          if (error) {
            const message =
              error === 'UnsupportedOSError'
                ? i18n('cannotUpdateDueToUnsupportedOS')
                : i18n('cannotUpdateDetail');

            (window as any).electronConfirm(message, undefined, null);
            return;
          }

          const message = i18n('autoUpdateNewVersionMessageInstall');
          const ret = await (window as any).electronConfirm(message);

          if (ret) {
            (window as any).updateWillReboot();
          }
        }}
      >
        <span className={'update-button-icon--reboot'}></span>
        <span>{i18n('Update')}</span>
      </div>
    );
  };

  public renderUpdateButton = () => {
    const { updateButton } = this.state;
    return (
      <Popover
        overlayClassName={'update-button-card--popover'}
        content={this.renderUpdateButtonContent()}
        open={updateButton}
        placement="right"
      >
        <div
          style={{
            width: 1,
            height: 1,
            position: 'absolute',
            left: -20,
            bottom: 135,
          }}
        ></div>
      </Popover>
    );
  };

  public render() {
    const { avatarPath, i18n, color, name, profileName, id, ourNumber } =
      this.props;
    const { showCommonSetting } = this.state;
    // 切换账号时，可能出现id=undefined, 需要过滤掉这种情况
    if (!id) {
      return null;
    }

    let buttons = (
      <div>
        {/* 解决切换的时候会闪烁 */}
        <div
          style={{ position: 'absolute', left: '-100px' }}
          role="button"
          className="module-first-pane-difft-icon"
        />
        <div
          style={{ position: 'absolute', left: '-100px' }}
          role="button"
          className="module-first-pane-contact-icon-blue"
        />
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('mainMenuMessagesTooltip')}
        >
          <div
            role="button"
            onClick={() => {
              if (this.state.barState === 0) {
                const myEvent = new CustomEvent(
                  'event-scroll-to-unread-message'
                );
                window.dispatchEvent(myEvent);
              }
              this.toggleButtonState(0);
            }}
            className={
              this.state.barState === 0
                ? 'module-first-pane-difft-icon-blue'
                : 'module-first-pane-difft-icon'
            }
          />
        </Tooltip>
        {this.renderUnreadCount()}
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('mainMenuContactTooltip')}
        >
          <div
            role="button"
            onClick={() => this.toggleButtonState(1)}
            className={
              this.state.barState === 1
                ? 'module-first-pane-contact-icon-blue'
                : 'module-first-pane-contact-icon'
            }
          />
        </Tooltip>
      </div>
    );
    return (
      <div className="module-main-menu">
        <Load i18n={i18n} ourNumber={ourNumber} />
        <div style={{ width: 'fit-content', margin: 'auto' }}>
          <Avatar
            id={id}
            avatarPath={avatarPath}
            color={color}
            conversationType="direct"
            i18n={i18n}
            name={name}
            profileName={profileName}
            size={36}
            isCanUpload={true}
            noClickEvent={true}
            fromMainTab={true}
            onClickAvatar={() => {
              if (showCommonSetting) {
                this.setState({
                  showCommonSetting: false,
                });
              } else {
                this.setState({ showCommonSetting: true });
              }
            }}
          />
        </div>
        <div className="div-buttons">
          {buttons}
          {/*<Tooltip*/}
          {/*  mouseEnterDelay={1.5}*/}
          {/*  overlayClassName={'antd-tooltip-cover'}*/}
          {/*  placement="leftTop"*/}
          {/*  title={i18n('settingsTooltip')}*/}
          {/*>*/}
          {/*</Tooltip>*/}
          {this.renderUpdateButton()}
        </div>
        {this.renderForwardDialog()}
        {this.renderCommonSetting()}
        {this.renderProfileDialog()}
      </div>
    );
  }

  private readonly toggleButtonState = (index: number) => {
    const { clearSearch, currentDockItemChanged } = this.props;
    const { showCommonSetting } = this.state;
    if (showCommonSetting) {
      this.setState({ showCommonSetting: false });
    }
    if (clearSearch) {
      clearSearch();
    }
    if (this.state.barState === index) {
      return;
    }

    // chat
    const gutter = document.getElementsByClassName('gutter')[0] as any;
    const conversationStack = document.getElementsByClassName(
      'conversation-stack'
    )[0] as any;

    const contactColumn = document.getElementsByClassName(
      'contact-column'
    )[0] as any;

    if (index === 0) {
      // chat
      gutter.style.display = 'block';
      conversationStack.style.display = 'block';

      contactColumn.style.display = 'none';

      currentDockItemChanged('chat');
    } else if (index === 1) {
      gutter.style.display = 'none';
      conversationStack.style.display = 'none';

      contactColumn.style.display = 'flex';

      currentDockItemChanged('contact');
    } else {
      currentDockItemChanged('others');
    }

    this.setState({
      barState: index,
    });
  };

  private readonly toggleButtonSwitchChat = () => {
    this.toggleButtonState(0);
  };

  private updateBadgeCount = (ev: any) => {
    const { redCount, greyCount } = ev.detail;
    this.setState(() => ({
      redCount,
      greyCount,
    }));
  };

  public closeForwardDialog = () => {
    this.setState({ showForwardDialog: false });
  };

  public openProfileCenter = (ev: any) => {
    if (ev && ev.detail && ev.detail.uid) {
      const pos = ev.detail.pos || { x: 200, y: 200 };
      this.setState({
        showProfileDialog: true,
        profileUid: ev.detail.uid,
        pos,
      });
    }
  };

  public onForwardToContact = async (
    conversationIds?: Array<string>,
    user?: any
  ) => {
    if (!conversationIds || !user) {
      return;
    }
    const { reverseShareDirection } = this.state;

    let userConversation = getConversationModel(user.number);
    if (reverseShareDirection && !userConversation) {
      return;
    }

    for (const id of conversationIds) {
      const c = getConversationModel(id);
      if (!c) {
        continue;
      }
      if (reverseShareDirection) {
        await userConversation.forceSendMessageAuto(
          '',
          null,
          [],
          null,
          null,
          null,
          null,
          [{ number: c.get('id'), name: c.getAccountName() }]
        );
      } else {
        await c.forceSendMessageAuto('', null, [], null, null, null, null, [
          user,
        ]);
      }
    }
  };

  private readonly showUserContact = (ev: any) => {
    const conversations = (window as any).getConversations();
    const { reverseShareDirection, ...user } = ev.detail;

    const shownConversations = reverseShareDirection
      ? conversations.filter((c: any) => c.isPrivate())
      : conversations;

    this.setState({
      showForwardDialog: true,
      forwardDialogTitle: reverseShareDirection
        ? (window as any).i18n('shareContact')
        : undefined,
      conversations: shownConversations.map((c: any) => c.format()),
      user,
      reverseShareDirection,
    });
  };

  private readonly ShowUpdateButton = (e: CustomEvent<UpdateDetailEx>) => {
    this.setState({
      updateButton: true,
      updateDetail: e.detail,
    });
  };

  public openCommonSetting = () => {
    this.setState({ showCommonSetting: true });
  };

  public renderCommonSetting() {
    const { showCommonSetting } = this.state;
    const { avatarPath, i18n, name, id, leftPaneWidth } = this.props;

    const closeSetting = () => {
      this.setState({ showCommonSetting: false });
    };

    if (showCommonSetting) {
      return (
        <Drawer
          placement="left"
          open={this.state.showCommonSetting}
          width={leftPaneWidth}
          closable={false}
          styles={{
            wrapper: {
              boxShadow: 'none',
            },
          }}
          rootStyle={{ marginLeft: 68, padding: 0 }}
          mask={false}
          push={{ distance: '0' }}
        >
          <CommonSetting
            id={id}
            avatarPath={avatarPath}
            name={name}
            i18n={i18n}
            closeSetting={closeSetting}
            leftPaneWidth={leftPaneWidth}
          />
        </Drawer>
      );
    } else {
      return null;
    }
  }

  public renderProfileDialog = () => {
    const { i18n } = this.props;
    const { showProfileDialog, profileUid, pos } = this.state;
    if (!showProfileDialog || !profileUid) {
      return;
    }

    return (
      <ProfileModal
        onClose={() => {
          this.setState({ showProfileDialog: false });
        }}
      >
        <Profile
          id={profileUid}
          i18n={i18n}
          onClose={() => {
            this.setState({ showProfileDialog: false });
          }}
          x={pos.x}
          y={pos.y}
          avatarPath={''}
        />
      </ProfileModal>
    );
  };
}
