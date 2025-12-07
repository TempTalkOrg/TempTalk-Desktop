import React from 'react';
import { trigger } from '../../shims/events';
import { LocalizerType } from '../../types/Util';
import { Avatar } from '.././Avatar';
import ProfileItem from './ProfileItem';

import type { MenuProps } from 'antd/lib/menu';
import Modal from 'antd/lib/modal';
import Tooltip from 'antd/lib/tooltip';

import { isEqual } from 'lodash';
import { processImageFile } from '../../util/processImageFile';
import {
  getConversationModel,
  getConversationProps,
  getOrCreateConversationModel,
} from '../../shims/Whisper';
import { StateType } from '../../state/reducer';
import { ContextMenu } from '../shared/ContextMenu';
import { IconWrapper } from '../shared/IconWrapper';
import { UserStorage } from '../../shims/storage';
import { IconCall } from '../shared/icons';
import { API_STATUS } from '../../types/APIStatus';
import { AutoSizeInput } from '../shared/AutoSizeInput';

export interface Props {
  i18n: LocalizerType;
  onClose: () => void;
  id: any;
  //个人分享id
  shareid?: string;
  x: number;
  y: number;
  avatarPath?: string;
  dialogShownAt?: number;
  allowUpload?: boolean;
}

interface State {
  userInfo: any;
  editSignMode: boolean;
  editNameMode: boolean;
  editRemarkNameMode: boolean;
  newSignature: string;
  newName: string;
  tips: string;
  isBot: boolean;
  isTestImage: boolean;
  testImageData: string;
  showEditNameButton: boolean;
  showEditSignatureButton: boolean;
  dialogShownAt?: number;
  remarkName?: string;
}

interface ProfileItemProps {
  field: string;
  title: string;
  isShowCopy?: boolean;
  isRole?: boolean;
  isShowTip?: boolean;
  onClick?: (event: any) => void;
  isShowArrowimg?: boolean;
  onClickArrowimg?: (event: any) => void;
}

// const nameLengthMax = 30;
const signLengthMax = 80;

export class Profile extends React.Component<Props, State> {
  public dismissTipsTimer: number;
  public inputRefImageSelect: React.RefObject<HTMLInputElement>;
  public profileRef: React.RefObject<HTMLDivElement>;

  isBotId(id: string) {
    return id?.length <= 6;
  }

  constructor(props: Readonly<Props>) {
    super(props);
    this.profileRef = React.createRef();

    const isBot = this.isBotId(props.id);

    this.state = {
      userInfo: undefined,
      editSignMode: false,
      editNameMode: false,
      editRemarkNameMode: false,
      newSignature: '',
      newName: '',
      tips: '',
      isBot,
      isTestImage: false,
      testImageData: '',
      showEditNameButton: false,
      showEditSignatureButton: false,
    };

    this.inputRefImageSelect = React.createRef();
    this.dismissTipsTimer = 0;
  }

  updateUserInfoState(id: string) {
    if (!id) {
      return;
    }

    const conversation = getConversationModel(id);
    if (!conversation) {
      return;
    }

    let newSignature = conversation.get('signature');
    if (newSignature && newSignature.length > signLengthMax) {
      newSignature = newSignature.substr(0, signLengthMax);
    }

    let newName = conversation.getName();
    if (!newName) {
      newName = conversation.getTitle() || conversation.getNumber();
    }

    const newState = {
      newSignature,
      newName,
      isBot: conversation.isBot(),
      remarkName: conversation.getRemarkName(),
    };

    if (!isEqual(conversation.format(), this.state.userInfo)) {
      this.setState({
        ...newState,
        userInfo: conversation.format(),
      });
    } else {
      this.setState(newState);
    }
  }

  async componentDidMount() {
    const { id } = this.props;

    // 添加关闭profile对话框监听
    window.addEventListener('event-close-user-profile', this.closeSelf);

    const conversation = await getOrCreateConversationModel(id, 'private');
    if (!conversation) {
      return;
    }

    this.updateUserInfoState(id);

    setTimeout(async () => {
      await conversation.throttledForceUpdatePrivateContact();
      this.updateUserInfoState(id);
    }, 0);
  }

