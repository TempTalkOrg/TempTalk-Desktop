import React, { useRef, useState } from 'react';
import { Button, Modal, Rate } from 'antd';
import { useMemoizedFn } from 'ahooks';
import { LocalizerType } from '../../types/Util';
import {
  CallFeedbackReasonSelector,
  ICallFeedbackReasonSelectorRef,
} from './CallFeedbackReasonSelector';
import { IconStar, IconStarFilled } from '../shared/icons';

interface IProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (data: {
    rating: number;
    reasons: Record<string, number[]> | undefined;
  }) => void;
  i18n: LocalizerType;
}

const RATE_DESCRIPTION = ['worst', 'bad', 'okay', 'good', 'excellent'];

enum CALL_FEEDBACK_STEP {
  RATE = 0,
  SELECT_REASON = 1,
}

export const CallFeedback = (props: IProps) => {
  const { open, onCancel, onSubmit, i18n } = props;

  const [step, setStep] = useState(CALL_FEEDBACK_STEP.RATE);
  const [value, setValue] = useState(5);
  const reasonSelectorRef = useRef<ICallFeedbackReasonSelectorRef>(null);

  const renderCharater = useMemoizedFn(({ value, index }) => {
    if (index > value - 1) {
      return <IconStar style={{ color: 'var(--dst-color-text-third)' }} />;
    } else {
      return <IconStarFilled style={{ color: 'var(--dst-color-text-info)' }} />;
    }
  });

  const handleSubmit = useMemoizedFn(() => {
    if (step === CALL_FEEDBACK_STEP.RATE && value < 3) {
      setStep(CALL_FEEDBACK_STEP.SELECT_REASON);
      return;
    } else {
      const checkedReason = reasonSelectorRef.current?.getCheckedReason() || {};
      const data = {
        rating: value,
        reasons: checkedReason,
      };
      onSubmit(data);
    }
  });

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={360}
      // height={268}
      className="call-feedback-modal"
      footer={null}
      closeIcon={null}
      maskClosable={false}
      centered
    >
      <div>
        <div className="call-feedback-modal-title">
          {i18n(`callFeedback.title.step${step}`)}
        </div>

        {step === 0 && (
          <div>
            <div className="call-feedback-modal-description">
              {i18n('callFeedback.description')}
            </div>
            <Rate
              value={value}
              onChange={setValue}
              character={renderCharater}
              allowHalf={false}
              className="call-feedback-modal-rate-input"
              allowClear={false}
            />
            <div className="call-feedback-modal-rate-description">
              {i18n(`callFeedback.rate.${RATE_DESCRIPTION[value - 1]}`)}
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <CallFeedbackReasonSelector i18n={i18n} ref={reasonSelectorRef} />
          </div>
        )}
        <div className="call-feedback-modal-footer">
          <Button className="footer-button" ghost onClick={onCancel}>
            {i18n('notNow')}
          </Button>
          <Button
            type="primary"
            className="footer-button"
            onClick={handleSubmit}
          >
            {i18n('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
