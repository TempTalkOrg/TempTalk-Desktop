import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  description: string;
  creatorName: string;
  displayText: string;
}

export class ReminderNotification extends React.Component<Props> {
  public render() {
    const {
      // description,
      // creatorName,
      // i18n,
      displayText,
    } = this.props || {};

    // if (!description || !creatorName) {
    //   return null;
    // }

    if (!displayText) {
      return null;
    }

    return (
      <div className="module-remind-cycle-notification">
        {/*{`${i18n('reminderBy')} @${creatorName}: ${description}`}*/}
        {displayText}
      </div>
    );
  }
}
