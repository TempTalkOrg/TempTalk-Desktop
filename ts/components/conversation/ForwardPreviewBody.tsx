import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';
import { AttachmentType } from '../../types/Attachment';
// import { ContactName } from './ContactName';

export interface ForwardedMessage {
  timestamp: number;
  type: string;
  authorId: string;
  authorName: string;
  authorAccountName: string;
  isFromGroup?: boolean;
  text?: string;
  attachments?: Array<AttachmentType>;
  forwardedMessages?: Array<ForwardedMessage>;
  isSingleForward?: boolean;
  mentions?: Array<any>;
}

interface Props {
  i18n: LocalizerType;
  onClick?: (title: string, cid?: string) => void;
  forwardedMessages: Array<ForwardedMessage>;
  conversationId?: string;

  isConfidentialMessage?: boolean;
  isMouseOver?: boolean;
}

export class ForwardPreviewBody extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public getPreviewText(forwardedMessage: ForwardedMessage) {
    const { i18n } = this.props;

    const {
      attachments,
      forwardedMessages,
      text,
      authorAccountName,
      isSingleForward,
    } = forwardedMessage;

    let preview = authorAccountName + ':';

    if (attachments && attachments.length > 0) {
      preview += ' ' + i18n('shortForAttachment') + '\n';
    }

    if (text) {
      preview += ' ' + text;
    }

    if (!isSingleForward && forwardedMessages && forwardedMessages.length > 0) {
      preview += ' ' + i18n('placeholderWrapperForChatHistory');
    }

    return preview;
  }

  public renderMessagePreview() {
    const { forwardedMessages } = this.props;

    let count = 0;
    const maxPreviewCount = 3;

    return (
      <div className={classNames('forwarded-message-text')}>
        {forwardedMessages
          .filter((_, idx) => idx < maxPreviewCount)
          .map(m => (
            <div key={count++}>{this.getPreviewText(m)}</div>
          ))}
      </div>
    );
  }

  public render() {
    const {
      onClick,
      i18n,
      isMouseOver,
      isConfidentialMessage,
      forwardedMessages = [],
      conversationId,
    } = this.props;

    let title: string;
    if (forwardedMessages[0].isFromGroup) {
      title = i18n('forwardedGroupMessageTitle');
    } else {
      const participates = forwardedMessages
        .map(m => m.authorName)
        .filter((v, i, a) => a.indexOf(v) === i);

      if (participates.length === 1) {
        title = i18n('forwardedSinglePrivateMessageTitle', participates);
      } else {
        title = i18n('forwardedPairPrivateMessageTitle', participates);
      }
    }

    const isHide = isConfidentialMessage && !isMouseOver;

    return (
      <div
        style={isHide ? { background: '#B7BDC6' } : {}}
        className={classNames('forwarded-message-block')}
        onClick={() => {
          if (onClick) {
            onClick(title, conversationId);
          }
        }}
      >
        <div style={{ visibility: isHide ? 'hidden' : 'visible' }}>
          <div className={classNames('forwarded-message-title')}>{title}</div>
          {this.renderMessagePreview()}
          <hr className={classNames('forwarded-message-bottom-splitter')} />
          <div className={classNames('forwarded-message-bottom-tip')}>
            {i18n('placeholderForChatHistory')}
          </div>
        </div>
      </div>
    );
  }
}
