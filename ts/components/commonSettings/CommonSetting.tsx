import React from 'react';
import { Avatar } from './../Avatar';
import { LocalizerType } from '../../types/Util';
import ProfileEditSignature from './ProfileEditSignature';
import { CommonSettingItem } from './CommonSettingComponents';
import { Profile } from './Profile';
import { Drawer } from 'antd';
import { ThemeSetting } from './ThemeSetting';
import { NotificationSetting } from './NotificationSetting';
import { GeneralSetting } from './GeneralSetting';
import { processImageFile } from '../../util/processImageFile';
import { LanguageSetting } from './LanguageSetting';
import AccountSetting from './AccountSetting';
import { getAccountManager } from '../../shims/apiService';
import { UserStorage } from '../../shims/storage';
import { FriendCode } from './FriendCode';
import { getConversationModel } from '../../shims/Whisper';

export interface Props {
  closeSetting: () => void;

  avatarPath?: string;
  i18n: LocalizerType;
  name?: string;
  id: string;
  leftPaneWidth: number;
}

interface State {
  userInfo: any;
  editSignMode: boolean;
  editNameMode: boolean;
  newSignature: string;
  newName: string;
  tips: string;
  isTestImage: boolean;
  testImageData: string;
  showEditNameButton: boolean;
  showEditSignatureButton: boolean;
  showThemeSetting: boolean;
  showNotificationSetting: boolean;
  showGeneralSetting: boolean;
  showLanguageSetting: boolean;
  showProfileDialog: boolean;
  showAccountSetting: boolean;
  showFriendCode: boolean;
  emailMasked?: string;
  phoneMasked?: string;
  profileLoading: boolean;
}

const signLengthMax = 80;

export class CommonSetting extends React.Component<Props, State> {
  public inputRefImageSelect: React.RefObject<HTMLInputElement>;
  public dismissTipsTimer: number;
  private mounted: boolean = false;

  constructor(props: Readonly<Props>) {
    super(props);

    this.state = {
      userInfo: undefined,
      editSignMode: false,
      editNameMode: false,
      newSignature: '',
      newName: '',
      tips: '',
      isTestImage: false,
      testImageData: '',
      showEditNameButton: false,
      showEditSignatureButton: false,
      showThemeSetting: false,
      showNotificationSetting: false,
      showGeneralSetting: false,
      showLanguageSetting: false,
      showProfileDialog: false,
      showAccountSetting: false,
      showFriendCode: false,
      emailMasked: '',
      phoneMasked: '',
      profileLoading: false,
    };

    this.inputRefImageSelect = React.createRef();
    this.dismissTipsTimer = 0;
  }

