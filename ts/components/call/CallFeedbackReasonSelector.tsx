import React, {
  useImperativeHandle,
  useMemo,
  useState,
  forwardRef,
} from 'react';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import { Tabs } from 'antd';

const AUDIO_REASONS = [
  'echo',
  'can-not-hear-me',
  'distorted',
  'slow',
  'choppy',
  'noise',
  'can-not-hear-others',
];

const VIDEO_REASON = [
  'distorted',
  'can-not-see-me',
  'blurry',
  'can-not-see-others',
  'not-match-audio',
  'frozen',
];

const OTHER_REASON = ['kept-disconnecting', 'suddenly-ended'];

interface CallFeedbackReasonSelectorProps {
  i18n: LocalizerType;
}

export interface ICallFeedbackReasonSelectorRef {
  getCheckedReason: () => Record<string, number[]>;
}

export const CallFeedbackReasonSelector = forwardRef<
  ICallFeedbackReasonSelectorRef,
  CallFeedbackReasonSelectorProps
>(({ i18n }, ref) => {
  const items = [
    { key: 'audio', label: i18n('audio') },
    { key: 'video', label: i18n('video') },
    { key: 'other', label: i18n('other') },
  ];

  const [currentTab, setCurrentTab] = useState('audio');
  const [checkedReason, setCheckedReason] = useState<Record<string, number[]>>({
    audio: [],
    video: [],
    other: [],
  });

  const onChange = useMemoizedFn((key: string) => {
    setCurrentTab(key);
  });

  useImperativeHandle(ref, () => ({
    getCheckedReason: () => checkedReason,
  }));

  const reasonList = useMemo(() => {
    const list =
      {
        audio: AUDIO_REASONS,
        video: VIDEO_REASON,
        other: OTHER_REASON,
      }[currentTab] || [];

    return list.map((reason, index) => ({
      label: reason,
      value: index,
    }));
  }, [currentTab]);

  const onReasonCheckedChange = useMemoizedFn(event => {
    const value = Number(event.target.value);
    if (event.target.checked) {
      setCheckedReason(prev => ({
        ...prev,
        [currentTab]: [...prev[currentTab], value],
      }));
    } else {
      setCheckedReason(prev => ({
        ...prev,
        [currentTab]: prev[currentTab].filter(target => target !== value),
      }));
    }
  });

  return (
    <div>
      <Tabs items={items} defaultActiveKey="audio" onChange={onChange} />
      <div className="reason-checkbox-list">
        {reasonList.map(reason => (
          <label
            key={reason.value}
            htmlFor={`${currentTab}-${reason.value}`}
            className="reason-checkbox-list-item"
          >
            <input
              id={`${currentTab}-${reason.value}`}
              className="module-contact-list-item__input check-box-border"
              type="checkbox"
              value={reason.value}
              checked={checkedReason[currentTab].includes(reason.value)}
              onChange={onReasonCheckedChange}
            />
            <span>
              {i18n(`callFeedback.reason.${currentTab}.${reason.label}`)}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
});
