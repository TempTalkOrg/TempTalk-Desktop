import { useEffect, useMemo, useState } from 'react';
import { LocalAudioTrack, Room, RoomEvent } from '@cc-livekit/livekit-client';
import {
  DenoiseTrackProcessor,
  type DenoiseFilterOptions,
} from '@cc-livekit/denoise-plugin/dist/index.js';
import type { TrackReferenceOrPlaceholder } from '../modules/core';
import { useMemoizedFn } from 'ahooks';
import { useLocalParticipant } from '../modules/react';
import { useGlobalConfig } from './useGlobalConfig';

/**
 * @beta
 */
export interface useDenoisePluginFilterOptions {
  /**
   * The track reference to use for the noise filter (defaults: local microphone track)
   */
  trackRef?: TrackReferenceOrPlaceholder;
  /**
   * @internal
   */
  filterOptions?: DenoiseFilterOptions;

  room?: Room;

  defaultEnabled?: boolean;
}

export function useDenoisePluginFilter(
  options: useDenoisePluginFilterOptions = {}
) {
  const { room } = options;

  const [shouldEnable, setShouldEnable] = useState(
    options.defaultEnabled ?? false
  );
  const micPublication = useLocalParticipant(options).microphoneTrack;

  const [denoiseProcessor] = useState<DenoiseTrackProcessor>(
    new DenoiseTrackProcessor(options.filterOptions)
  );

  const { denoise } = useGlobalConfig();

  const excludedNameRegex = useMemo(() => {
    if (!denoise?.bluetooth?.excludedNameRegex) {
      return null;
    } else {
      return new RegExp(denoise.bluetooth.excludedNameRegex, 'i');
    }
  }, [denoise?.bluetooth?.excludedNameRegex]);

  const processAudioTrack = useMemoizedFn(async () => {
    if (
      micPublication &&
      micPublication.track instanceof LocalAudioTrack &&
      denoiseProcessor
    ) {
      let currentProcessor =
        micPublication.track.getProcessor() as DenoiseTrackProcessor;

      try {
        if (shouldEnable) {
          if (!currentProcessor) {
            await micPublication?.track?.setProcessor(denoiseProcessor);
            // update currentProcessor value
            currentProcessor =
              micPublication.track.getProcessor() as DenoiseTrackProcessor;
          }

          await currentProcessor.setEnabled?.(shouldEnable);
        } else {
          if (currentProcessor && currentProcessor.name === 'denoise-filter') {
            await currentProcessor.setEnabled?.(shouldEnable);
          }
        }
      } catch (e) {
        console.log('update audio processor error:', e);
      }
    }
  });

  const onDenoiseEnableChange = useMemoizedFn((enabled: boolean) => {
    setShouldEnable(enabled);
  });

  useEffect(() => {
    processAudioTrack();
  }, [shouldEnable, micPublication, denoiseProcessor]);

  const autoSwitchPluginEnable = useMemoizedFn(async () => {
    if (!room || !excludedNameRegex) {
      return;
    }
    const currentDeviceId =
      room.localParticipant.activeDeviceMap.get('audioinput');
    const deviceInfo = (await Room.getLocalDevices('audioinput')).find(
      device =>
        device.deviceId === currentDeviceId && device.kind === 'audioinput'
    );

    if (deviceInfo) {
      const deviceName = deviceInfo.label;
      const shouldExclude = excludedNameRegex.test(deviceName);
      setShouldEnable(!shouldExclude);
    }
  });

  useEffect(() => {
    if (!room) {
      return;
    }

    room.once(RoomEvent.Connected, autoSwitchPluginEnable);
    room.on(RoomEvent.ActiveDeviceChanged, autoSwitchPluginEnable);

    return () => {
      room.off(RoomEvent.ActiveDeviceChanged, autoSwitchPluginEnable);
    };
  }, []);

  return {
    denoiseEnable: shouldEnable,
    onDenoiseEnableChange,
  };
}