  shouldComponentUpdate(nextProps: Readonly<Props>): boolean {
    if (this.props.dialogShownAt !== nextProps.dialogShownAt) {
      const { id } = this.props;
      this.updateUserInfoState(id);

      setTimeout(async () => {
        const conversation = await getOrCreateConversationModel(id, 'private');
        if (!conversation) {
          return;
        }

        await conversation.throttledForceUpdatePrivateContact();
        this.updateUserInfoState(id);
      }, 0);

      return false;
    }
    return true;
  }

  public componentWillUnmount = () => {
    window.removeEventListener('event-close-user-profile', this.closeSelf);

    if (this.dismissTipsTimer) {
      clearTimeout(this.dismissTipsTimer);
    }
  };

  public closeSelf = () => {
    this.props?.onClose();
  };

  public formatSecond(sec: number | undefined) {
    const { i18n } = this.props;

    if (!sec) {
      return '';
    }

    if (sec < 60 * 60) {
      return i18n('active_minutes_ago', [`${Math.floor(sec / 60)}`]);
    }

    if (sec < 60 * 60 * 24) {
      return i18n('active_hours_ago', [`${Math.floor(sec / 60 / 60)}`]);
    }

    if (sec < 60 * 60 * 24 * 7) {
      return i18n('active_days_ago', [`${Math.floor(sec / 60 / 60 / 24)}`]);
    }

    if (sec < 60 * 60 * 24 * 30) {
      return i18n('active_weeks_ago', [
        `${Math.floor(sec / 60 / 60 / 24 / 7)}`,
      ]);
    }

    return i18n('active_months_ago');
  }

