import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BorderRadiusSize, IconWrapper } from '../shared/IconWrapper';
import { InputNumber, Modal, Popover } from 'antd';
import { useClickAway, useCountDown, useMemoizedFn } from 'ahooks';
import { InfoCircleOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import { CountdownResponseMessageType } from './hooks/useRTMMessage';
import { useGlobalConfig } from './hooks/useGlobalConfig';

const selectMinutesList = [1, 5, 10, 15, 60];

enum TimerStatus {
  Initial,
  Running,
  Completed,
}

// type CustomInputRef = GetRef<typeof InputNumber>;

interface ITimerOperationProps {
  status: TimerStatus;
  onOperation: ({
    operation,
    payload,
  }: {
    operation: 'plus' | 'end' | 'reset' | 'close';
    payload?: any;
  }) => void;
}

const TimerOperation = ({ status, onOperation }: ITimerOperationProps) => {
  if (status === TimerStatus.Running) {
    return (
      <div className="timer-operation-root">
        <div
          className="timer-operation-item"
          onClick={() => onOperation?.({ operation: 'plus', payload: 1 })}
        >
          <div className="timer-operation-item-icon icon-plus"></div>1 min
        </div>
        <div className="timer-operation-divider"></div>
        <div
          className="timer-operation-item"
          onClick={() => onOperation?.({ operation: 'end' })}
        >
          <div className="timer-operation-item-icon icon-end"></div>
          End
        </div>
      </div>
    );
  } else if (status === TimerStatus.Completed) {
    return (
      <div className="timer-operation-root">
        <div
          className="timer-operation-item"
          onClick={() => onOperation?.({ operation: 'reset' })}
        >
          <div className="timer-operation-item-icon icon-reset"></div>
          Reset
        </div>
        <div className="timer-operation-divider"></div>
        <div
          className="timer-operation-item"
          onClick={() => onOperation?.({ operation: 'close' })}
        >
          <div className="timer-operation-item-icon icon-close"></div>
          Close
        </div>
      </div>
    );
  }
  return null;
};

interface ICountdownTimerProps {
  onSetCountdown?: (minutes: number) => void;
  onExtendCountdown?: (minutes: number) => void;
  onClearCountdown?: () => void;
  onRestartCountdown?: () => void;
  readonly?: boolean;
}

export interface ICountdownTimerRef {
  setCountdown: (setCountdownMessage: any) => void;
  clearCountdown: () => void;
  extendCountdown: (extendCountdownMessage: any) => void;
  restartCountdown: (restartCountdownMessage: any) => void;
  openOperationPopup: () => void;
  // updateCountdown: (updateCountdownMessage: UpdateCountdownMessageType) => void;
}

export const CountdownTimer = forwardRef<
  ICountdownTimerRef,
  ICountdownTimerProps
>(
  (
    {
      onSetCountdown,
      onExtendCountdown,
      onClearCountdown,
      onRestartCountdown,
      readonly,
    },
    ref
  ) => {
    const [status, setStatus] = useState(TimerStatus.Initial);
    const [settingModalOpen, setSettingModalOpen] = useState(false);
    const [selected, setSelected] = useState(1);
    const [targetDate, setTargetDate] = useState<number | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [inputValue, setInputValue] = useState<number | null>(null);
    const timerRootRef = useRef<HTMLDivElement>(null);
    const popoverTriggerRef = useRef<HTMLDivElement>(null);
    const swingRef = useRef(false);
    const { countdownTimer } = useGlobalConfig();
    const { warningThreshold, shakingThreshold } = countdownTimer;

    const settingModalTitle = useMemo(() => {
      return `${status === TimerStatus.Initial ? 'Create' : 'Recreate'} a countdown timer`;
    }, [status]);

    const onClick = useMemoizedFn(() => {
      switch (status) {
        case TimerStatus.Initial: {
          setSettingModalOpen(true);
          break;
        }
        default: {
          setSettingModalOpen(true);
          break;
        }
      }
    });

    const cleanupState = useMemoizedFn(() => {
      setStatus(TimerStatus.Initial);
      setTargetDate(null);
      setPopoverOpen(false);
    });

    useImperativeHandle(ref, () => ({
      setCountdown: (setCountdownMessage: CountdownResponseMessageType) => {
        setTargetDate(
          Date.now() +
            setCountdownMessage.expiredTimeMs -
            setCountdownMessage.currentTimeMs
        );
        setStatus(TimerStatus.Running);
      },
      extendCountdown: (
        extendCountdownMessage: CountdownResponseMessageType
      ) => {
        setTargetDate(
          Date.now() +
            extendCountdownMessage.expiredTimeMs -
            extendCountdownMessage.currentTimeMs
        );
        setStatus(TimerStatus.Running);
      },
      restartCountdown: (
        restartCountdownMessage: CountdownResponseMessageType
      ) => {
        setTargetDate(
          Date.now() +
            restartCountdownMessage.expiredTimeMs -
            restartCountdownMessage.currentTimeMs
        );
        setStatus(TimerStatus.Running);
      },
      clearCountdown: () => {
        cleanupState();
      },
      openOperationPopup: () => {
        setPopoverOpen(true);
      },
    }));

    const handleOk = useMemoizedFn(async () => {
      const minutes = inputValue ? Number(inputValue) : selected;

      onSetCountdown?.(minutes);
      setSettingModalOpen(false);
    });

    const onCountdownEnd = useMemoizedFn(() => {
      if (status === TimerStatus.Running) {
        setStatus(TimerStatus.Completed);

        if (swingRef.current) {
          timerRootRef.current?.classList.remove('swing');
          swingRef.current = false;
        }
      }
    });

    const [countdown] = useCountDown({
      targetDate,
      onEnd: onCountdownEnd,
    });

    const countdownSeconds = useMemo(() => {
      return Math.round(countdown / 1000);
    }, [countdown]);

    useEffect(() => {
      if (
        countdownSeconds <= shakingThreshold / 1000 &&
        status === TimerStatus.Running &&
        swingRef.current === false
      ) {
        timerRootRef.current?.classList.add('swing');
        swingRef.current = true;
      }
    }, [countdownSeconds, status, shakingThreshold]);

    const formattedCountdown = useMemo(() => {
      if (countdown === 0) {
        return '00:00';
      }

      const hours = Math.floor(countdownSeconds / 3600);
      const minutes = Math.floor((countdownSeconds % 3600) / 60);
      const seconds = countdownSeconds % 60;

      return `${(hours * 60 + minutes).toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [countdownSeconds]);

    const timeLeftStatus = useMemo(() => {
      if (status === TimerStatus.Initial) {
        return 'normal';
      }
      return countdownSeconds > warningThreshold / 1000 ? 'normal' : 'warning';
    }, [countdownSeconds, status, warningThreshold]);

    const onTimerTextClick = useMemoizedFn(() => {
      setPopoverOpen(prev => !prev);
    });

    useClickAway(() => {
      setPopoverOpen(false);
    }, popoverTriggerRef);

    const handleOperation = useMemoizedFn(({ operation, payload }) => {
      switch (operation) {
        case 'plus': {
          onExtendCountdown?.(payload);
          break;
        }
        case 'end': {
          onClearCountdown?.();
          cleanupState();
          break;
        }
        case 'close': {
          onClearCountdown?.();
          cleanupState();
          break;
        }
        case 'reset': {
          onRestartCountdown?.();
          setPopoverOpen(false);
          break;
        }
      }
    });

    const onSelectMinutes = useMemoizedFn((minutes: number) => {
      setSelected(minutes);
      setInputValue(null);
    });

    const onInputChange = useMemoizedFn((value: number | null) => {
      setInputValue(value);
      setSelected(0);
    });

    const renderReadonlyContent = () => {
      if (!readonly || !targetDate) {
        return null;
      }
      return (
        <div className="countdown-timer-readonly-view">
          <div className="countdown-timer-icon"></div>
          <div className="countdown-timer-text">{formattedCountdown}</div>
        </div>
      );
    };

    const renderContent = () => {
      if (readonly) {
        return null;
      }
      return (
        <>
          <IconWrapper
            borderRadiusSize={BorderRadiusSize.SMALL}
            onClick={onClick}
          >
            <div className="countdown-timer-icon"></div>
          </IconWrapper>
          {targetDate && (
            <Popover
              open={popoverOpen}
              overlayClassName="timer-operation-popover"
              content={
                <TimerOperation status={status} onOperation={handleOperation} />
              }
              arrow={false}
              placement="bottom"
              align={{
                offset: [0, 0],
              }}
            >
              <div
                className="countdown-timer-text"
                onClick={onTimerTextClick}
                ref={popoverTriggerRef}
              >
                {formattedCountdown}
              </div>
            </Popover>
          )}
        </>
      );
    };

    return (
      <>
        <div
          className={classNames([
            'countdown-timer-root',
            status === TimerStatus.Running && 'running',
            `time-left-${timeLeftStatus}`,
          ])}
          ref={timerRootRef}
        >
          {renderReadonlyContent()}
          {renderContent()}
        </div>
        <Modal
          title={settingModalTitle}
          open={settingModalOpen}
          onCancel={() => setSettingModalOpen(false)}
          rootClassName="call-window-modal"
          onOk={handleOk}
          okText="Start"
        >
          <div className="countdown-timer-content-wrapper">
            <div className="setting-title">Set Length</div>
            <div className="countdown-timer-setting-list">
              {selectMinutesList.map(minutes => (
                <div
                  key={minutes}
                  className={classNames([
                    'countdown-timer-setting-list-item',
                    selected === minutes && 'selected',
                  ])}
                  onClick={() => onSelectMinutes(minutes)}
                >
                  {minutes} min
                </div>
              ))}
            </div>
          </div>
          <div className="custom-input-row">
            <span className="custom-input-prefix">Custom:</span>{' '}
            <InputNumber
              min={1}
              max={60}
              className="custom-time-input"
              placeholder="Enter time"
              style={{ width: 84 }}
              value={inputValue}
              onChange={onInputChange}
              precision={0}
              step={1}
            />
            <span className="custom-input-suffix">min</span>
          </div>
          <div className="countdown-timer-tips">
            <InfoCircleOutlined
              style={{ fontSize: 12, color: 'var(--dst-color-icon)' }}
            />
            <span className="countdown-timer-tips-text">
              Everyone can see countdown once turned on
            </span>
          </div>
        </Modal>
      </>
    );
  }
);
