import React from 'react';
// import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import Dialog from './Dialog';
import { Avatar } from './Avatar';
import { URL } from 'url';
import { trigger } from '../shims/events';
import classNames from 'classnames';
import { API_STATUS } from '../types/APIStatus';

export interface Props {
  i18n: LocalizerType;
  joinUrl: string;
  onClose: () => void;
}

export interface State {
  inviter?: string;
  groupName?: string;
  groupAvatarPath?: string;
  groupMemberCount?: number;
  hostName?: string;
  pathName?: string;
  inviteCode?: string;
  joinButtonEnabled?: boolean;
  loading: boolean;
}

export class JoinGroup extends React.Component<Props, State> {
  helperConv: any;
  public btnRef: React.RefObject<HTMLButtonElement>;

  constructor(props: Readonly<Props>) {
    super(props);

    this.btnRef = React.createRef();

    const { joinUrl } = props;

    let inviteCode;
    let pathName;
    let hostName;
    try {
      const parsedUrl = new URL(joinUrl);
      inviteCode = parsedUrl.searchParams.get('inviteCode');
      pathName = parsedUrl.pathname;
      hostName = parsedUrl.hostname;
    } catch (error) {
      (window as any).log.error('parse url failded, ', error);
    }

    const Whisper = (window as any).Whisper;
    this.helperConv = new Whisper.Conversation({
      id: 'helper-for-group-join',
      type: 'group',
    });

    this.state = {
      hostName: hostName || '',
      pathName: pathName || '',
      inviteCode: inviteCode || '',
      joinButtonEnabled: false,
      loading: false,
    };

    setTimeout(() => this.getGroupInfo(), 0);
  }

  public componentDidMount() {
    this.btnRef.current?.focus();
  }

  public componentWillUnmount() {
    if (this.helperConv) {
      this.helperConv.cleanup();
    }
  }

  public renderGroupAvatar() {
    const { i18n } = this.props;

    const { groupAvatarPath } = this.state;

    return (
      <Avatar
        i18n={i18n}
        conversationType={'group'}
        size={48}
        avatarPath={groupAvatarPath}
        noteToSelf={false}
        noClickEvent={true}
      />
    );
  }

  public renderGroupName() {
    const { groupName, groupMemberCount } = this.state;

    if (!groupName) {
      return null;
    }

    const displayName = (groupName || '') + `(${groupMemberCount})`;

    return <span className="dialog-join-group_group-name">{displayName}</span>;
  }

  public renderJoinButton() {
    const { i18n } = this.props;
    const buttonDisabled = !this.state.joinButtonEnabled;

    return (
      <div className="dialog-join-group_button-container">
        <button
          ref={this.btnRef}
          disabled={buttonDisabled}
          onClick={() => this.joinGroup()}
          className={classNames(
            buttonDisabled ? 'not-allow-pointer' : '',
            'dialog-join-group_join-button'
          )}
        >
          {i18n('joinGroup')}
        </button>
      </div>
    );
  }

