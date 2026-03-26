import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioPipelineTrackProcessor,
  type AudioPipelineOptions,
  type DenoiseModuleId,
} from '@cc-livekit/audio-pipeline-plugin';
import { LocalAudioTrack, Room, RoomEvent } from '@cc-livekit/livekit-client';
import type { TrackReferenceOrPlaceholder } from '../modules/core';
import { useMemoizedFn } from 'ahooks';
import { useLocalParticipant } from '../modules/react';
import { useGlobalConfig } from './useGlobalConfig';
import { GlobalConfigType } from '../atoms/globalConfigAtom';

const DEFAULT_ATTEN_LIM_DB = 100;
const DEFAULT_POST_FILTER_BETA = 0;

const WORKLET_URL = new URL(
  '../node_modules/@cc-livekit/audio-pipeline-plugin/dist/AudioPipelineWorklet.js',
  location.href
).toString();

type DenoiseMode = GlobalConfigType['denoise']['mode'];

const MODE_TO_ENGINE: Record<DenoiseMode, DenoiseModuleId> = {
  standard: 'rnnoise',
  enhanced: 'deepfilternet',
};

export interface UseDenoisePluginFilterOptions {
  trackRef?: TrackReferenceOrPlaceholder;
  filterOptions?: Omit<AudioPipelineOptions, 'workletUrl'>;
  room?: Room;
  defaultEnabled?: boolean;
}

const STORAGE_KEY = 'denoise-mode';

export function useDenoisePluginFilter(
  options: UseDenoisePluginFilterOptions = {}
) {
  const { room } = options;

  const [shouldEnable, setShouldEnable] = useState(
    options.defaultEnabled ?? false
  );
  const micPublication = useLocalParticipant(options).microphoneTrack;
  const { denoise } = useGlobalConfig();

  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const userSelectedMode = useMemo<DenoiseMode>(() => {
    let mode: DenoiseMode = localStorage.getItem(STORAGE_KEY) as DenoiseMode;
    if (!mode) {
      mode = denoise.mode;
    }
    return mode;
  }, []);

  const [denoiseMode, setDenoiseMode] = useState<DenoiseMode>(userSelectedMode);

  const [processor] = useState<AudioPipelineTrackProcessor>(
    () =>
      new AudioPipelineTrackProcessor({
        workletUrl: WORKLET_URL,
        debugLogs: options.filterOptions?.debugLogs,
        stages: { denoise: MODE_TO_ENGINE[userSelectedMode] },
        moduleConfigs: {
          rnnoise: { ...options.filterOptions?.moduleConfigs?.rnnoise },
          deepfilternet: {
            attenLimDb: DEFAULT_ATTEN_LIM_DB,
            postFilterBeta: DEFAULT_POST_FILTER_BETA,
          },
        },
        batchFrames: options.filterOptions?.batchFrames,
      })
  );

  const enqueueOperation = useMemoizedFn(
    (operation: () => Promise<void>): Promise<void> => {
      operationQueueRef.current = operationQueueRef.current
        .then(operation)
        .catch(error => {
          console.log('[Denoise] processor operation failed', error);
        });
      return operationQueueRef.current;
    }
  );

  const excludedNameRegex = useMemo(() => {
    if (!denoise.bluetooth.excludedNameRegex) return null;
    return new RegExp(denoise.bluetooth.excludedNameRegex, 'i');
  }, [denoise.bluetooth.excludedNameRegex]);

  const processAudioTrack = useMemoizedFn(async () => {
    if (!micPublication || !(micPublication.track instanceof LocalAudioTrack)) {
      return;
    }

    const track = micPublication.track;
    const currentProcessor = track.getProcessor();

    try {
      if (shouldEnable) {
        if (currentProcessor !== processor) {
          await track.setProcessor(processor);
        }
        await processor.setEnabled(true);
      } else if (
        currentProcessor &&
        (currentProcessor as AudioPipelineTrackProcessor).name ===
          'audio-pipeline-filter'
      ) {
        await processor.setEnabled(false);
      }
    } catch (e) {
      console.log('update audio processor error:', e);
    }
  });

  const onDenoiseEnableChange = useMemoizedFn((enabled: boolean) => {
    setShouldEnable(enabled);
  });

  const onDenoiseModeChange = useMemoizedFn((mode: DenoiseMode) => {
    setDenoiseMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  });

  useEffect(() => {
    processAudioTrack();
  }, [shouldEnable, micPublication]);

  useEffect(() => {
    enqueueOperation(async () => {
      await processor.setStageModule('denoise', MODE_TO_ENGINE[denoiseMode]);
    });
  }, [denoiseMode]);

  const autoSwitchPluginEnable = useMemoizedFn(async () => {
    if (!room || !excludedNameRegex) return;

    const currentDeviceId =
      room.localParticipant.activeDeviceMap.get('audioinput');
    const deviceInfo = (await Room.getLocalDevices('audioinput')).find(
      device =>
        device.deviceId === currentDeviceId && device.kind === 'audioinput'
    );

    if (deviceInfo) {
      setShouldEnable(!excludedNameRegex.test(deviceInfo.label));
    }
  });

  useEffect(() => {
    if (!room) return;

    room.once(RoomEvent.Connected, autoSwitchPluginEnable);
    room.on(RoomEvent.ActiveDeviceChanged, autoSwitchPluginEnable);

    return () => {
      room.off(RoomEvent.ActiveDeviceChanged, autoSwitchPluginEnable);
    };
  }, [room, autoSwitchPluginEnable]);

  return {
    denoiseEnable: shouldEnable,
    onDenoiseEnableChange,
    denoiseMode,
    onDenoiseModeChange,
  };
}
