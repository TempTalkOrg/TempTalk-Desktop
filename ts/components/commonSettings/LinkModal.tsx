import React, { useCallback, useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { useCountDown, useMemoizedFn } from 'ahooks';
import { Modal, Form, Input, Button, FormRule, ModalFuncProps } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import { API_STATUS } from '../../types/APIStatus';

type Flow = 'link' | 'change';
type Step = 'preparing' | 'executing';

const isPreparing = (step: Step) => step === 'preparing';
const isExecuting = (step: Step) => step === 'executing';

interface LinkProps {
  i18n: LocalizerType;
  field: string;
  fieldRules: FormRule[];
  flow: Flow;
  openModal: boolean;
  onCancel: () => void;
  onRequestCode: (newValue: string, nonce?: string) => Promise<void>;
  onUpdate: (
    newValue: string,
    verifyCode: string,
    nonce?: string
  ) => Promise<void>;
  onRefreshProfile?: () => Promise<void>;
}

const keyPrefix = 'setting.account.linkModal';

export default function LinkModal(props: LinkProps) {
  const {
    i18n,
    field,
    fieldRules,
    flow,
    openModal,
    onCancel,
    onRefreshProfile,
  } = props;

  const [step, setStep] = useState<Step>('preparing');
  const [newValue, setNewValue] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [requestError, setRequestError] = useState<string | boolean>(false);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState<string | undefined>();
  const [confirmProps, setConfirmProps] = useState<ModalFuncProps>();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [modal, contextHolder] = Modal.useModal();

  const [form] = Form.useForm();

  useEffect(() => {
    if (openModal) {
      setStep('preparing');
      setNewValue('');
      setRequestError(false);
      setLoading(false);
      setNonce(undefined);
      setVerifyCode('');
      setConfirmProps(undefined);
      setHasConfirmed(false);

      form.setFieldsValue({ [field]: '', otp: '' });
    }
  }, [openModal]);

  const inputValue = Form.useWatch([field], form);

  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => {
        // only set new value when there is no error
        setNewValue(form.getFieldValue(field));
      })
      .catch(() => {
        setNewValue('');
      });
  }, [inputValue]);

  const onRequestCode = useMemoizedFn(async () => {
    if (!newValue) {
      throw new Error('there is no valid new value for request code');
    }

    const MAX_RETRY = 1;
    let retry = 0;
    let tempNonce = nonce;

    do {
      try {
        await props.onRequestCode(newValue, tempNonce);
        setRequestError(false);
        break;
      } catch (error: any) {
        let errorMessage = i18n('setting.account.linkModal.requestCode.error');
        if (error?.name === 'HTTPError' && error.code === 400) {
          const { status, data } = error.response || {};
          switch (status) {
            case API_STATUS.EmailAlreadyLinkedToCurrent:
            case API_STATUS.PhoneAlreadyLinkedToCurrent:
              onCancel();
              onRefreshProfile?.();
              (window as any).noticeSuccess('Success');
              break;
            case API_STATUS.EmailAlreadyLinkedToAnother:
            case API_STATUS.PhoneAlreadyLinkedToAnother:
              const fieldText = i18n(`setting.account.${field}`);
              setNonce(data?.nonce);
              setConfirmProps({
                icon: null,
                title: i18n(
                  'setting.account.linkModal.confirm.linkedToAnother.title',
                  [fieldText]
                ),
                content: i18n(
                  'setting.account.linkModal.confirm.linkedToAnother.content',
                  [fieldText]
                ),
                centered: true,
                onOk: async () => {
                  setHasConfirmed(true);
                  try {
                    await onRequestCode();
                  } catch (error) {
                    //
                  }

                  if (isPreparing(step)) {
                    setStep('executing');
                    setRequestError(false);
                  }
                },
                okText: i18n(
                  'setting.account.linkModal.confirm.linkedToAnother.ok'
                ),
                onCancel,
                cancelText: i18n(
                  'setting.account.linkModal.confirm.linkedToAnother.cancel'
                ),
                className: 'setting-account-confirm-modal',
                width: '384px',
              });
              break;
            case API_STATUS.InvalidNonce:
              tempNonce = data?.nonce;
              retry += 1;

              if (retry <= MAX_RETRY) {
                continue;
              }

              break;
          }
        }

        setRequestError(errorMessage);
        throw error;
      }
    } while (true);
  });

  const onUpdate = useMemoizedFn(async () => {
    if (!newValue) {
      throw new Error('there is no valid new value for update');
    }

    if (!verifyCode) {
      throw new Error('there is no valid code for update');
    }

    try {
      await props.onUpdate(newValue, verifyCode, nonce);
      setRequestError(false);
      onCancel();
      onRefreshProfile?.();
      (window as any).noticeSuccess('Success');
    } catch (error: any) {
      setRequestError(true);

      // update nonce if available
      if (error?.name === 'HTTPError' && error.code === 400) {
        setNonce(error.response?.data?.nonce);
      }
    }
  });

  const handleSubmit = useMemoizedFn(async () => {
    if (!newValue) {
      return;
    }

    setLoading(true);

    const onRequest = isPreparing(step) ? onRequestCode : onUpdate;

    try {
      await onRequest();
    } catch (error: any) {
      setLoading(false);
      return;
    }

    if (isPreparing(step)) {
      setStep('executing');
    }

    setLoading(false);
  });

  useEffect(() => {
    if (!confirmProps || hasConfirmed) {
      return;
    }

    modal.confirm(confirmProps);
  }, [confirmProps, hasConfirmed]);

  return (
    <Modal
      open={openModal}
      onCancel={() => onCancel()}
      destroyOnClose={true}
      centered={true}
      maskClosable={false}
      className="setting-account-link-modal"
      closeIcon={<CloseOutlined className="x-button-icon" />}
      footer={null}
      width={'384px'}
    >
      <TopHeader
        i18n={i18n}
        flow={flow}
        field={field}
        step={step}
        value={newValue}
      ></TopHeader>
      <Form
        className="link-modal-form"
        form={form}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
      >
        {isPreparing(step) ? (
          <ValueInput
            i18n={i18n}
            field={field}
            disabled={loading}
            fieldRules={fieldRules}
            validateError={requestError}
          ></ValueInput>
        ) : (
          <OTPInput
            i18n={i18n}
            disabled={loading}
            validateError={requestError}
            onChange={text => {
              if (text !== verifyCode) {
                setVerifyCode(text);
                setRequestError(false);
              }
            }}
            onInput={texts => {
              if (texts.length !== 6) {
                setRequestError(false);
              }

              if (texts.join('') !== verifyCode) {
                setVerifyCode('');
              }
            }}
          ></OTPInput>
        )}

        <Form.Item>
          <BottomButton
            i18n={i18n}
            disabled={!newValue || (isExecuting(step) && !verifyCode)}
            loading={loading}
            onClick={handleSubmit}
            step={step}
          ></BottomButton>
          {isPreparing(step) ? null : (
            <ResendTips
              i18n={i18n}
              onRequestCode={onRequestCode}
              onClearOTPInput={() => form.setFieldValue('otp', '')}
            ></ResendTips>
          )}
        </Form.Item>
      </Form>
      {contextHolder}
    </Modal>
  );
}

