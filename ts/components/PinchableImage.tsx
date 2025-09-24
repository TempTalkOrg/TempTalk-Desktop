import { animated } from '@react-spring/web';
import { createUseGesture, pinchAction } from '@use-gesture/react';
import { useMemoizedFn } from 'ahooks';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ISize } from './image-gallery/IndividualImage';

export interface IPinchableImageProps {
  url: string;
  minScale?: number;
  maxScale?: number;
  style?: React.CSSProperties;
  rotation?: number;
  [key: string]: any;
}

export interface PinchableImageInstance {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  initSize: (size: ISize) => void;
}

const useGesture = createUseGesture([pinchAction]);

export const PinchableImage = forwardRef<
  PinchableImageInstance,
  IPinchableImageProps
>((props, ref) => {
  const {
    url,
    minScale = 0.5,
    maxScale = 100,
    style: styleProps,
    getContainer = () => document.body,
    rotation = 0,
    ...extraProps
  } = props;

  const [initSize, setInitSize] = useState<ISize>({ height: 0, width: 0 });

  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);

  let counterRef = useRef({
    plus: 0,
    minus: 0,
  });

  const onPinch = useMemoizedFn(({ event, trigger, memo }) => {
    const container = getContainer();

    let direction = event.deltaY < 0 ? 1 : -1;

    const imageBounds = imgRef.current!.getBoundingClientRect();

    // for keep scale rate after zoom in or zoom out
    const ratio = parseFloat((imageBounds.width / initSize.width).toFixed(2));

    let delta = parseFloat((0.05 * direction * ratio).toFixed(2));

    if (direction > 0) {
      counterRef.current.plus++;
    } else if (direction < 0) {
      counterRef.current.minus++;
    }

    if (
      (scale === maxScale && direction > 0) ||
      (scale === minScale && direction < 0)
    ) {
      return;
    }

    let nextScale = 0;
    let offset: number | undefined = undefined;

    setScale(prev => {
      nextScale = parseFloat((prev + delta).toFixed(2));

      if (direction > 0 && nextScale > maxScale) {
        offset = maxScale - prev;
      }

      return Math.min(Math.max(nextScale, minScale), maxScale);
    });

    requestAnimationFrame(() => {
      // amend actual delta
      if (offset !== undefined) {
        delta = offset;
      }

      const xRate =
        trigger === 'command'
          ? 0.5
          : (event.clientX + container.scrollLeft) / imageBounds.width;
      const yRate =
        trigger === 'command'
          ? 0.5
          : (event.clientY - 52 + container.scrollTop) / imageBounds.height;

      container.scrollLeft += initSize.width * delta * xRate;
      container.scrollTop += initSize.height * delta * yRate;
    });

    return memo;
  });

  useGesture(
    {
      onPinch,
    },
    {
      target: imgRef,
      pinch: {
        scaleBounds: { min: minScale, max: maxScale },
        rubberband: true,
      },
    }
  );

  useImperativeHandle(ref, () => ({
    zoomIn() {
      onPinch({
        event: { deltaY: -1 },
        trigger: 'command',
      });
    },
    zoomOut() {
      onPinch({
        event: { deltaY: 1 },
        trigger: 'command',
      });
    },
    zoomReset() {
      setScale(1);
    },
    initSize(size: ISize) {
      setInitSize(size);
    },
  }));

  useEffect(() => {
    if (url) {
      setInitSize({ height: 0, width: 0 });
      setScale(1);
    }
  }, [url]);

  useLayoutEffect(() => {
    const container = getContainer();
    if (!container || !imgRef.current || initSize.height === 0) return;

    const parentBounds = container.getBoundingClientRect();
    const imgBounds = imgRef.current.getBoundingClientRect();

    imgRef.current.style.marginTop = `${Math.max(
      0,
      (parentBounds.height - imgBounds.height) / 2
    )}px`;
  }, [initSize, scale, imgRef.current]);

  return (
    <animated.div
      {...extraProps}
      ref={imgRef}
      style={{
        ...styleProps,
        height: initSize.height * scale,
        width: initSize.width * scale,
        margin: `0 auto`,
      }}
    >
      <img
        src={url}
        alt="img"
        style={{
          height: '100%',
          width: '100%',
          transform: `rotate(${rotation}deg)`,
          transitionDuration: rotation ? '0.25s' : undefined,
        }}
      />
    </animated.div>
  );
});
