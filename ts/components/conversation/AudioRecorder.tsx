import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef, useState } from 'react';
import moment from 'moment';
import { Tooltip } from 'antd';
import { LocalizerType } from '../../types/Util';

export interface AudioRecorderProps {
  onRecordComplete: (blob: Blob) => void;
  onClose: () => void;
  i18n: LocalizerType;
}

const MAX_RECORD_SECONDS = 60 * 3;

export const AudioRecorder = (props: AudioRecorderProps) => {
  const { onRecordComplete, onClose, i18n } = props;
  const [startTime] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();
  const [timeText, setTimeText] = useState('0:00');
  const clickedFinishRef = useRef(false);
  const audioContextRef = useRef<AudioContext>();
  const recorderRef = useRef<any>();
  const sourceRef = useRef<any>();
  const viewRootRef = useRef<HTMLDivElement>(null);
  const [tooltipText, setTooltipText] = useState('');

  const updateTime = useMemoizedFn((duration: moment.Duration) => {
    const minutes = `${Math.trunc(duration.asMinutes())}`;
    let seconds = `${duration.seconds()}`;
    if (seconds.length < 2) {
      seconds = `0${seconds}`;
    }
    setTimeText(`${minutes}:${seconds}`);
  });

  const checkTimeLimit = useMemoizedFn((duration: moment.Duration) => {
    const seconds = Math.trunc(duration.asSeconds());
    const delta = MAX_RECORD_SECONDS - seconds;

    if (delta < 0) {
      setTooltipText('');
      finish();
      return;
    }

    if (delta <= 10) {
      setTooltipText(i18n('recordTimeLimitTip', [String(delta)]));
    }
  });

  const onDurationChange = useMemoizedFn(() => {
    const duration = moment.duration(Date.now() - startTime, 'milliseconds');

    updateTime(duration);
    checkTimeLimit(duration);
  });

  const handleBlob = useMemoizedFn((_, blob) => {
    if (blob && clickedFinishRef.current) {
      onRecordComplete?.(blob);
    } else {
      close();
    }
  });

  const start = useMemoizedFn(() => {
    clickedFinishRef.current = false;
    audioContextRef.current = new AudioContext();

    const input = audioContextRef.current.createGain();
    recorderRef.current = new (window as any).WebAudioRecorder(input, {
      encoding: 'mp3',
      workerDir: 'js/', // must end with slash
      options: {
        mp3: {
          bitRate: 128,
        },
      },
    });

    recorderRef.current!.onComplete = handleBlob;
    recorderRef.current!.onError = onError;
    //@ts-ignore
    navigator.webkitGetUserMedia(
      { audio: true },
      (stream: any) => {
        sourceRef.current =
          audioContextRef.current!.createMediaStreamSource(stream);
        sourceRef.current.connect(input);
      },
      onError
    );
    recorderRef.current.startRecording();
  });

  const close = useMemoizedFn(() => {
    onClose?.();
  });

  const onError = useMemoizedFn(error => {
    // Protect against out-of-band errors, which can happen if the user revokes media
    //   permissions after successfully accessing the microphone.
    if (!recorderRef.current) {
      return;
    }

    close();

    if (error && error.name === 'NotAllowedError') {
      (window as any).log.warn(
        'RecorderView.onError: Microphone access is not allowed!'
      );
      (window as any).showPermissionsPopup();
    } else {
      (window as any).log.error(
        'RecorderView.onError:',
        error && error.stack ? error.stack : error
      );
    }
  });

  const onSwitchAway = () => {
    close();
  };

  const finish = useMemoizedFn(() => {
    clickedFinishRef.current = true;
    recorderRef.current.finishRecording();
    close();
  });

  useEffect(() => {
    intervalRef.current = setInterval(onDurationChange, 1000);

    start();
    window.addEventListener('blur', onSwitchAway);

    return () => {
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.cancelRecording();
      }
      recorderRef.current = null;

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = undefined;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
          (window as any).log.info('audio context closed');
        });
        audioContextRef.current = undefined;
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }

      window.removeEventListener('blur', onSwitchAway);
    };
  }, []);

  return (
    <div className="recorder clearfix" ref={viewRootRef}>
      <button className="finish" onClick={finish}>
        <span className="icon"></span>
      </button>
      <Tooltip
        title={tooltipText}
        open={!!tooltipText}
        rootClassName="audio-recorder-time-limit-tooltip"
        align={{
          offset: [0, -8],
        }}
      >
        <span className="time">{timeText}</span>
      </Tooltip>
      <button className="close" onClick={close}>
        <span className="icon"></span>
      </button>
    </div>
  );
};