  async componentDidMount() {
    this.mounted = true;

    const conversation = getConversationModel(this.props.id);
    if (!conversation) {
      return;
    }

    this.updateUserInfoState(conversation);

    if (conversation.isPrivate()) {
      setTimeout(async () => {
        await conversation.throttledForceUpdatePrivateContact();
        this.updateUserInfoState(conversation);
      }, 0);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
    const { showAccountSetting } = this.state;
    if (showAccountSetting && !prevState.showAccountSetting) {
      this.loadDirectoryProfile();
    }
  }

  public closeCommonSetting = () => {
    this.props.closeSetting();
  };

  updateUserInfoState(conversation: any) {
    let newSignature = conversation.get('signature');
    if (newSignature && newSignature.length > signLengthMax) {
      newSignature = newSignature.substr(0, signLengthMax);
    }

    let newName = conversation.getName();
    if (!newName) {
      newName = conversation.getTitle() || conversation.getNumber();
    }

    this.setState({
      userInfo: conversation.format(),
      newSignature,
      newName,
    });
  }

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

  public mouseOverName = () => {
    if (this.state.editNameMode) {
      return;
    }
    this.setState({ showEditNameButton: true });
  };

  public mouseLeaveName = () => {
    this.setState({ showEditNameButton: false });
  };

  public mouseOverSignature = () => {
    if (this.state.editSignMode) {
      return;
    }
    this.setState({ showEditSignatureButton: true });
  };

  public mouseLeaveSignature = () => {
    this.setState({ showEditSignatureButton: false });
  };

  public nameEditComplete = async (textComplete: string | undefined) => {
    let text = textComplete;
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

  public signatureEditComplete = async (textComplete: string | undefined) => {
    const { i18n } = this.props;

    let text = textComplete;
    if (text && text.length > signLengthMax) {
      text = text.substr(0, signLengthMax);
    }
    if (this.state.newSignature === text) {
      this.setState({ editSignMode: false });
      return;
    }

    this.setState({
      editSignMode: false,
      newSignature: text || i18n('profile_set_status'),
    });
    const res = await (window as any).updateSignature(text);
    if (!res) {
      this.props?.closeSetting();
    }
  };

  renderAvatar() {
    const { avatarPath, i18n, name, id } = this.props;
    return (
      <Avatar
        id={id}
        avatarPath={avatarPath}
        conversationType="direct"
        i18n={i18n}
        name={name}
        size={88}
        canUpload={this.inputUploadImage}
        noClickEvent={true}
      />
    );
  }

  renderName() {
    const { editNameMode, newName, showEditNameButton } = this.state;

    if (editNameMode) {
      return (
        <ProfileEditSignature
          content={newName}
          editName={true}
          className={'setting-signature-edit setting-name-edit'}
          onComplete={this.nameEditComplete}
        />
      );
    } else {
      return (
        <div className="setting-info-title">
          {newName}
          {showEditNameButton ? (
            <label
              className={'setting-edit-btn'}
              onClick={() => {
                this.setState({
                  editNameMode: true,
                  showEditNameButton: false,
                });
              }}
            />
          ) : null}
        </div>
      );
    }
  }

  // renderSignature() {
  //   const { i18n } = this.props;
  //   const { userInfo, editSignMode, newSignature, showEditSignatureButton } =
  //     this.state;
  //   const isMe = userInfo?.isMe;

  //   if (editSignMode) {
  //     return (
  //       <ProfileEditSignature
  //         content={newSignature}
  //         editName={false}
  //         className={'setting-signature-edit'}
  //         onComplete={this.signatureEditComplete}
  //       />
  //     );
  //   } else {
  //     return (
  //       <div className="setting-signature">
  //         <Tooltip
  //           title={newSignature || (isMe ? i18n('profile_set_status') : '')}
  //           align={{ offset: [0, 5] }}
  //           placement={'top'}
  //           mouseEnterDelay={1.5}
  //           overlayClassName={'antd-tooltip-cover'}
  //         >
  //           {newSignature || (isMe ? i18n('profile_set_status') : '')}
  //         </Tooltip>
  //         {showEditSignatureButton ? (
  //           <label
  //             className={'setting-edit-btn'}
  //             onClick={() => {
  //               this.setState({
  //                 editSignMode: true,
  //                 showEditSignatureButton: false,
  //               });
  //             }}
  //           />
  //         ) : null}
  //       </div>
  //     );
  //   }
  // }

  renderSettingItems() {
    const { i18n } = this.props;
    return (
      <div>
        <div className="setting-device-line common-setting-line"></div>

        <CommonSettingItem
          title={i18n('account')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showAccountSetting: true });
          }}
        />

        <CommonSettingItem
          title={i18n('theme')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showThemeSetting: true });
          }}
        />

        <CommonSettingItem
          title={i18n('notifications')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showNotificationSetting: true });
          }}
        />
        <CommonSettingItem
          title={i18n('general')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showGeneralSetting: true });
          }}
        />
        {/* <Popover
          overlayClassName={'avatar-context-popover'}
          placement="rightTop"
          open={this.state.showProfileDialog}
          content={this.renderProfile()}
          onOpenChange={visible =>
            this.setState({ showProfileDialog: visible })
          }
          destroyTooltipOnHide={true}
          trigger="click"
        >
          <div>
            <CommonSettingItem title={i18n('profile')} />
          </div>
        </Popover> */}
        <CommonSettingItem
          title={i18n('addFriend.entry')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showFriendCode: true });
          }}
        />

        <CommonSettingItem
          title={i18n('language')}
          showArrow={true}
          clickAction={() => {
            this.setState({ showLanguageSetting: true });
          }}
        />

        <CommonSettingItem
          title={i18n('helfAndFeedback')}
          clickAction={() => {
            const a = document.createElement('a');
            a.href = 'https://temptalk.app/contactus.html';
            a.click();
            a.remove();
          }}
        />

        <CommonSettingItem
          title={i18n('aboutDesktop')}
          clickAction={() => {
            this.openAbout();
          }}
        />

        {/*<CommonSettingItem*/}
        {/*  title={i18n('appMenuCheckForUpdates')}*/}
        {/*  clickAction={() => {*/}
        {/*    this.checkUpdates();*/}
        {/*  }}*/}
        {/*/>*/}
      </div>
    );
  }

  private readonly openAbout = () => {
    (window as any).showAbout();
  };

  // private readonly checkUpdates = () => {
  //   (window as any).manualCheckForUpdates();
  // };

  public renderProfile() {
    const { i18n, avatarPath, id } = this.props;

    if (!id) {
      return null;
    }

    return (
      <Profile
        id={id}
        i18n={i18n}
        onClose={() => {
          this.setState({ showProfileDialog: false });
        }}
        x={0}
        y={0}
        avatarPath={avatarPath}
        allowUpload={false}
      />
    );
  }

  async loadDirectoryProfile() {
    this.setState({ profileLoading: true });

    try {
      const data = await getAccountManager().getDirectoryProfile();

      if (!this.mounted) {
        return;
      }

      this.setState({
        emailMasked: data.emailMasked,
        phoneMasked: data.phoneMasked,
        profileLoading: false,
      });
    } catch (error) {
      console.log('get directory profile error', error);
      this.setState({
        emailMasked: undefined,
        phoneMasked: undefined,
        profileLoading: false,
      });
    }
  }

  public renderAccountSetting() {
    const { i18n, id, leftPaneWidth } = this.props;
    const {
      userInfo,
      emailMasked,
      phoneMasked,
      profileLoading,
      showAccountSetting,
    } = this.state;

    const uid = userInfo?.uid || (window as any).base58_encode(id.toString());

    const getDeviceName = () => {
      const deviceName = UserStorage.getDeviceName()?.replace(/\0/g, '');
      const hostName = (window as any).getHostName()?.replace(/\0/g, '');
      return deviceName || hostName;
    };

    return (
      <Drawer
        placement="left"
        open={showAccountSetting}
        width={leftPaneWidth}
        rootStyle={{ marginLeft: 68 }}
        styles={{
          wrapper: {
            boxShadow: 'none',
          },
        }}
        closeIcon={false}
        mask={false}
        destroyOnClose={true}
        zIndex={1000}
      >
        <AccountSetting
          i18n={i18n}
          id={uid}
          deviceName={getDeviceName()}
          email={emailMasked}
          phoneNumber={phoneMasked}
          onClose={() => this.setState({ showAccountSetting: false })}
          onRefreshProfile={() => this.loadDirectoryProfile()}
          profileLoading={profileLoading}
        />
      </Drawer>
    );
  }

  public renderThemeSetting() {
    const { i18n, leftPaneWidth } = this.props;
    const { showThemeSetting } = this.state;

    if (!showThemeSetting) {
      return null;
    } else {
      const closeSetting = () => {
        this.setState({ showThemeSetting: false });
      };

      return (
        <Drawer
          placement="left"
          open={this.state.showThemeSetting}
          width={leftPaneWidth}
          rootStyle={{ marginLeft: 68 }}
          styles={{
            wrapper: {
              boxShadow: 'none',
            },
          }}
          closable={false}
          mask={false}
          destroyOnClose={true}
          zIndex={1000}
        >
          <ThemeSetting
            i18n={i18n}
            title={i18n('theme')}
            closeSetting={closeSetting}
          />
        </Drawer>
      );
    }
  }

  public renderNotificationSetting() {
    const { i18n, leftPaneWidth } = this.props;
    const { showNotificationSetting } = this.state;

    if (!showNotificationSetting) {
      return null;
    } else {
      const closeSetting = () => {
        this.setState({ showNotificationSetting: false });
      };

      return (
        <Drawer
          placement="left"
          open={this.state.showNotificationSetting}
          width={leftPaneWidth}
          rootStyle={{ left: 68 }}
          styles={{
            wrapper: {
              boxShadow: 'none',
            },
          }}
          closable={false}
          mask={false}
          destroyOnClose={true}
          zIndex={1000}
        >
          <NotificationSetting
            i18n={i18n}
            title={i18n('notifications')}
            closeSetting={closeSetting}
          />
        </Drawer>
      );
    }
  }

  public renderGeneralSetting() {
    const { i18n, leftPaneWidth } = this.props;
    const { showGeneralSetting } = this.state;

    if (!showGeneralSetting) {
      return null;
    } else {
      const closeSetting = () => {
        this.setState({ showGeneralSetting: false });
      };

      return (
        <Drawer
          placement="left"
          open={this.state.showGeneralSetting}
          width={leftPaneWidth}
          rootStyle={{ left: 68 }}
          styles={{
            wrapper: {
              boxShadow: 'none',
            },
          }}
          closable={false}
          mask={false}
          destroyOnClose={true}
          zIndex={1000}
        >
          <GeneralSetting
            i18n={i18n}
            title={i18n('general')}
            closeSetting={closeSetting}
          />
        </Drawer>
      );
    }
  }

  public renderLanguageSetting() {
    const { i18n, leftPaneWidth } = this.props;
    const { showLanguageSetting } = this.state;
    if (!showLanguageSetting) {
      return null;
    }
    const closeSetting = () => {
      this.setState({ showLanguageSetting: false });
    };

    return (
      <Drawer
        placement="left"
        open={this.state.showLanguageSetting}
        width={leftPaneWidth}
        rootStyle={{ left: 68 }}
        styles={{
          wrapper: {
            boxShadow: 'none',
          },
        }}
        closable={false}
        mask={false}
        destroyOnClose={true}
        zIndex={1000}
      >
        <LanguageSetting
          i18n={i18n}
          title={i18n('language')}
          closeSetting={closeSetting}
        />
      </Drawer>
    );
  }

  public renderMyCode() {
    const { showFriendCode } = this.state;
    const { id, avatarPath, name, i18n, leftPaneWidth } = this.props;

    return (
      <Drawer
        placement="left"
        open={showFriendCode}
        width={leftPaneWidth}
        rootStyle={{ left: 68 }}
        styles={{
          wrapper: {
            boxShadow: 'none',
          },
        }}
        closable={false}
        mask={false}
        destroyOnClose={true}
        zIndex={1000}
      >
        <FriendCode
          id={id}
          avatarPath={avatarPath}
          name={name}
          i18n={i18n}
          closeSetting={() => this.setState({ showFriendCode: false })}
        />
      </Drawer>
    );
  }

  render() {
    return (
      <div id="common-setting" className="common-setting">
        <div className="header-bg"></div>
        <div className=" bottom-bg"></div>
        <div className="close-button" onClick={this.closeCommonSetting}>
          <div className="close-button-inner"></div>
        </div>
        <div className="setting-icon">
          <input
            type={'file'}
            ref={this.inputRefImageSelect}
            accept={'image/png, image/jpg, image/bmp, image/gif'}
            style={{ position: 'absolute', display: 'none' }}
            onChange={this.inputImageSelectChange}
          />
          {this.renderTestImage()}
          {this.renderAvatar()}
        </div>
        <div
          className="setting-edit-content-name"
          onMouseOver={this.mouseOverName}
          onMouseLeave={this.mouseLeaveName}
        >
          {this.renderName()}
        </div>
        {/* {this.renderStatus()} */}
        <div className="setting-list-content">
          {/* <div
            className="setting-edit-content-signature"
            onMouseOver={this.mouseOverSignature}
            onMouseLeave={this.mouseLeaveSignature}
          >
            {this.renderSignature()}
          </div> */}
          {this.renderSettingItems()}
          {this.renderAccountSetting()}
          {this.renderThemeSetting()}
          {this.renderNotificationSetting()}
          {this.renderGeneralSetting()}
          {this.renderLanguageSetting()}
          {this.renderMyCode()}
        </div>
      </div>
    );
  }
}