  public mouseOverName = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditNameButton: true });
    //   return;
    // }
  };

  public mouseLeaveName = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditNameButton: false });
    //   return;
    // }
  };

  public mouseOverSign = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditSignatureButton: true });
    // }
  };

  public mouseLeaveSign = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditSignatureButton: false });
    // }
  };

  public shareContact = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { userInfo } = this.state;
    const number = userInfo?.id;
    const name = this.state.newName;
    if (number) {
      const myEvent = new CustomEvent('event-share-user-contact', {
        detail: { number, name },
      });
      window.dispatchEvent(myEvent);
      this.props?.onClose();
    }
  };
  public addFriend = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { id, i18n, onClose } = this.props;

    const model = getConversationModel(id);
    try {
      await model.sendFriendRequest();
      (window as any).noticeSuccess(i18n('friendRequestSent'));

      model.forceSendMessageAuto(
        i18n('friendRequest'),
        null,
        [],
        null,
        null,
        null,
        null,
        null,
        null,
        null
      );

      onClose?.();
    } catch (e: any) {
      let errorMessage = '';
      switch (e?.response?.status) {
        case API_STATUS.AccountLoggedOut:
          errorMessage = i18n('addFriendError.accountLoggedOut');
          break;
        default:
          errorMessage = 'network error';
      }
      (window as any).noticeError(errorMessage);
    }
  };

  public onClickCommonGroups = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currOpenedId = (window as any).getCurrentOpenConversation();
    if (!currOpenedId) {
      return;
    }

    const model = getConversationModel(currOpenedId);
    if (!model) {
      return;
    }

    const { id, onClose } = this.props;

    // show common groups for current profile
    model.trigger('showCommonGroups', id);

    onClose?.();
  };
  public openChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { userInfo } = this.state;
    let conversationFrom = null;
    if (this.props.shareid) {
      conversationFrom = {
        uid: userInfo?.id,
        id: this.props.shareid,
        type: 'shareContact',
        isSend: true,
      };
    }

    trigger(
      'showConversation',
      userInfo?.id,
      null,
      null,
      null,
      conversationFrom
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
    this.props?.onClose();
  };

  public openCall = (e: React.MouseEvent) => {
    const { i18n } = this.props;
    e.preventDefault();
    e.stopPropagation();

    const theUser = getConversationModel(this.props?.id);
    if (!theUser || !theUser.isDirectoryUser()) {
      return alert(i18n('different_subteam_error'));
    }

    const { userInfo } = this.state;
    trigger('showConversation', userInfo?.id);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);

    const username = (window as any).textsecure.storage.get('number_id');
    const password = (window as any).textsecure.storage.get('password');
    const deviceId = UserStorage.getDeviceId();

    const ourNumber = UserStorage.getNumber();
    const roomName = theUser.cachedProps.name;
    const ourName: string = getConversationModel(ourNumber!).getName();

    (window as any).dispatchCallMessage('startCall', {
      isPrivate: true,
      roomName,
      ourName,
      number: theUser.id,
      username,
      password,
      type: '1on1',
      deviceId,
    });

    this.props?.onClose();
  };

  public inputUploadImage = () => {
    if (this.inputRefImageSelect.current) {
      this.inputRefImageSelect.current.click();
    }
  };

  public inputImageSelectChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      if (event.target.files && event.target.files[0]) {
        if (this.state.testImageData) {
          this.showTips('[Upload Avatar] unknown error, try again!');
          return;
        }

        const file = event.target.files[0];
        if (file.size === 0 || file.size > 10 * 1024 * 1024) {
          this.showTips(this.props.i18n('profile_bad_avatar_image_size'));
          return;
        }

        let newAvatar: Uint8Array;
        try {
          newAvatar = await processImageFile(file);
        } catch (err) {
          // Processing errors should be rare; if they do, we silently fail. In an ideal
          //   world, we may want to show a toast instead.
          return;
        }
        if (newAvatar) {
          const b64Avatar =
            'data:image/png;base64,' +
            (window as any).Signal.Crypto.arrayBufferToBase64(newAvatar);
          this.setState({ isTestImage: true, testImageData: b64Avatar });
        }

        // const reader = new FileReader();
        // reader.onload = (e: ProgressEvent<FileReader>) => {
        //   const imageData = e?.target?.result;
        //
        //   // NOT SUPPORT GIF FORMAT
        //   if (typeof imageData === 'string') {
        //     debugger
        //     const pos = imageData.indexOf(';base64,');
        //     if (pos !== -1) {
        //       const dst = imageData.substr(pos + 8);
        //       if (dst.startsWith('R0lGODlh') || dst.startsWith('R0lGODdh')) {
        //         this.showTips(this.props.i18n('profile_load_image_failed'));
        //         return;
        //       }
        //     }
        //   }
        //
        //   if (typeof imageData === 'string') {
        //     this.setState({ isTestImage: true, testImageData: imageData });
        //   }
        // };
        // reader.readAsDataURL(file);
      }
    } catch (e) {
      console.error('[Upload Avatar] exception:', e);
      this.showTips('[Upload Avatar] unknown error, try again!');
    } finally {
      if (this.inputRefImageSelect.current) {
        this.inputRefImageSelect.current.value = '';
      }
    }
  };

  public showTips = (text: string) => {
    if (this.dismissTipsTimer) {
      clearTimeout(this.dismissTipsTimer);
      this.dismissTipsTimer = 0;
    }
    this.setState({ tips: text });
    this.dismissTipsTimer = window.setTimeout(() => {
      this.dismissTipsTimer = 0;
      this.setState({ tips: '' });
    }, 1500);
  };

  public showCopiedTips = () => {
    const { i18n } = this.props;
    this.showTips(i18n('profile_copied'));
  };

  public copyName = async () => {
    const { newName } = this.state;
    if (newName) {
      (window as any).copyText(newName);
      this.showCopiedTips();
    }
  };

  public renderTestImage() {
    if (this.state.isTestImage) {
      return (
        <img
          src={this.state.testImageData}
          onError={() => {
            this.showTips(this.props.i18n('profile_load_image_failed'));
            this.setState({ isTestImage: false, testImageData: '' });
          }}
          onLoad={() => {
            const imageData = this.state.testImageData;
            (window as any).uploadAvatar(imageData);
            this.setState({ isTestImage: false, testImageData: '' });
          }}
          style={{ display: 'none' }}
        />
      );
    }
    return null;
  }

  public signatureEditComplete = async (textComplete: string | undefined) => {
    let text = textComplete;
    if (text && text.length > signLengthMax) {
      text = text.substr(0, signLengthMax);
    }
    if (this.state.newSignature === text) {
      this.setState({ editSignMode: false });
      return;
    }

    this.setState({ editSignMode: false, newSignature: text || '' });
    const res = await (window as any).updateSignature(text);
    if (!res) {
      this.props?.onClose();
    }
  };

  public renderSign() {
    // const { i18n } = this.props;
    const { userInfo, newSignature, showEditSignatureButton } = this.state;
    const isMe = userInfo?.isMe;

    if (!newSignature && !isMe) {
      return null;
    }

    if (this.state.editSignMode) {
      return (
        <AutoSizeInput
          content={newSignature}
          onComplete={this.signatureEditComplete}
          className="signature-input"
          maxLength={80}
        />
      );
    }

    const displaySign = newSignature || '';

    return (
      <div
        style={{
          position: 'relative',
          // width: '232px',
          maxHeight: '40px',
          // margin: '0 24px 8px 24px',
          padding: '0 24px 8px 24px',
        }}
        onMouseOver={this.mouseOverSign}
        onMouseLeave={this.mouseLeaveSign}
      >
        <span
          className={'profile-signature'}
          style={{
            display: '-webkit-box',
            wordBreak: 'break-word',
            fontWeight: 400,
            alignItems: 'center',
            fontStyle: 'normal',
          }}
        >
          <Tooltip
            title={displaySign}
            align={{ offset: [0, 5] }}
            placement={'top'}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            {displaySign}
          </Tooltip>
        </span>

        {showEditSignatureButton ? (
          <label
            className={'edit-btn'}
            style={{ right: '10px' }}
            onClick={() => {
              this.setState({ editSignMode: true });
            }}
          />
        ) : null}
      </div>
    );
  }

  public transferTimeZone = (timeZoneStr: string) => {
    const { i18n } = this.props;
    // 整数格式化，前面补零
    const fn = (num: number, length: number) => {
      return ('' + num).length < length
        ? (new Array(length + 1).join('0') + num).slice(-length)
        : '' + num;
    };

    let timeZone: any = parseFloat(timeZoneStr);
    if (!timeZone && timeZone !== 0) {
      return undefined;
    }

    // 可能会有半时区，1/4时区，3/4时区的情况，需要转化为float处理
    timeZone = parseFloat(timeZone.toFixed(2));

    if (timeZone >= -12 && timeZone <= 14) {
      const date = new Date(Date.now() + timeZone * 60 * 60 * 1000);

      let hours = date.getUTCHours();
      const minutes = fn(date.getUTCMinutes(), 2);

      if (hours === 12) {
        return i18n('time_format_noon', ['12:' + minutes]);
      }
      if (hours === 0) {
        return i18n('time_format_midnight', ['12:' + minutes]);
      }
      if (hours < 12) {
        return i18n('time_format_am', [hours + ':' + minutes]);
      }
      if (hours > 12) {
        return i18n('time_format_pm', [(hours % 12) + ':' + minutes]);
      }
    }

    return undefined;
  };

  public remarkNameEditComplete = async (textComplete: string | undefined) => {
    const { id } = this.props;
    let text = textComplete;
    // if (text && text.length > nameLengthMax) {
    //   text = text.substr(0, nameLengthMax);
    // }
    if (this.state.newName === text) {
      this.setState({ editRemarkNameMode: false });
      return;
    }

    const oldName = this.state.newName;
    this.setState({ editRemarkNameMode: false, newName: text?.trim() || '' });
    try {
      const newRemarkName = (text || '').trim();
      const accountName = this.state?.userInfo?.accountName;
      // await onSetRemarkName?.(newRemarkName);
      const conversation = (window as any).ConversationController.get(id);
      if (!conversation) {
        return;
      }
      await conversation.setRemarkName(newRemarkName);

      this.setState({ remarkName: newRemarkName });
      if (newRemarkName === '') {
        this.setState({ newName: accountName });
      }
    } catch (e) {
      this.setState({ editRemarkNameMode: false, newName: oldName });
    }
  };

  public nameEditComplete = async (textComplete: string | undefined) => {
    let text = textComplete;
    // if (text && text.length > nameLengthMax) {
    //   text = text.substr(0, nameLengthMax);
    // }
    if (this.state.newName === text) {
      this.setState({ editNameMode: false });
      return;
    }

    const oldName = this.state.newName;
    this.setState({ editNameMode: false, newName: text?.trim() || '' });
    const res = await (window as any).updateName((text || '').trim());
    if (!res) {
      // this.props?.closeSetting();
      this.setState({ editNameMode: false, newName: oldName });
    }
  };

  public doDeleteContact = async () => {
    const id = this.state.userInfo?.id;
    if (!id) {
      return;
    }

    try {
      const model = getConversationModel(id);
      await model?.deleteFriendship();
    } catch (error) {
      (window as any).noticeError('network error');

      console.log(
        'Failed to successfully delete conversation after delete contact'
      );
    }
  };

  public onDeleteContact = async () => {
    const { i18n } = this.props;

    Modal.confirm({
      title: '',
      icon: null,
      content: i18n('deleteContactConfirmation'),
      getContainer: () => {
        return this.profileRef?.current as any;
      },
      okButtonProps: {
        danger: true,
        ghost: true,
      },
      cancelButtonProps: {
        ghost: true,
        type: 'primary',
      },
      okText: i18n('delete'),
      cancelText: i18n('cancel'),
      onOk: this.doDeleteContact,
    });
  };

  public getProfileOperations() {
    const { i18n } = this.props;
    const { isBot, userInfo } = this.state;

    const operations: MenuProps['items'] = [
      {
        label: i18n('editContact'),
        key: 'edit-contact',
        onClick: () => this.setState({ editRemarkNameMode: true }),
      },
    ];

    if (!isBot && userInfo?.directoryUser) {
      operations.push({
        label: (
          <span style={{ color: 'var(--dst-color-text-error)' }}>
            {i18n('deleteContact')}
          </span>
        ),
        key: 'delete-contact',
        onClick: this.onDeleteContact,
      });
    }

    return operations;
  }

  public renderName() {
    const { editRemarkNameMode, newName, userInfo, remarkName } = this.state;
    const { i18n } = this.props;
    const isMe = userInfo?.isMe;
    if (editRemarkNameMode) {
      return (
        <AutoSizeInput
          content={newName}
          maxLength={30}
          onComplete={this.remarkNameEditComplete}
          className="signature-input name-input edit-remark-input"
        />
      );
    }

    return (
      <>
        <div
          style={{
            padding: '24px 10px 0px 0px',
            display: 'flex',
            flexFlow: 'row nowrap',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            className={'profile-name'}
            style={{
              width: '180px',
              pointerEvents: 'none',
              display: '-webkit-box',
              lineHeight: '24px',
              fontSize: '16px',
              fontWeight: 510,
              position: 'relative',
              // padding: '24px 42px 0 0',
              wordBreak: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            onMouseOver={this.mouseOverName}
            onMouseLeave={this.mouseLeaveName}
          >
            {newName}
          </span>
          {!isMe ? (
            // <label
            //   className={'edit-btn'}
            //   onClick={() => {
            //     this.setState({ editRemarkNameMode: true });
            //   }}
            //   style={{ right: '10px', top: 28 }}
            // />
            <ContextMenu
              menu={{ items: this.getProfileOperations() }}
              trigger={['click']}
              align={{
                offset: [4, 0],
              }}
            >
              <IconWrapper>
                <div className="module-gear-icon"></div>
              </IconWrapper>
            </ContextMenu>
          ) : null}
        </div>
        {remarkName ? (
          <span
            className={'profile-account-name'}
            title={userInfo?.accountName || ''}
          >
            {i18n('accountName')}: {userInfo?.accountName ?? null}
          </span>
        ) : null}
      </>
    );
  }

  public renderTips() {
    const { tips } = this.state;
    if (!tips) {
      return null;
    }

    return <p className={'info-tips'}>{tips}</p>;
  }

  public renderProfileItemTime() {
    const { i18n } = this.props;
    const { userInfo } = this.state;
    const isMe = userInfo?.isMe;
    let timeZone = userInfo?.timeZone;
    let timeZoneChangeTypeNumber = Number(timeZone);
    let newTimeZone;
    if (timeZoneChangeTypeNumber >= 0) {
      newTimeZone = '+' + timeZoneChangeTypeNumber;
    } else {
      newTimeZone = timeZoneChangeTypeNumber;
    }

    if (isMe) {
      timeZone = -new Date().getTimezoneOffset() / 60 + '';
    }
    if (timeZone) {
      return (
        <ProfileItem
          isShowTip={false}
          isShowCopy={false}
          title={i18n('profile_time')}
          content={
            this.transferTimeZone(timeZone) + ' (UTC' + newTimeZone + ')'
          }
          onCopied={this.showCopiedTips}
          isRole={false}
        />
      );
    }
    return null;
  }

  public renderProfileItem(contentSource: any, item: ProfileItemProps) {
    const content = contentSource[item.field];

    if (content?.length) {
      return (
        <ProfileItem
          key={item.field}
          isShowTip={!!item.isShowTip}
          isShowCopy={!!item.isShowCopy}
          isShowArrowimg={!!item.isShowArrowimg}
          title={item?.title}
          content={content}
          onCopied={this.showCopiedTips}
          isRole={!!item.isRole}
          onClick={item.onClick}
          onClickArrowimg={item.onClickArrowimg}
        />
      );
    }
    return null;
  }

  public renderContactInfo() {
    const { i18n } = this.props;
    const { userInfo } = this.state;

    if (!userInfo) {
      return null;
    }
    const state = (window as any).inboxStore.getState();
    const { memberGroupLookup } = (state as StateType).conversations;
    const groups = memberGroupLookup[userInfo.id];

    let commonGroups: any;
    if (groups) {
      commonGroups = groups
        .map(id => getConversationProps(id))
        .filter(props => props.isAliveGroup);
    }
    const commonGroupNumber = commonGroups ? commonGroups.length : 0;
    userInfo.commonGroupNumber = commonGroupNumber.toString();

    const contactItems: Array<ProfileItemProps> = [];
    contactItems.push({
      field: 'uid',
      title: i18n('uid_name'),
      isShowCopy: false,
      isRole: false,
      isShowTip: false,
    });
    contactItems.push({
      field: 'joinedAt',
      title: i18n('joined_at'),
      isShowCopy: false,
      isRole: false,
      isShowTip: false,
    });
    if (!userInfo.isMe) {
      if (userInfo.directoryUser) {
        contactItems.push({
          field: 'met',
          title: i18n('how_you_met'),
          isShowCopy: false,
          isRole: false,
          isShowTip: false,
        });
      }

      if (userInfo.commonGroupNumber !== '0') {
        contactItems.push({
          field: 'commonGroupNumber',
          title: i18n('common_groups'),
          isShowCopy: false,
          isRole: true,
          isShowTip: true,
          isShowArrowimg: true,
          onClickArrowimg: this.onClickCommonGroups,
        });
      } else {
        contactItems.push({
          field: 'commonGroupNumber',
          title: i18n('common_groups'),
          isShowCopy: false,
          isRole: false,
          isShowTip: false,
          isShowArrowimg: false,
        });
      }
    } else {
      // contactItems.push({
      //   field: 'email',
      //   title: i18n('profile_email'),
      //   isShowCopy: true,
      //   isRole: false,
      //   isShowTip: false,
      // });
      // contactItems.push({
      //   field: 'phoneNumber',
      //   title: "phone",
      //   isShowCopy: true,
      //   isRole: false,
      //   isShowTip: false,
      // });
    }

    // return (
    //   <div style={{ padding: '0px 0px', marginBottom: '16px' }}>
    //     <span
    //       className={'profile-item-title'}
    //       style={{
    //         float: 'left',
    //         margin: '0 0 12px 24px',
    //         fontWeight: 510,
    //       }}
    //     >
    //       {i18n('contact_info')}
    //     </span>

    //     {contactItems.map(item => this.renderProfileItem(userInfo, item))}
    //     {this.renderProfileItemTime()}
    //   </div>
    // );

    return (
      <div style={{ padding: '0px 0px', marginBottom: '16px' }}>
        {/* <span
          className={'profile-item-title'}
          style={{
            float: 'left',
            margin: '0 0 12px 24px',
            fontWeight: 510,
          }}
        >
          {i18n('contact_info')}
        </span> */}

        {contactItems.map(item => this.renderProfileItem(userInfo, item))}
      </div>
    );
  }

  public renderProfileInfo() {
    //const { userInfo } = this.state;
    //const isMe = userInfo?.isMe;
    return (
      <div
        style={{ maxHeight: '394px', display: 'flex', flexDirection: 'column' }}
      >
        {this.renderSign()}
        <div className={'div-scroll'}>
          {/* //判断不是自己的隐藏 */}
          {/* {isMe ? this.renderContactInfo() : null} */}
          {this.renderContactInfo()}
        </div>
      </div>
    );
  }

  public stopPropagation = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  public render() {
    let { x, y, i18n, id, avatarPath, allowUpload } = this.props;

    const { userInfo, newName, isBot } = this.state;
    const isMe = userInfo?.isMe;
    const directoryUser = userInfo?.directoryUser;

    return (
      <div
        onDoubleClick={this.stopPropagation}
        ref={this.profileRef}
        className={'profile-dialog'}
        style={{
          marginLeft: x + 'px',
          marginTop: y + 5 + 'px',
          left: '0',
          top: '0',
          position: 'relative',
        }}
      >
        {this.renderTips()}
        <div style={{ maxHeight: '104px', paddingBottom: '8px' }}>
          <input
            type={'file'}
            ref={this.inputRefImageSelect}
            accept={'image/png, image/jpg, image/bmp, image/gif'}
            style={{ position: 'absolute', display: 'none' }}
            onChange={this.inputImageSelectChange}
          />
          {this.renderTestImage()}
          <div>
            <div
              style={{
                width: 'fit-content',
                display: 'inline-block',
                padding: '24px 0 8px 24px',
              }}
            >
              <Avatar
                id={userInfo?.id || id}
                conversationType={'direct'}
                i18n={i18n}
                size={56}
                avatarPath={userInfo?.avatarPath || avatarPath}
                name={newName}
                canUpload={
                  isMe && allowUpload ? this.inputUploadImage : undefined
                }
                canPreviewAvatar={!isMe || !allowUpload}
                noClickEvent={true}
              />
            </div>
            <div
              style={{
                width: '180px',
                height: '48px',
                margin: '0 auto ',
                float: 'right',
              }}
              onMouseOver={this.mouseOverName}
              onMouseLeave={this.mouseLeaveName}
            >
              {this.renderName()}
            </div>
            {/*{ (newSignature ||isMe)  ? this.renderSign() : null}*/}
          </div>
        </div>
        {this.renderProfileInfo()}

        <div style={{ height: '52px', marginTop: '5px' }}>
          <div className={'bottom-div'}>
            <Tooltip
              title={i18n('chat')}
              placement={'top'}
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
            >
              <label
                className={'chat-btn'}
                // style={{ float: 'left', margin: '16px 0 0 35px' }}
                onClick={this.openChat}
              />
            </Tooltip>
            {isMe || isBot || !directoryUser ? null : (
              <Tooltip
                title={i18n('call')}
                placement={'top'}
                mouseEnterDelay={1.5}
                overlayClassName={'antd-tooltip-cover'}
              >
                <label
                  className={'voice-btn'}
                  // style={{ margin: '16px 0 0 45px', float: 'left' }}
                  onClick={this.openCall}
                >
                  <IconCall color="var(--dst-color-icon)" />
                </label>
              </Tooltip>
            )}
            {!directoryUser ? null : (
              <Tooltip
                title={i18n('forward')}
                placement={'top'}
                mouseEnterDelay={1.5}
                overlayClassName={'antd-tooltip-cover'}
              >
                <label
                  className={'share-btn'}
                  style={{ float: 'right' }}
                  onClick={this.shareContact}
                />
              </Tooltip>
            )}
            {directoryUser ? null : (
              <Tooltip
                title={i18n('addFriend.profileEntry')}
                placement={'top'}
                mouseEnterDelay={1.5}
                overlayClassName={'antd-tooltip-cover'}
              >
                <label
                  className={'add-friend-btn'}
                  style={{ float: 'right' }}
                  onClick={this.addFriend}
                />
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  }
}
