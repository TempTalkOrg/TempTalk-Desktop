import { Button, Modal, ModalProps, Radio } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { Contact } from './hooks/useInitials';
import { useMemoizedFn } from 'ahooks';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { LocalizerType } from '../../types/Util';

interface IProps extends ModalProps {
  i18n: LocalizerType;
  open: boolean;
  requireUsers: { identity: string; ts: string }[];
  contactMap: Map<string, Contact>;
  onApprove: (identity: string) => void;
  onReject: () => void;
  onCancel: () => void;
}

const DEFAULT_COUNTDOWN = 5;

export const ScreenShareApprovalModal = (props: IProps) => {
  const { i18n, open, requireUsers = [], contactMap } = props;
  const [countdown, setCountdown] = useState<number>(DEFAULT_COUNTDOWN);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const radioGroupRef = useRef(null);
  const [selected, setSelected] = useState<string>();
  const [radioOptions, setRadioOptions] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    const options = requireUsers.map(user => {
      const contact = contactMap.get(user.identity.split('.')[0]);
      return {
        label: contact?.getDisplayName() || '',
        value: user.identity,
      };
    });
    setRadioOptions(options);
  }, [requireUsers]);

  useEffect(() => {
    if (radioOptions.length > 0 && !selected) {
      setSelected(radioOptions[0].value);
    }
  }, [radioOptions, selected]);

  const title = i18n(
    `screenShare.approvalModal.title.${radioOptions.length > 1 ? 'miltiRequest' : 'singleRequest'}`
  );

  const startCountdown = useMemoizedFn(() => {
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
  });

  useEffect(() => {
    if (open) {
      startCountdown();
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(DEFAULT_COUNTDOWN);
      setSelected(undefined);
      setRadioOptions([]);
    };
  }, [open]);

  const onCancel = useMemoizedFn(() => {
    props.onCancel?.();
  });

  const onApprove = useMemoizedFn(async () => {
    if (requireUsers.length < 1) {
      console.log('no require screen share users');
      onCancel();
    }
    try {
      onCancel();
      let approvedIdentity = '';
      if (radioGroupRef.current) {
        const isValidSelected =
          selected && radioOptions.some(option => option.value === selected);
        approvedIdentity = isValidSelected
          ? selected
          : requireUsers[0].identity;
      } else {
        approvedIdentity = requireUsers[0].identity;
      }
      await props.onApprove?.(approvedIdentity);
    } catch (e) {
      console.error('onApprove error', e);
    }
  });

  const onReject = useMemoizedFn(async () => {
    try {
      await props.onReject?.();
      onCancel();
    } catch (e) {
      console.error('onReject error', e);
    }
  });

  // auto approve
  useEffect(() => {
    if (open && countdown === 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      onApprove();
    }
  }, [open, countdown]);

  useEffect(() => {
    if (open) {
      (window as any).updateFloatingBar({
        requireScreenShare: {
          countdown,
          radioOptions,
        },
      });
    } else {
      (window as any).updateFloatingBar({
        requireScreenShare: null,
      });
    }
  }, [open, countdown, radioOptions]);

  const onRequireScreenShareAction = useMemoizedFn(
    (data: { action: string; value: string }) => {
      if (!open) {
        return;
      }
      if (data.action === 'select') {
        setSelected(data.value);
      } else if (data.action === 'approve') {
        onApprove();
      } else if (data.action === 'reject') {
        onReject();
      }
    }
  );

  useEffect(() => {
    const cleanup = (window as any).registerRequireScreenShareActionHandler(
      (_: any, payload: { action: string; value: string }) => {
        onRequireScreenShareAction(payload);
      }
    );

    return () => {
      cleanup();
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      style={{ top: 48 }}
      width={477}
      className="screen-share-approval-modal"
      footer={null}
      closeIcon={null}
      destroyOnClose
      onCancel={onCancel}
      keyboard={false}
      maskClosable={false}
    >
      <div className="screen-share-approval-modal-content">
        <div className="content-title">
          <ExclamationCircleOutlined className="content-icon" />
          <span className="content-title-info">
            {radioOptions.length == 1 ? (
              <span className="content-title-info-name">
                {radioOptions?.[0]?.label}
              </span>
            ) : null}
            <span className="content-title-info-text">{title}</span>
          </span>
          <span className="content-title-countdown">({countdown}s)</span>
        </div>
        <div className="screen-share-approval-modal-content-buttons">
          <Button
            size="small"
            className="operation-button"
            type="default"
            onClick={onApprove}
          >
            {i18n('approveNow')}
          </Button>
          <Button
            size="small"
            className="operation-button"
            type="default"
            onClick={onReject}
          >
            {i18n('reject')}
          </Button>
        </div>
      </div>
      {radioOptions.length > 1 && (
        <Radio.Group
          ref={radioGroupRef}
          options={radioOptions}
          value={selected}
          className="universal-radio-group"
          onChange={e => setSelected(e.target.value)}
        ></Radio.Group>
      )}
    </Modal>
  );
};
