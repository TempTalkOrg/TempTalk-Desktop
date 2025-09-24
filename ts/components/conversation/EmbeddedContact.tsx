import React from 'react';
import classNames from 'classnames';

import { Contact } from '../../types/Contact';

import { LocalizerType } from '../../types/Util';
import {
  renderAvatar,
  // renderContactNumber,
  // renderContactEmail,
  renderName,
} from './_contactUtil';
// import ProfileModal from '../ProfileModal';
import { Profile } from '../commonSettings/Profile';
import { Popover } from 'antd';

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  //分享人id
  shareId?: string;
  i18n: LocalizerType;
  isIncoming: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;
  onClick?: () => void;
}

interface State {
  userId: any;
  showProfileDialog?: boolean;
  x: number;
  y: number;
  isBot: boolean;
  popoverPlacement: string;
}

export class EmbeddedContact extends React.Component<Props, State> {
  public contactDivRef: React.RefObject<HTMLDivElement>;
  public positionChecker: NodeJS.Timeout | undefined;
  public profileCardCloseTimer: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);
    this.contactDivRef = React.createRef();
    const userId = props.contact.number;

    let isBot = false;
    if (userId && userId.length <= 6) {
      isBot = true;
    }

    this.state = {
      userId,
      showProfileDialog: false,
      x: 0,
      y: 0,
      isBot,
      popoverPlacement: 'rightTop',
    };
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
      } else if (y > maxCardHeight) {
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

    const rect = this.contactDivRef?.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    if (visible) {
      this.positionChecker = setInterval(() => {
        const currRect = this.contactDivRef?.current?.getBoundingClientRect();
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
  public showUserProfile = () => {
    if (this.contactDivRef.current && this.state.userId) {
      // window.screenLeft，window.screenTop 表示窗口左上角相对于screen的位置
      const rect = this.contactDivRef.current.getBoundingClientRect();
      this.showProfileCardLeftRight(rect);
    }
  };
  public setupProfileCardCloseTimer() {
    this.clearProfileCardCloseTimer();

    if (this.state.userId) {
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

  public renderProfile() {
    const { i18n, shareId } = this.props;

    const id = this.state.userId;
    if (!id) {
      return null;
    }

    return (
      <Profile
        id={id}
        i18n={i18n}
        shareid={shareId}
        onClose={() => {
          this.setState({ showProfileDialog: false });
        }}
        x={0}
        y={0}
        avatarPath={undefined}
      />
    );
  }
  public render() {
    const { i18n } = this.props;
    // const direction = isIncoming ? 'incoming' : 'outgoing';
    return (
      <Popover
        overlayClassName={'avatar-context-popover'}
        placement={this.getPlacement()}
        content={this.renderProfile()}
        trigger="click"
        open={this.state.showProfileDialog}
        onOpenChange={visible => this.handlePopoverVisibleChange(visible)}
        destroyTooltipOnHide={true}
      >
        <div
          className={'module-embedded-contact-block'}
          onClick={this.showUserProfile}
        >
          <div className={'contact-card-title'}>
            <span className={'contact-icon'} />
            {i18n('contact_card')}
          </div>
          {this.renderContact()}
          {/*<div className={'module-embedded-contact__bottom--' + direction}>*/}
          {/*  {i18n('contact_card')}*/}
          {/*</div>*/}
        </div>
        {/*// ) : null}*/}
        {/*{this.state.showProfileDialog ? (*/}
        {/*  <ProfileModal*/}
        {/*    onClose={() => {*/}
        {/*      this.setState({ showProfileDialog: false });*/}
        {/*    }}*/}
        {/*  >*/}
        {/*    <Profile*/}
        {/*      id={this.state.userId || ''}*/}
        {/*      i18n={i18n}*/}
        {/*      onClose={() => {*/}
        {/*        this.setState({ showProfileDialog: false });*/}
        {/*      }}*/}
        {/*      x={this.state.x}*/}
        {/*      y={this.state.y}*/}
        {/*      avatarPath={undefined}*/}
        {/*    />*/}
        {/*  </ProfileModal>*/}
        {/*) : null}*/}
      </Popover>
    );
  }

  public renderContact() {
    const {
      contact,
      i18n,
      isIncoming,
      // onClick,
      withContentAbove,
      withContentBelow,
    } = this.props;
    const module = 'embedded-contact';
    const direction = isIncoming ? 'incoming' : 'outgoing';

    return (
      <div
        ref={this.contactDivRef}
        className={classNames(
          'module-embedded-contact',
          withContentAbove
            ? 'module-embedded-contact--with-content-above'
            : null,
          withContentBelow
            ? 'module-embedded-contact--with-content-below'
            : null
        )}
        role="button"
      >
        {renderAvatar({
          contact,
          i18n,
          size: 36,
          direction,
          noClickEvent: true,
        })}
        <div className="module-embedded-contact__text-container">
          {renderName({ contact, isIncoming, module })}
          {/* {renderContactNumber({ contact, isIncoming, module })} */}
          {/* {renderContactEmail({ contact, isIncoming, module })} */}
        </div>
      </div>
    );
  }
}
