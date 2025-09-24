import { Room, Track } from '@cc-livekit/livekit-client';
import { useAtomValue } from 'jotai';
import { deferredSpeakingParticipantAtom } from '../atoms/deferredSpeakingParticipantAtom';
import { useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';
import { floatingbarVisibleAtom } from '../atoms/floatingbarVisibleAtom';
import { useTracks } from '../modules/react/hooks/useTracks';

export const useSyncVideoFrame = (room: Room) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const timerWorkerRef = useRef<Worker>();
  const floatingbarVisible = useAtomValue(floatingbarVisibleAtom);

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    {
      room,
    }
  );

  const deferredSpeakingParticipant = useAtomValue(
    deferredSpeakingParticipantAtom
  );

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 180;
    canvasRef.current = canvas;
  }, []);

  const clearPreviousTailFrame = useMemoizedFn(() => {
    (window as any).snedFrameToFloatingBar('');
  });

  const captureVideoFrame = useMemoizedFn(() => {
    const currentParticipant =
      deferredSpeakingParticipant ||
      screenShareTracks[0]?.participant ||
      room.localParticipant;
    const currentVideoTrack = currentParticipant.getTrackPublication(
      Track.Source.Camera
    )?.track;

    if (!currentVideoTrack || currentVideoTrack.isMuted) {
      clearPreviousTailFrame();
      return;
    }

    const videoElement: HTMLVideoElement | null = document.querySelector(
      `video[data-sid="${currentVideoTrack?.sid}"]`
    );

    if (!videoElement) {
      clearPreviousTailFrame();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      clearPreviousTailFrame();
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      clearPreviousTailFrame();
      return;
    }

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (videoWidth > 0 && videoHeight > 0) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageB64 = canvas.toDataURL('image/jpeg', 0.9);
    const isLocalTrack = currentParticipant.isLocal;

    (window as any).snedFrameToFloatingBar({ imageB64, isLocalTrack });
  });

  const cleanupTimeWorker = useMemoizedFn(() => {
    if (timerWorkerRef.current) {
      timerWorkerRef.current.terminate();
    }
    clearPreviousTailFrame();
  });

  const setupTimerWorker = useMemoizedFn(() => {
    cleanupTimeWorker();

    // run interval in worker, avoid turn slower by brower optimization
    const blob = new Blob(
      [
        `self.setInterval(() => {
          self.postMessage(true);
        }, 125);
        `,
      ],
      { type: 'application/javascript' }
    );

    timerWorkerRef.current = new Worker(URL.createObjectURL(blob));

    timerWorkerRef.current.onmessage = () => {
      captureVideoFrame();
    };
  });

  useEffect(() => {
    if (floatingbarVisible) {
      setupTimerWorker();
    } else {
      cleanupTimeWorker();
    }

    return () => {
      cleanupTimeWorker();
    };
  }, [floatingbarVisible]);
};
