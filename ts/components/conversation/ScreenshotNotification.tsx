import React from 'react';

import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';
import { ContactName } from './ContactName';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
  isMe: boolean;
}

interface Props {
  contact: Contact;
  i18n: LocalizerType;
}

export class ScreenshotNotification extends React.Component<Props> {
  public renderMessage() {
    const { i18n, contact } = this.props;

    if (contact.isMe) {
      return <>{i18n('tookAScreenshot', [i18n('you')])}</>;
    }

    return (
      <Intl
        id={'tookAScreenshot'}
        components={[
          <span
            key="external-1"
            className="module-recall-message-notification__contact"
          >
            <span>"</span>
            <ContactName
              i18n={i18n}
              name={contact.name}
              profileName={contact.profileName}
              phoneNumber={contact.phoneNumber}
              module="module-verification-notification__contact"
            />
            <span>"</span>
          </span>,
        ]}
        i18n={i18n}
      />
    );
  }

  public render() {
    return (
      <div className="module-screenshot-notification">
        <div className="module-recall-message-notification__text">
          {this.renderMessage()}
        </div>
      </div>
    );
  }
}
