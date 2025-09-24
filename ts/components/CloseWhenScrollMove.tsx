import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onClose: () => void;
}

export const CloseWhenScrollMove = (props: Props) => {
  const { onClose } = props;
  const [oldRect, setOldRect] = useState<any>(null);
  const oldRectRef = useRef(oldRect);
  const mainSpanRef = useRef<any>(null);

  useEffect(() => {
    oldRectRef.current = oldRect;
  }, [oldRect]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const rect = mainSpanRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      if (!oldRectRef.current) {
        setOldRect(rect);
        return;
      }

      const deltaX = Math.abs(rect.x - oldRectRef.current.x);
      const deltaY = Math.abs(rect.y - oldRectRef.current.y);

      const minDelta = 0;
      if (deltaX > minDelta || deltaY > minDelta) {
        onClose();
        return;
      }
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return <span ref={mainSpanRef}></span>;
};
