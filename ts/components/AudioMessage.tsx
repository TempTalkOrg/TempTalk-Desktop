import React, { FC, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { useMemoizedFn } from 'ahooks';
import { IconPause, IconPlay } from './shared/icons';
import { VOICE_PLAYBACK_SPEED_OPTIONS } from './shared/constant';

interface AudioMessageProps {
  src: string;
  classNames?: string;
  getAttachmentObjectUrl: () => Promise<string | null>;
  getVoicePlaybackSpeed: () => number;
  setVoicePlaybackSpeed: (playbackSpeed: number) => void;
  onPlay?: () => void;
}

const TRACK_COUNT = 35;
const MIN_HEIGHT = 2;
const MAX_HEIGHT = 30;

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// 根据音频的全局最大振幅计算动态最大高度
const calculateDynamicMaxHeight = (globalMax: number): number => {
  if (globalMax >= 0.7) {
    return MAX_HEIGHT;
  } else if (globalMax >= 0.4) {
    return MIN_HEIGHT + ((globalMax - 0.4) / 0.3) * (MAX_HEIGHT - 20) + 18;
  } else if (globalMax >= 0.2) {
    return MIN_HEIGHT + ((globalMax - 0.2) / 0.2) * 18 + 10;
  } else {
    return MIN_HEIGHT + (globalMax / 0.2) * 10 + 4;
  }
};

const analyzeAudio = async (src: string): Promise<number[]> => {
  try {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / TRACK_COUNT);
    const samples: number[] = [];
    // 先找出全局最大值用于归一化
    let globalMax = 0;
    for (let i = 0; i < channelData.length; i++) {
      globalMax = Math.max(globalMax, Math.abs(channelData[i]));
    }
    // 根据 globalMax 的实际大小动态计算最大高度
    const dynamicMaxHeight = calculateDynamicMaxHeight(globalMax);

    for (let i = 0; i < TRACK_COUNT; i++) {
      const start = blockSize * i;
      const end = start + blockSize;
      let peak = 0;

      // 使用峰值而不是平均值
      for (let j = start; j < end; j++) {
        peak = Math.max(peak, Math.abs(channelData[j]));
      }

      // 归一化并缩放到动态最大高度
      const normalized = globalMax > 0 ? peak / globalMax : 0;
      const height = Math.max(
        MIN_HEIGHT,
        Math.min(
          dynamicMaxHeight,
          MIN_HEIGHT + normalized * (dynamicMaxHeight - MIN_HEIGHT)
        )
      );

      samples.push(height);
    }

    return samples;
  } catch (error) {
    console.error('Error analyzing audio:', error);
    return [];
  }
};

export const AudioMessage: FC<AudioMessageProps> = props => {
  const {
    src,
    classNames,
    getAttachmentObjectUrl,
    getVoicePlaybackSpeed,
    setVoicePlaybackSpeed,
    onPlay,
  } = props;
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volumeSamples, setVolumeSamples] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const bindEventRef = useRef<boolean>(false);

  const [audioUrl, setAudioUrl] = useState<string>();

  const init = async () => {
    if (audioRef.current && src) {
      const audioUrl = await getAttachmentObjectUrl();
      if (audioUrl) {
        setAudioUrl(audioUrl);

        const samples = await analyzeAudio(audioUrl);
        setVolumeSamples(samples);
      }
    }
  };

  useEffect(() => {
    init();
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.playbackRate = getVoicePlaybackSpeed();
        audioRef.current.play();
        onPlay?.();
      }
      setIsPlaying(prev => !prev);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = ratio * duration;
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      setCurrentTime(ratio * duration);
      audioRef.current.currentTime = ratio * duration;
    }
  };

  const stopAudioPlay = useMemoizedFn((event: any) => {
    if (audioRef.current && event.detail !== audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  });

  const onAudioPlay = useMemoizedFn(() => {
    if (!bindEventRef.current) {
      bindEventRef.current = true;
      (window as any).addEventListener('message-audio-all-stop', stopAudioPlay);
    }

    const ev = new CustomEvent('message-audio-all-stop', {
      detail: audioRef.current,
    });
    (window as any).dispatchEvent(ev);
  });

  const onAudioPause = () => {
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      if (bindEventRef.current) {
        window.removeEventListener('message-audio-all-stop', stopAudioPlay);
      }
    };
  }, []);

  const handlePlaybackSpeedClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const newPlaybackSpeed =
      VOICE_PLAYBACK_SPEED_OPTIONS[
        (VOICE_PLAYBACK_SPEED_OPTIONS.indexOf(getVoicePlaybackSpeed()) + 1) %
          VOICE_PLAYBACK_SPEED_OPTIONS.length
      ];
    setVoicePlaybackSpeed(newPlaybackSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newPlaybackSpeed;
    }
  };

  const audioPlayBackSpeed = getVoicePlaybackSpeed();
  const audioPlayBackSpeedText = audioPlayBackSpeed
    ? `${audioPlayBackSpeed}x`
    : '';

  return (
    <div
      className={classnames([
        'audio-message',
        classNames,
        { 'is-playing': isPlaying },
      ])}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPlay={onAudioPlay}
        onPause={onAudioPause}
      />
      <button onClick={togglePlay} className="audio-message__control-button">
        {isPlaying ? (
          <IconPause
            height={14}
            className="audio-message__control-button-pause"
          />
        ) : (
          <IconPlay
            height={14}
            className="audio-message__control-button-play"
          />
        )}
      </button>

      <div
        ref={progressRef}
        className="audio-message__progress"
        onClick={handleProgressClick}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onMouseMove={handleDrag}
      >
        <div className="audio-message__progress-bars">
          {volumeSamples.map((height, index) => (
            <div
              key={index}
              className={`audio-message__progress-bar ${currentTime / duration > index / TRACK_COUNT ? 'is-active' : ''}`}
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        <div
          className="audio-message__progress-handle"
          style={{
            left: `${(currentTime / duration) * 100}%`,
          }}
        />
      </div>

      <div className="audio-message__time">
        <div className="audio-message__time-text">
          {isPlaying
            ? formatTime(duration - currentTime)
            : formatTime(duration)}
        </div>
        <div
          className="audio-message__playback-speed-control"
          onClick={handlePlaybackSpeedClick}
          onDoubleClick={e => e.stopPropagation()}
        >
          {audioPlayBackSpeedText}
        </div>
      </div>
    </div>
  );
};
