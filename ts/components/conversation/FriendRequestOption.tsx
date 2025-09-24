import React from 'react';

import { LocalizerType } from '../../types/Util';
import classNames from 'classnames';
import { Button, Modal } from 'antd';

interface Props {
  i18n: LocalizerType;
  isBlocked: boolean;
  setBlockStatus: (block: boolean) => Promise<void>;
  acceptFriendRequest: () => Promise<void>;
  reportAbnormalUser: (
    type: number,
    reason: string,
    block: boolean
  ) => Promise<void>;
  findyouDescribe?: string;
}

interface State {
  modalOpen: boolean;
}

export class FriendRequestOption extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      modalOpen: false,
    };
  }

  private handleAccept = async () => {
    const { acceptFriendRequest } = this.props;

    try {
      await acceptFriendRequest();
    } catch (error) {
      console.log('Error while handleAccept', error);
      return;
    }
  };

  private handleUnblock = async () => {
    const { setBlockStatus, acceptFriendRequest } = this.props;

    try {
      await setBlockStatus(false);
      await acceptFriendRequest();
    } catch (error) {
      console.log('Error while handleUnblock', error);
      return;
    }
  };

  private showModal = () => this.setState({ modalOpen: true });
  private hideModal = () => this.setState({ modalOpen: false });

  private handleBlock = async () => {
    const { setBlockStatus } = this.props;

    try {
      await setBlockStatus(true);
    } catch (error) {
      console.log('Error while handleBlock', error);
      return;
    }

    this.hideModal();
  };

  private handleBlockAndReport = async () => {
    const { reportAbnormalUser, setBlockStatus } = this.props;

    try {
      // report first to makesure it will be always success
      await reportAbnormalUser(1, 'report reason', true);
      await setBlockStatus(true);
    } catch (error) {
      console.log('Error while handleBlockAndReport', error);
      return;
    }

    this.hideModal();
  };

  //从哪里来的请求
  public renderDescription() {
    const { findyouDescribe } = this.props;
    return (
      <>
        <div className="the_from">{findyouDescribe ? findyouDescribe : ''}</div>
      </>
    );
  }

  public renderUnblockButton() {
    const { i18n } = this.props;
    return (
      <>
        <Button variant="link" color="primary" onClick={this.handleUnblock}>
          {i18n('unblock')}
        </Button>
      </>
    );
  }

  public renderRequestButtons() {
    const { i18n } = this.props;

    return (
      <>
        <Button danger ghost onClick={this.showModal}>
          {i18n('block')}
        </Button>
        <Button
          type="primary"
          onClick={this.handleAccept}
          className={classNames('btn-blue')}
        >
          {i18n('acceptNewKey')}
        </Button>
        <Modal
          open={this.state.modalOpen}
          onOk={this.handleBlock}
          onCancel={this.hideModal}
          footer={[
            <Button key="submit" onClick={this.handleBlock}>
              {i18n('block')}
            </Button>,
            <Button key="report" danger onClick={this.handleBlockAndReport}>
              {i18n('blockAndReport')}
            </Button>,
            <Button key="back" onClick={this.hideModal}>
              {i18n('cancel')}
            </Button>,
          ]}
          width={360}
          styles={{
            footer: {
              paddingTop: 10,
            },
          }}
        >
          {i18n('ublockFriendMessage')}
        </Modal>
      </>
    );
  }

  public render() {
    const { isBlocked } = this.props;

    return (
      <>
        <div className="friend-request-option_content">
          {isBlocked ? null : this.renderDescription()}
          {isBlocked ? this.renderUnblockButton() : this.renderRequestButtons()}
        </div>
      </>
    );
  }
}
