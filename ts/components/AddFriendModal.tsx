import { useControllableValue, useMemoizedFn } from 'ahooks';
import { Input, Modal, ModalProps, GetRef, Button } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { trigger } from '../shims/events';
import { LocalizerType } from '../types/Util';
import { ConfigProvider } from './shared/ConfigProvider';
import { getAccountManager } from '../shims/apiService';

type InputRef = GetRef<typeof Input>;

export const AddFriendModal = (
  props: ModalProps & { onComplete?: () => void; i18n: LocalizerType }
) => {
  const { open, onCancel, onComplete, i18n } = props;

  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<InputRef>(null);
  const [inputValue, setInputValue] = useControllableValue({
    defaultValue: '',
  });

  const handleCloseModal = useMemoizedFn(e => {
    onCancel?.(e);
    setErrorMessage('');
  });

  const showConversation = useMemoizedFn(
    (uid: string, type: 'randomCode' | 'search') => {
      trigger('showConversation', uid, null, null, null, {
        type,
      });
      const myEvent = new Event('event-toggle-switch-chat');
      window.dispatchEvent(myEvent);
      onComplete?.();
    }
  );

  const addFriendByRandomCode = useMemoizedFn(async (value: string) => {
    try {
      const resp = await (
        window as any
      ).textsecure.messaging.queryUserByInviteCode(value);
      if (resp.uid) {
        showConversation(resp.uid, 'randomCode');
        onComplete?.();
      }
    } catch (e) {
      setErrorMessage(i18n('addFriend.modal.errorFriendCode'));
      console.log('add friend by random code error', e);
    }
  });

  const addFriendByUid = useMemoizedFn(async (value: string) => {
    try {
      const resp = await getAccountManager().searchUserByUid(value);
      if (resp.uid) {
        showConversation(resp.uid, 'search');
        onComplete?.();
      }
    } catch (e: any) {
      setErrorMessage(i18n('addFriend.modal.errorUid'));
      console.log('add friend by uid error', e);
    }
  });

  const onSubmit = useMemoizedFn(async () => {
    const value = inputValue.trim();
    setLoading(true);
    if (/^\d{4}$/.test(value)) {
      await addFriendByRandomCode(value);
    } else {
      await addFriendByUid(value);
    }
    setLoading(false);
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      });
    } else {
      setInputValue('');
      setErrorMessage('');
    }
  }, [open]);

  return (
    <ConfigProvider>
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
          <Input
            ref={inputRef}
            className="universal-input"
            size="large"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={i18n('addFriend.modal.placeholder')}
          />
          <div className="friend-code-input-error-message">{errorMessage}</div>
          <Button
            disabled={!inputValue}
            onClick={onSubmit}
            className="add-friend-button"
            type="primary"
            loading={loading}
          >
            {i18n('search')}
          </Button>
        </div>
      </Modal>
    </ConfigProvider>
  );
};
