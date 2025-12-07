import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { LocalizerType } from '../types/Util';
import { CallType } from '../state/ducks/conversations';
import MeetingTimer from './MeetingTimer';

export type PropsData = {
  ourNumber: string;
  call: CallType | null;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
};

type Props = PropsData & PropsHousekeeping;

export class ConversationListInstantCallItem extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.onJoinCall = this.onJoinCall.bind(this);
  }

  public onJoinCall() {
    const { call } = this.props;

    if (call) {
      const callOptions = {
        ...call,
        conversation: null,
      };

      (window as any).joinCall(callOptions);
    }
  }

  public renderAvatar() {
    const { call, i18n } = this.props;

    if (!call) {
      return null;
    }

    return (
      <div className="module-conversation-list-item__avatar-container">
        <Avatar
          name={call.name || 'Yelling Call'}
          color="grey"
          conversationType="direct"
          i18n={i18n}
          nonImageType="instant-call"
          size={36}
        />
      </div>
    );
  }

  public renderHeader() {
    const { i18n, call } = this.props;

    if (!call) {
      return null;
    }

    const isInCurrentCallNow =
      call && call.roomId === (window as any).currentCallRoomId;

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames('module-conversation-list-item__header__name')}
        >
          <ContactName
            phoneNumber={''}
            name={call.name || 'Yelling Call'}
            profileName={undefined}
            i18n={i18n}
          />
        </div>
        <div
          className={classNames('module-conversation-list-item__header__date')}
        >
          <div
            className={classNames(
              'module-left-pane__meeting-status-float-right'
            )}
          >
            {/* <span className="online">{call.online || ''}</span> */}
            <span
              role={'button'}
              className="duration"
              onClick={this.onJoinCall}
            >
              {call.createdAt && isInCurrentCallNow ? (
                <MeetingTimer startAt={call.createdAt / 1000} />
              ) : (
                'Join'
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  public render() {
    const { style } = this.props;

    return (
      <div
        role="button"
        style={style}
        className={classNames('module-conversation-list-item')}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
        </div>
      </div>
    );
  }
}
