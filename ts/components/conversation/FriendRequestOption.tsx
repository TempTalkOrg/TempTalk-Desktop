import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Button } from 'antd';

interface Props {
  i18n: LocalizerType;
  acceptFriendRequest: () => Promise<void>;
  ignoreFriendRequest: () => Promise<void>;
  sendFriendRequest: () => Promise<void>;
  addContact: boolean;
}

export const FriendRequestOption = (props: Props) => {
  const {
    acceptFriendRequest,
    ignoreFriendRequest,
    i18n,
    addContact,
    sendFriendRequest,
  } = props;
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
        {addContact ? (
          <Button
            block
            onClick={sendFriendRequest}
            className="add-contact-button"
            type="primary"
          >
            {i18n('main_header_add_contact')}
          </Button>
        ) : (
          <>
            <Button block onClick={ignoreFriendRequest}>
              {i18n('ignore')}
            </Button>
            <Button block type="primary" onClick={acceptFriendRequest}>
              {i18n('acceptNewKey')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
