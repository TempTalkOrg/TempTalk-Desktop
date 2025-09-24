import React, { FC, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { useMemoizedFn } from 'ahooks';
import { IconPause, IconPlay } from './shared/icons';

interface AudioMessageProps {
  src: string;
  classNames?: string;
  getAttachmentObjectUrl: () => Promise<string | null>;
}

const TRACK_COUNT = 35;
const MIN_HEIGHT = 2;
const MAX_HEIGHT = 30;

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

    for (let i = 0; i < TRACK_COUNT; i++) {
      const start = blockSize * i;
      const end = start + blockSize;
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }

      const average = sum / blockSize;
      const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, average * 100));
      samples.push(height);
    }

    // 检查是否需要放大
    const maxHeight = Math.max(...samples);
    if (maxHeight <= 15) {
      const scaleFactor = 3;
      return samples.map(height =>
        height === MIN_HEIGHT
          ? height
          : Math.min(MAX_HEIGHT, height * scaleFactor)
      );
    }

    return samples;
  } catch (error) {
    console.error('Error analyzing audio:', error);
    return [];
  }
};

export const AudioMessage: FC<AudioMessageProps> = ({
  src,
  classNames,
  getAttachmentObjectUrl,
}) => {
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
        audioRef.current.play();
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

  return (
    <div className={classnames(['audio-message', classNames])}>
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
        {isPlaying ? formatTime(duration - currentTime) : formatTime(duration)}
      </div>
    </div>
  );
};
