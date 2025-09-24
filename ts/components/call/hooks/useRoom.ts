import { Room, RoomOptions } from '@cc-livekit/livekit-client';
import { useEffect, useMemo, useState } from 'react';
import { CustomE2EEKeyProvider } from '../utils';
import { useMemoizedFn } from 'ahooks';
import { message } from 'antd';

export const useRoom = ({ key }: { key: ArrayBuffer }) => {
  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  const keyProvider = useMemo(() => new CustomE2EEKeyProvider(), []);

  const room = useMemo(() => {
    const roomOptions: RoomOptions = {
      adaptiveStream: { pixelDensity: 'screen', pauseVideoInBackground: false },
      dynacast: true,
      e2ee: {
        keyProvider,
        worker: new Worker(
          '../node_modules/@cc-livekit/livekit-client/dist/livekit-client.e2ee.worker.js'
        ),
      },
      publishDefaults: {
        videoEncoding: {
          maxBitrate: 3_000_000,
          maxFramerate: 30,
        },
        screenShareEncoding: {
          maxBitrate: 2_500_000,
          maxFramerate: 5,
          priority: 'medium',
        },
        videoCodec: 'h264',
      },
      videoCaptureDefaults: {
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
      },
    };

    return new Room(roomOptions);
  }, []);

  const setupEncryptKey = useMemoizedFn(async key => {
    try {
      await keyProvider.setKey(key);
      await room.setE2EEEnabled(true);

      console.log('e2ee setup done.');
      setE2eeSetupComplete(true);
    } catch (e) {
      message.error('Failed to setup e2ee', 0);
      console.error('e2ee setup error', e);
    }
  });

  useEffect(() => {
    if (!key) {
      return;
    }
    setupEncryptKey(key);
  }, [room, key]);

  return {
    room,
    e2eeSetupComplete,
  };
};
