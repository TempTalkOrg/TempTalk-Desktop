import React from 'react';
import classNames from 'classnames';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
import { Timestamp } from '../conversation/Timestamp';

interface Props {
  id: string;
  conversationId: string;
  conversationType: 'group' | 'direct';
  isMe?: boolean;
  name?: string;
  color: string;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  style?: object;
  body: string;
  timestamp: number;
  messageId: string;
  className?: string;
}

export class TextMessageListItem extends React.Component<Props> {
  public renderAvatar() {
    const {
      conversationType,
      avatarPath,
      i18n,
      color,
      name,
      profileName,
      id,
      isMe,
    } = this.props;

    return (
      <Avatar
        id={id}
        avatarPath={avatarPath}
        color={color}
        conversationType={conversationType}
        i18n={i18n}
        name={name}
        profileName={profileName}
        size={36}
        noteToSelf={isMe}
        noClickEvent={true}
        notShowStatus={true}
      />
    );
  }

  public renderHighlightBody(processedText: string) {
    const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;
    let match = FIND_BEGIN_END.exec(processedText);
    const results: Array<JSX.Element> = [];
    let last = 0;
    let count = 1;

    if (!match) {
      return <span>{processedText}</span>;
    }

    while (match) {
      if (last < match.index) {
        const beforeText = processedText.slice(last, match.index);
        count += 1;
        results.push(<span key={count}>{beforeText}</span>);
      }

      const [, toHighlight] = match;
      count += 2;
      results.push(
        <span className="conversation-message-highlight" key={count - 1}>
          {toHighlight}
        </span>
      );

      last = FIND_BEGIN_END.lastIndex;
      match = FIND_BEGIN_END.exec(processedText);
    }

    if (last < processedText.length) {
      count += 1;
      results.push(<span key={count}>{processedText.slice(last)}</span>);
    }

    return results;
  }

  public render() {
    const {
      id,
      conversationId,
      i18n,
      name,
      isMe,
      profileName,
      style,
      body,
      timestamp,
      messageId,
      className,
    } = this.props;

    const title = name ? name : id;
    const displayName = isMe ? i18n('noteToSelf') : title;

    const profileElement =
      !isMe && profileName && !name ? (
        <span className="module-contact-list-item__text__profile-name">
          ~{profileName}
        </span>
      ) : null;

    return (
      <div
        style={style}
        role="button"
        className={classNames('module-contact-list-item', className)}
        onClick={() => {
          (window as any).jumpMessage({ conversationId, messageId });
        }}
      >
        {this.renderAvatar()}
        <div
          className="module-contact-list-item__text"
          // text item length = 100% - avatar width - margin width
          style={{ width: 'calc(100% - 48px - 100px)' }}
        >
          <div className="module-contact-list-item__text__name conversation-title">
            {displayName}
            {profileElement}
          </div>
          <div className="conversation-message-search-result__content">
            {this.renderHighlightBody(body)}
          </div>
        </div>

        {/* alignItems: 'center' */}
        <div style={{ display: 'flex', position: 'absolute', right: 15 }}>
          <Timestamp
            i18n={i18n}
            timestamp={timestamp}
            extended={true}
            direction={'outgoing'}
            module={'module-local-search-message__metadata__date'}
          />
        </div>
      </div>
    );
  }
}
