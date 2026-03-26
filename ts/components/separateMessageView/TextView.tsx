import React from 'react';
import { MessageBody } from '../conversation/MessageBody';
import { LocalizerType } from '../../types/Util';

export const TextView = ({
  i18n,
  messageData,
}: {
  i18n: LocalizerType;
  messageData: any;
}) => {
  return (
    <div className="enlarge-view-container">
      <div className="enlarge-view-inner module-message__text">
        <MessageBody
          text={messageData?.text || ''}
          disableShowProfile={true}
          mentions={messageData?.mentions || []}
          i18n={i18n}
        />
      </div>
    </div>
  );
};