//////////////////////////////////////////////////////////////////////////
// Top Header

interface HeaderProps {
  i18n: LocalizerType;
  flow: Flow;
  field: string;
  step: Step;
  value: string;
}

function TopHeader({ i18n, flow, field, step, value }: HeaderProps) {
  const fieldText = i18n(`setting.account.${field}`);
  const title = i18n(`${keyPrefix}.title.${flow}`, [fieldText]);
  const descKey = `${keyPrefix}.description.${step}`;
  const description = i18n(descKey, [isPreparing(step) ? fieldText : value]);

  return (
    <div className="link-modal-header">
      <div className="link-modal-title">{title}</div>
      <div className="link-modal-description">{description}</div>
    </div>
  );
}

//////////////////////////////////////////////////////////////////////////
// Value Input Form.Item
interface ValueInputProps {
  i18n: LocalizerType;
  field: string;
  fieldRules: FormRule[];
  validateError: string | boolean;
  disabled: boolean;
}

function ValueInput(props: ValueInputProps) {
  const { i18n, field, disabled, fieldRules, validateError } = props;

  return (
    <Form.Item
      className="link-modal-form-item-input"
      validateStatus={validateError ? 'error' : undefined}
      help={validateError || undefined}
      name={field}
      rules={fieldRules}
    >
      <Input
        className="link-modal-input"
        allowClear
        placeholder={i18n(
          `setting.account.linkModal.input.placeholder.${field}`
        )}
        disabled={disabled}
      ></Input>
    </Form.Item>
  );
}

