import React, { useState } from 'react';
import { IconWrapper } from './shared/IconWrapper';
import { ConfigProvider } from 'antd';
import { ContextMenu } from './shared/ContextMenu';
import { LocalizerType } from '../types/Util';
import { AddFriendModal } from './AddFriendModal';

type Props = {
  i18n: LocalizerType;
};

export const QuickEntry = (props: Props) => {
  const { i18n } = props;
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);

  const items = [
    {
      key: 'create_group',
      label: (
        <div
          className="menu-item"
          onMouseDown={() => (window as any).showNewGroupWindow()}
        >
          <div className={'operation'}>{i18n('main_header_create_group')}</div>
        </div>
      ),
    },
    {
      key: 'invite-friend',
      label: (
        <div
          className="menu-item"
          onMouseDown={() => setAddFriendModalOpen(true)}
        >
          <div className={'operation'}>{i18n('main_header_add_contact')}</div>
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          motionDurationMid: '0s',
        },
      }}
    >
      <ContextMenu
        menu={{ items }}
        trigger={['click']}
        overlayClassName="main-header-operation-menu"
        align={{ offset: [-84, 8] }}
      >
        <IconWrapper>
          <div className="module-main-header__entry__plus-icon" />
        </IconWrapper>
      </ContextMenu>
      <AddFriendModal
        i18n={i18n}
        open={addFriendModalOpen}
        onCancel={() => setAddFriendModalOpen(false)}
        onComplete={() => setAddFriendModalOpen(false)}
      ></AddFriendModal>
    </ConfigProvider>
  );
};
