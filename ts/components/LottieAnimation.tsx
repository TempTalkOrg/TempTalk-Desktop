import { DotLottie } from '@lottiefiles/dotlottie-web';
import React, { useEffect, useRef } from 'react';

export const LottieAnimation = (props: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotLottieRef = useRef<DotLottie | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      dotLottieRef.current = new DotLottie({
        canvas: canvasRef.current,
        loop: true,
        autoplay: true,
        ...props,
      });
    }

    return () => {
      dotLottieRef.current?.destroy();
    };
  }, []);

  if (!props.src) {
    return null;
  }

  const { style } = props;

  return <canvas ref={canvasRef} style={style} />;
};
