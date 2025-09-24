import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { MessageBody } from '../conversation/MessageBody';
import { ContactName } from '../conversation/ContactName';

import { LocalizerType } from '../../types/Util';

export type Props = {
  i18n: LocalizerType;
  firstMessageInfo: any;
  lastMessageInfo: any;
  threadMessage: any;
  botInfo: any;
  style?: Object;
  model?: any;
  onClick?: () => void;
};

export class TopicListItem extends React.Component<Props> {
  public wrapperRef: React.RefObject<HTMLDivElement>;

  public constructor(props: Props) {
    super(props);
    this.wrapperRef = React.createRef();
  }

  public renderAvatar() {
    const { firstMessageInfo, i18n, botInfo, threadMessage } = this.props;
    const { phoneNumber, avatarPath, color, name } = firstMessageInfo;
    const { botId, supportType } = threadMessage.get('threadContext');
    return (
      <div className="module-conversation-list-item__avatar-container">
        {(botId && supportType === 1) ||
        (botId && supportType === undefined) ? (
          <Avatar
            id={botInfo.phoneNumber}
            avatarPath={botInfo.avatarPath}
            color={botInfo.color}
            // noteToSelf={isMe}
            conversationType={'direct'}
            i18n={i18n}
            name={botInfo.name}
            size={36}
            noClickEvent={true}
          />
        ) : (
          <Avatar
            id={phoneNumber}
            avatarPath={avatarPath}
            color={color}
            // noteToSelf={isMe}
            conversationType={'direct'}
            i18n={i18n}
            name={name}
            size={36}
            noClickEvent={true}
          />
        )}
      </div>
    );
  }

  public renderHeader() {
    const { firstMessageInfo, i18n, threadMessage } = this.props;
    const { phoneNumber, name } = firstMessageInfo;
    const { sourceBrief, botId, groupId, groupName, supportType } =
      threadMessage.get('threadContext');
    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames('module-conversation-list-item__header__name')}
        >
          <ContactName
            phoneNumber={phoneNumber}
            name={name}
            i18n={i18n}
            sourceBrief={sourceBrief}
            botId={botId}
            groupId={groupId}
            groupName={groupName}
            supportType={supportType}
          />
        </div>
      </div>
    );
  }

  public renderMessage() {
    const { threadMessage, i18n, lastMessageInfo } = this.props;
    const { name } = lastMessageInfo;
    let forwards;
    if (threadMessage.attributes?.forwardContext) {
      forwards = threadMessage.attributes?.forwardContext.forwards;
    }
    const unSupportMessageType = '[Unsupported message type]';

    return (
      <div className="module-conversation-list-item__message">
        <div
          className={classNames('module-conversation-list-item__message__text')}
        >
          <MessageBody
            text={
              name +
              ' : ' +
              (threadMessage.get('body') &&
              threadMessage.get('body') !== unSupportMessageType
                ? threadMessage.get('body')
                : forwards && forwards?.length === 1
                  ? forwards[0].body
                  : threadMessage.getDescription(true))
            }
            disableJumbomoji={true}
            disableLinks={true}
            i18n={i18n}
          />
        </div>
      </div>
    );
  }

  public render() {
    const { threadMessage, model, style, onClick } = this.props;
    const newStyle = {
      ...style,
      overflow: 'overlay',
      maxWidth: '360px',
    };
    return (
      <div
        ref={this.wrapperRef}
        role="button"
        onClick={() => {
          model.defaultOnGoBackFromTopicList();
          model.onShowThread(threadMessage);
          if (onClick) {
            onClick();
          }
        }}
        style={newStyle}
        className={classNames('module-conversation-list-item')}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
          {this.renderMessage()}
        </div>
      </div>
    );
  }
}
