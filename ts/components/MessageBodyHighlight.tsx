import React from 'react';
import { MessageBody } from './conversation/MessageBody';
import { LocalizerType } from '../types/Util';

interface Props {
  text: string;
  i18n: LocalizerType;
}

export class MessageBodyHighlight extends React.Component<Props> {
  public render() {
    const { text, i18n } = this.props;
    const results: Array<any> = [];
    const FIND_BEGIN_END = /<<left>>(.+?)<<right>>/g;

    let match = FIND_BEGIN_END.exec(text);
    let last = 0;
    let count = 1;

    if (!match) {
      return (
        <MessageBody
          disableJumbomoji={true}
          disableLinks={true}
          text={text}
          i18n={i18n}
        />
      );
    }

    while (match) {
      if (last < match.index) {
        const beforeText = text.slice(last, match.index);
        results.push(<span key={count++}>{beforeText}</span>);
      }

      const [, toHighlight] = match;
      results.push(
        <span className="module-message-body__highlight" key={count++}>
          <span key={count++}>{toHighlight}</span>
        </span>
      );

      // @ts-ignore
      last = FIND_BEGIN_END.lastIndex;
      match = FIND_BEGIN_END.exec(text);
    }

    if (last < text.length) {
      results.push(<span key={count++}>{text.slice(last)}</span>);
    }

    return results;
  }
}
