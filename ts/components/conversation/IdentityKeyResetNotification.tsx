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
  operator: Contact;
  i18n: LocalizerType;
}

export const IdentityKeyResetNotification = ({ i18n, operator }: Props) => {
  return (
    <div className="module-identity-key-reset-notification">
      <div className="module-identity-key-reset-notification__text">
        <Intl
          id={'identityKeyResetNotification'}
          components={[
            <span
              key="external-1"
              className="module-identity-key-reset-notification__contact"
            >
              <span>"</span>
              <ContactName
                i18n={i18n}
                name={operator.name}
                profileName={operator.profileName}
                phoneNumber={operator.phoneNumber}
                module="module-identity-key-reset-notification__contact"
              />
              <span>"</span>
            </span>,
          ]}
          i18n={i18n}
        />
      </div>
    </div>
  );
};
