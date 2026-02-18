import React, { ReactNode, useEffect, useState } from 'react';
import { Button, Form, FormRule, Input, Modal } from 'antd';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import { API_STATUS } from '../../types/APIStatus';

interface CustomUidModelProps {
  i18n: LocalizerType;
  field: string;
  fieldRules: FormRule[];
  initialValue?: string;
  openModal: boolean;
  onCancel: () => void;
  onUpdate: (newValue: string) => Promise<void>;
  onRefreshProfile?: () => Promise<void>;
}

export function CustomUidModel(props: CustomUidModelProps) {
  const {
    i18n,
    field,
    fieldRules,
    initialValue,
    openModal,
    onCancel,
    onUpdate,
    onRefreshProfile,
  } = props;
  const [loading] = useState(false);
  const [form] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState<ReactNode>('');

  const inputValue = Form.useWatch([field], form);

  const handleSubmit = useMemoizedFn(async () => {
    const values = await form.validateFields();
    const newValue = values[field];
    if (newValue === initialValue) {
      onCancel();
      return;
    }
    try {
      await onUpdate?.(newValue);
      onCancel();
      onRefreshProfile?.();
    } catch (error: any) {
      switch (error?.response?.status) {
        case API_STATUS.SetCustomUidRateLimit:
          setErrorMessage(
            i18n('setting.account.customUidModal.error.setCustomUidRateLimit')
          );
          return;
        case API_STATUS.InvalidParameter:
          setErrorMessage(
            i18n(`setting.account.customUidModal.error.invalidParameter`)
          );
          return;
        case API_STATUS.CustomUidAlreadyExists: {
          const recommend = error.response.data?.recommendUid;
          setErrorMessage(
            <div className="custom-uid-modal-error-text">
              {i18n(
                `setting.account.customUidModal.error.customUidAlreadyExists`
              )}
              <span className="custom-uid-modal-error-recommend">
                {i18n('setting.account.customUidModal.error.recommendPrefix')}
                <span
                  className="custom-uid-modal-error-recommend-value"
                  onClick={() => {
                    form.setFieldValue(field, recommend);
                    setErrorMessage('');
                  }}
                >
                  {recommend}
                </span>
              </span>
            </div>
          );
          return;
        }
        default:
          console.log('update custom uid error', error?.response?.status);
      }
    }
  });

  useEffect(() => {
    if (openModal) {
      setErrorMessage('');
      form.setFieldValue(field, initialValue || '');
    }
  }, [openModal, initialValue]);

  const rulesList = [
    i18n('setting.account.customUidModal.rules.length'),
    i18n('setting.account.customUidModal.rules.start'),
    i18n('setting.account.customUidModal.rules.content'),
    i18n('setting.account.customUidModal.rules.duration'),
  ];

  return (
    <Modal
      open={openModal}
      onCancel={onCancel}
      destroyOnClose={true}
      className="setting-account-custom-uid-modal"
      footer={null}
      width={384}
      maskClosable={false}
    >
      <div className="custom-uid-modal-title">
        {i18n('setting.account.customUidModal.title')}
      </div>
      <Form
        className="custom-uid-modal-form"
        form={form}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
      >
        <Form.Item
          className="custom-uid-modal-form-item-input"
          rules={fieldRules}
          name={field}
          validateStatus={errorMessage ? 'error' : undefined}
          help={errorMessage || undefined}
        >
          <Input
            className="custom-uid-modal-input universal-input"
            placeholder={i18n('setting.account.customUidModal.placeholder')}
            allowClear
          />
        </Form.Item>
        <div className="bottom-area">
          <ul className="custom-uid-modal-rules-description">
            {rulesList.map((rule, index) => (
              <li
                key={index}
                className="custom-uid-modal-rules-description-item"
              >
                {rule}
              </li>
            ))}
          </ul>
          <Button
            className="custom-uid-modal-primary-button"
            loading={loading}
            disabled={!inputValue}
            onClick={handleSubmit}
            autoInsertSpace={false}
          >
            {i18n('save')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
