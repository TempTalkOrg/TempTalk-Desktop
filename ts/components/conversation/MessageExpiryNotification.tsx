import React from 'react';
import { LocalizerType } from '../../types/Util';
import { humanizeSeconds } from '../../util/humanizeSeconds';

interface Props {
  i18n: LocalizerType;
  messageExpiry: number;
}

export class MessageExpiryNotification extends React.Component<Props> {
  public render() {
    const { messageExpiry, i18n } = this.props;

    if (typeof messageExpiry !== 'number') {
      return null;
    }

    if (messageExpiry < 0) {
      return null;
    }

    return (
      <div className="module-message-expiry-notification">
        <hr style={{ marginLeft: '28px', marginRight: '28px' }} />
        {i18n('groupMessageExpiryUpdated', [
          messageExpiry === 0
            ? i18n('messageNeverExpiry')
            : humanizeSeconds(messageExpiry),
        ])}
      </div>
    );
  }
}
