import React from 'react';

import { LocalizerType } from '../../types/Util';
interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  i18n: LocalizerType;
  module?: string;
  inSearch?: any;
  sourceBrief?: string;
  botId?: string;
  groupId?: string;
  groupName?: string;
  supportType?: any;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const {
      phoneNumber,
      name,
      profileName,
      module,
      sourceBrief,
      botId,
      groupId,
      groupName,
      supportType,
    } = this.props;

    const prefix = module ? module : 'module-contact-name';

    let title;
    if (botId && !groupId && supportType) {
      title = 'From ' + name;
    } else if (botId && groupId && supportType) {
      title = 'From ' + groupName + '/' + name;
    } else {
      title =
        name && sourceBrief
          ? name + ' : ' + sourceBrief
          : name
            ? name
            : phoneNumber;
    }

    const shouldShowProfile = Boolean(profileName && !name);
    const profileElement = shouldShowProfile ? (
      <span className={`${prefix}__profile-name`}>~{profileName || ''}</span>
    ) : null;

    return (
      <span className={prefix} dir="auto">
        {title}
        {shouldShowProfile ? ' ' : null}
        {profileElement}
      </span>
    );
  }
}
