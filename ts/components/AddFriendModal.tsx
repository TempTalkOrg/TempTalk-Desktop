import { useMemoizedFn } from 'ahooks';
import { Input, Modal, ModalProps } from 'antd';
import React, { useState } from 'react';
import { trigger } from '../shims/events';
import { LocalizerType } from '../types/Util';

export const AddFriendModal = (
  props: ModalProps & { onComplete?: () => void; i18n: LocalizerType }
) => {
  const { open, onCancel, onComplete, i18n } = props;

  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const handleCloseModal = useMemoizedFn(e => {
    onCancel?.(e);
    setShowErrorMessage(false);
  });

  const onInputFinish = useMemoizedFn(async (value: string) => {
    try {
      const resp = await (
        window as any
      ).textsecure.messaging.queryUserByInviteCode(value);
      if (resp.uid) {
        trigger('showConversation', resp.uid, null, null, null, null);
        const myEvent = new Event('event-toggle-switch-chat');
        window.dispatchEvent(myEvent);
        onComplete?.();
      }
    } catch (e) {
      setShowErrorMessage(true);
      console.log(e);
    }
  });

  return (
    <Modal
      open={open}
      onCancel={handleCloseModal}
      title={false}
      footer={null}
      width={384}
      destroyOnClose={true}
      centered
    >
      <div className="friend-code-input-wrapper">
        <div className="friend-code-input-title">
          {i18n('addFriend.modal.title')}
        </div>
        <div className="friend-code-input-sub-title">
          {i18n('addFriend.modal.subtitle')}
        </div>
        <Input.OTP
          className="friend-code-input-otp"
          size="large"
          length={4}
          onChange={onInputFinish}
        ></Input.OTP>
        {showErrorMessage ? (
          <div className="friend-code-input-error-message">
            {i18n('addFriend.modal.errorFriendCode')}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