//////////////////////////////////////////////////////////////////////////
// OTP Input Form.Item
interface OTPInputProps {
  i18n: LocalizerType;
  // field: string;
  disabled: boolean;
  onChange: (text: string) => void;
  onInput: (texts: string[]) => void;
  validateError: string | boolean;
}

function OTPInput(props: OTPInputProps) {
  const { i18n, disabled, onChange, onInput, validateError } = props;

  return (
    <Form.Item
      className="link-modal-form-item-input"
      name="otp"
      validateStatus={validateError ? 'error' : undefined}
      help={
        validateError
          ? i18n('setting.account.linkModal.verifyOTP.error')
          : undefined
      }
    >
      <Input.OTP
        type="number"
        length={6}
        disabled={disabled}
        onChange={onChange}
        onInput={onInput}
      />
    </Form.Item>
  );
}

//////////////////////////////////////////////////////////////////////////
// Bottom Button

interface ButtonProps {
  i18n: LocalizerType;
  step: Step;
  disabled: boolean;
  loading: boolean;
  onClick: () => Promise<void>;
}

function BottomButton(props: ButtonProps) {
  const { i18n, onClick, disabled, loading, step } = props;

  const buttonTitle = i18n(`${keyPrefix}.button.${step}`);

  return (
    <Button
      className="link-modal-primary-button"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      autoInsertSpace={false}
    >
      {buttonTitle}
    </Button>
  );
}

//////////////////////////////////////////////////////////////////////////
// Resend Tips

interface TipsProps {
  i18n: LocalizerType;
  onRequestCode: () => Promise<void>;
  onClearOTPInput: () => void;
}

function ResendTips(props: TipsProps) {
  const { i18n, onRequestCode, onClearOTPInput } = props;

  const getNextTargetDate = useCallback(() => Date.now() + 60 * 1000, []);

  const [disabled, setDisabled] = useState(true);
  const [targetDate, setTargetDate] = useState(getNextTargetDate());

  const [countdown] = useCountDown({
    targetDate,
    onEnd: () => setDisabled(false),
  });
  const seconds = Math.round(countdown / 1000);
  const secondsText = seconds > 0 ? `(${seconds})` : '';

  return (
    <div className="link-modal-resend">
      <span>{i18n('setting.account.linkModal.resend.tips')}</span>
      <span
        className={classNames(
          'link-modal-button-resend',
          disabled ? 'link-modal-button-resend-disabled' : null
        )}
        onClick={async () => {
          if (disabled) {
            return;
          }

          try {
            await onRequestCode();
          } catch (error) {
            // send failed
            console.log('request code error', error);
            return;
          }

          setTargetDate(getNextTargetDate());
          setDisabled(true);
          onClearOTPInput();
        }}
      >
        {i18n('setting.account.linkModal.button.resend', [secondsText])}
      </span>
    </div>
  );
}
