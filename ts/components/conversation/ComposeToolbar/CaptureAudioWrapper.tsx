import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../../types/Util';
import { CaptureAudioButton } from '../../ComposeButtons';
import { AudioRecorder } from '../AudioRecorder';
import { useMemoizedFn, usePrevious } from 'ahooks';

export interface CaptureAudioWrapperProps {
  visible: boolean;
  onRecordStart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRecordComplete: (blob: Blob) => void;
  onClose: () => void;
  i18n: LocalizerType;
  resetKey: number;
}

export const CaptureAudioWrapper = (props: CaptureAudioWrapperProps) => {
  const { visible, onRecordStart, onRecordComplete, onClose, i18n, resetKey } =
    props;
  const prevResetKey = usePrevious(resetKey);

  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (prevResetKey && prevResetKey !== resetKey) {
      setRecording(false);
    }
  }, [prevResetKey, resetKey]);

  const onClick = useMemoizedFn(e => {
    setRecording(true);
    onRecordStart(e);
  });

  if (!visible) {
    return null;
  }

  return (
    <>
      {recording ? (
        <AudioRecorder
          i18n={i18n}
          onRecordComplete={onRecordComplete}
          onClose={onClose}
        />
      ) : (
        <CaptureAudioButton i18n={i18n} onClick={onClick} />
      )}
    </>
  );
};
