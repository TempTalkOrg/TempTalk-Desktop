import React, { useEffect, useState } from 'react';

function formatDurationSeconds(startAt: number): string {
  const sec = Math.floor(Date.now() / 1000 - startAt);
  const fixNumber = (num: number, length: number) => {
    return ('' + num).length < length
      ? (new Array(length + 1).join('0') + num).slice(-length)
      : '' + num;
  };
  let t = sec;
  let hours = 0;
  let minutes = 0;
  if (t >= 3600) {
    hours = Math.floor(t / 3600);
    t %= 3600;
  }
  if (t >= 60) {
    minutes = Math.floor(t / 60);
    t %= 60;
  }
  let result = '';
  if (hours) {
    result = `${hours}:`;
  }

  return `${result + fixNumber(minutes, 2)}:${fixNumber(t, 2)}`;
}

type MeetingTimerProps = {
  startAt: number;
};
const MeetingTimer = (props: MeetingTimerProps) => {
  const [_, setTime] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  return <>{formatDurationSeconds(props.startAt)}</>;
};

export default MeetingTimer;
