import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Button } from 'antd';

interface Props {
  i18n: LocalizerType;
  acceptFriendRequest: () => Promise<void>;
  ignoreFriendRequest: () => Promise<void>;
}

export const FriendRequestOption = (props: Props) => {
  const { acceptFriendRequest, ignoreFriendRequest, i18n } = props;
  return (
    <div className="friend-request-option-container">
      <div className="warning-content">
        <span>⚠️</span>
        <span className="warning-prefix">{i18n('warningPrefix')}</span>
        <span className="warning-content">
          {i18n('addFriendWarningContent')}
        </span>
      </div>
      <div className="operation-group">
        <Button block onClick={ignoreFriendRequest}>
          {i18n('ignore')}
        </Button>
        <Button block type="primary" onClick={acceptFriendRequest}>
          {i18n('acceptNewKey')}
        </Button>
      </div>
    </div>
  );
};
