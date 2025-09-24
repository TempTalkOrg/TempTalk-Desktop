import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
// import { Spinner } from '../Spinner';

import { LocalizerType } from '../../types/Util';
// import { Contact } from '../../types/Contact';

// This file starts with _ to keep it from showing up in the StyleGuide.

export function renderAvatar({
  contact,
  i18n,
  size,
  noClickEvent = false,
}: // direction,
{
  contact: any;
  i18n: LocalizerType;
  size: number;
  direction?: string;
  noClickEvent?: boolean;
}) {
  // const { avatar } = contact;

  // const avatarPath = avatar && avatar.avatar && avatar.avatar.path;
  // const pending = avatar && avatar.avatar && avatar.avatar.pending;
  // const name = contact.name;
  // const spinnerSize = size < 50 ? 'small' : 'normal';

  // if (pending) {
  //   return (
  //     <div className="module-embedded-contact__spinner-container">
  //       <Spinner size={spinnerSize} direction={direction} />
  //     </div>
  //   );
  // }

  return (
    <Avatar
      avatarPath={contact.avatarPath}
      color="grey"
      conversationType="direct"
      i18n={i18n}
      name={contact.name}
      size={size}
      id={contact.number}
      notShowStatus={true}
      noClickEvent={noClickEvent}
    />
  );
}

export function renderName({
  contact,
  isIncoming,
  module,
}: {
  contact: any;
  isIncoming: boolean;
  module: string;
}) {
  return (
    <div
      className={classNames(
        `module-${module}__contact-name`,
        isIncoming ? `module-${module}__contact-name--incoming` : null
      )}
    >
      {contact.name}
    </div>
  );
}

export function renderContactNumber({
  contact,
  isIncoming,
  module,
}: {
  contact: any;
  isIncoming: boolean;
  module: string;
}) {
  // const { number: phoneNumber, email } = contact;
  // const firstNumber = phoneNumber && phoneNumber[0] && phoneNumber[0].value;
  // const firstEmail = email  && email[0] && email[0].value;

  return (
    <div
      className={classNames(
        `module-${module}__contact-method`,
        isIncoming ? `module-${module}__contact-method--incoming` : null
      )}
    >
      {contact.number}
    </div>
  );
}

export function renderContactEmail({
  contact,
  isIncoming,
  module,
}: {
  contact: any;
  isIncoming: boolean;
  module: string;
}) {
  // const { number: phoneNumber, email } = contact;
  // const firstNumber = phoneNumber && phoneNumber[0] && phoneNumber[0].value;
  // const firstEmail = email  && email[0] && email[0].value;

  return (
    <div
      className={classNames(
        `module-${module}__contact-method`,
        isIncoming ? `module-${module}__contact-method--incoming` : null
      )}
    >
      {contact.email}
    </div>
  );
}