  public renderLoading() {
    const { loading } = this.state;
    if (!loading) {
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
  }

  public renderHeaderToolbar() {
    const { onClose } = this.props;

    return (
      <div className="dialog-join-group__top-header-bar">
        <span
          className={'apple-close'}
          onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
            event.stopPropagation();
            onClose();
          }}
        />
      </div>
    );
  }

  public render() {
    const { i18n, onClose } = this.props;
    const { hostName, pathName, inviteCode, loading } = this.state;

    if (hostName !== 'group' || pathName !== '/join' || !inviteCode) {
      (window as any).alert(i18n('unsupportedLink'));
      if (onClose) {
        onClose();
      }

      return null;
    }

    return (
      <Dialog
        onClose={() => {
          onClose();
        }}
        escClose={!loading}
      >
        <div className="join-group">
          {this.renderHeaderToolbar()}
          <div className="dialog-join-group_group-info-container">
            {this.renderGroupAvatar()}
            {this.renderGroupName()}
          </div>

          {this.renderJoinButton()}
          {this.renderLoading()}
        </div>
      </Dialog>
    );
  }

  public setLoadingStatus(loading: boolean) {
    this.setState({ loading });
  }

  public getErrorMessage(error: any, i18nDefaultKey: string) {
    const { i18n } = this.props;

    let i18nKey = i18nDefaultKey;
    const { response, name, code } = error || {};
    if (name === 'HTTPError' && code === 400) {
      const { status } = response || {};
      switch (status) {
        case API_STATUS.InvalidParameter:
          i18nKey = 'invalidArgument';
          break;
        case API_STATUS.NoPermission:
          i18nKey = 'invitationLinkExpired';
          break;
        case API_STATUS.NoSuchGroup:
          i18nKey = 'noSuchGroup';
          break;
        case API_STATUS.InvalidToken:
          i18nKey = 'invitationLinkExpired';
          break;
        case API_STATUS.GroupMemberCountExceeded:
          // group is full or member count exceeded
          i18nKey = 'groupMemberCountExceeded';
          break;
        case API_STATUS.InvalidGroupInviteLink:
          i18nKey = 'invalidGroupInviteLink';
          break;
        case API_STATUS.GroupDisabledInviteLink:
          i18nKey = 'groupDisabledInviteLink';
          break;
        case API_STATUS.GroupOnlyAllowsModeratorsInvite:
          i18nKey = 'groupOnlyAllowsModeratorsInvite';
          break;
        case API_STATUS.GroupHasAlreadyBeenDisbanded:
          i18nKey = 'groupHasAlreadyBeenDisbanded';
          break;
        case API_STATUS.GroupIsInvalid:
          i18nKey = 'groupIsInvalid';
          break;
      }
    }

    return i18n(i18nKey) || i18n(i18nDefaultKey);
  }

  public async getGroupInfo() {
    const { onClose } = this.props;
    const messaging = (window as any).textsecure.messaging;
    const { inviteCode } = this.state;

    if (!inviteCode) {
      return;
    }

    this.setLoadingStatus(true);

    try {
      const info = await messaging.getGroupV2InfoByInviteCode(inviteCode);
      // "name": "newTest",
      // "messageExpiry": 600,
      // "avatar": "adfadf",
      // "invitationRule": 2,
      // "version": 2,
      // "members": null,
      // "membersCount": 3
      const { name, membersCount, avatar } = info.data;

      this.helperConv.set({
        commonAvatar: this.helperConv.parseGroupAvatar(avatar),
      });
      await this.helperConv.updateCommonAvatarFile();

      this.setState({
        groupName: name,
        groupMemberCount: membersCount,
        groupAvatarPath: this.helperConv.getAvatarPath(),
        joinButtonEnabled: true,
      });
    } catch (error) {
      (window as any).log.error('get group info failed, ', error);

      const i18nDefaultKey = 'cannotGetGroupInfoByInviteCode';
      const alertMessage = this.getErrorMessage(error, i18nDefaultKey);
      (window as any).alert(alertMessage);

      if (onClose) {
        onClose();
        return;
      }
    }

    this.setLoadingStatus(false);
    setTimeout(() => {
      this.btnRef.current?.focus();
    }, 5);
  }

  public async joinGroup() {
    const { onClose } = this.props;
    const { inviteCode } = this.state;
    const messaging = (window as any).textsecure.messaging;

    this.setLoadingStatus(true);

    if (inviteCode) {
      try {
        const info = await messaging.joinGroupV2ByInviteCode(inviteCode);
        const groupInfo = info.data;
        const { gid, name, version } = groupInfo;

        if (typeof gid !== 'string') {
          throw new Error(`Server response invalid gid: ${gid}`);
        }

        if (typeof name !== 'string') {
          throw new Error(`Server response invalid group name: ${name}`);
        }

        if (typeof version !== 'number') {
          throw new Error(`Server response invalid group version: ${version}.`);
        }

        // join group success
        //
        const idV1 = (window as any).Signal.ID.convertIdToV1(gid);
        const ConversationController = (window as any).ConversationController;
        const conversation = await ConversationController.getOrCreateAndWait(
          idV1,
          'group'
        );
        if (!conversation) {
          throw new Error(`Can not get group conversation for gid:${gid}`);
        }

        conversation.queueJob(async () => {
          const changeVersion = conversation.get('changeVersion') || 0;
          const existMembers = conversation.get('members') || [];
          const ourNumber = (window as any).textsecure.storage.user.getNumber();

          // do not compare version vs changeVersion
          // as notification maybe arrived before this check,
          // maybe update to date
          // so, just compare ourNumber not in group members
          if (version > changeVersion || !existMembers.includes(ourNumber)) {
            // update group info
            const { avatar, members } = groupInfo;
            groupInfo.commonAvatar = conversation.parseGroupAvatar(avatar);
            conversation.updateAttributesGroup(groupInfo);

            const now = Date.now();

            // set conversation active
            conversation.set({
              active_at: now,
              isArchived: false,
              group_version: 2,
              changeVersion: version,
              left: false,
            });

            // only version >= changeVersion, members is the latest
            // others, should full load from server.
            // when version === changeVersion, notification arrived earlier.
            if (version >= changeVersion && members instanceof Array) {
              const membersV2 = members.map(
                (m: { uid: string; role: any; displayName: any }) => ({
                  id: m.uid,
                  role: m.role,
                  displayName: m.displayName,
                })
              );

              const membersV1 = membersV2.map((m: { id: string }) => m.id);

              conversation.set({
                members: membersV1,
                membersV2,
              });

              await conversation.updateGroupContact();
            } else {
              await conversation.apiLoadGroupV2();
            }
            // save conversation changes
            await (window as any).Signal.Data.updateConversation(
              conversation.attributes
            );

            const groupUpdate = {
              joined: conversation.get('members') || [],
              name,
            };

            const expireTimer = conversation.getConversationMessageExpiry();
            // message with no sender
            const message = new (window as any).Whisper.Message({
              sent_at: now,
              received_at: now,
              conversationId: idV1,
              // type: 'incoming',
              // unread: 1,
              group_update: groupUpdate,
              expireTimer,
              serverTimestamp: now,
            });

            const id = await (window as any).Signal.Data.saveMessage(
              message.attributes,
              {
                Message: (window as any).Whisper.Message,
              }
            );
            message.set({ id });
            (window as any).MessageController.register(message.id, message);

            conversation.trigger('newmessage', message);
          } else {
            // local group version bigger, do nothing
          }
        });

        trigger('showConversation', idV1);

        if (onClose) {
          onClose();
          return;
        }
      } catch (error) {
        (window as any).log.error('join group failed, ', error);

        const i18nDefaultKey = 'cannotJoinGroupByInviteCode';
        const alertMessage = this.getErrorMessage(error, i18nDefaultKey);
        (window as any).alert(alertMessage);

        // if (onClose) {
        //   onClose();
        //   return;
        // }
      }
    }

    this.setLoadingStatus(false);
  }
}
