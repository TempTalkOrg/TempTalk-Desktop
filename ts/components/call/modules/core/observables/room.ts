import { Room, RoomEvent } from '@cc-livekit/livekit-client';
import {
  map,
  Observable,
  startWith,
  finalize,
  concat,
  Subject,
  filter,
} from 'rxjs';
import type { RoomEventCallbacks } from '@cc-livekit/livekit-client/dist/src/room/Room';
import { log } from '../logger';

export function roomEventSelector<T extends RoomEvent>(room: Room, event: T) {
  const observable = new Observable<Parameters<RoomEventCallbacks[T]>>(
    subscribe => {
      const update = (...params: Parameters<RoomEventCallbacks[T]>) => {
        subscribe.next(params);
      };
      room.on(event as keyof RoomEventCallbacks, update);

      const unsubscribe = () => {
        room.off(event as keyof RoomEventCallbacks, update);
      };
      return unsubscribe;
    }
  );

  return observable;
}

export function connectionStateObserver(room: Room) {
  return roomEventSelector(room, RoomEvent.ConnectionStateChanged).pipe(
    map(([connectionState]) => connectionState),
    startWith(room.state)
  );
}

export function createMediaDeviceObserver(
  kind?: MediaDeviceKind,
  onError?: (e: Error) => void,
  requestPermissions = true
) {
  const onDeviceChange = async () => {
    try {
      const newDevices = await Room.getLocalDevices(kind, requestPermissions);
      deviceSubject.next(newDevices);
    } catch (e: any) {
      onError?.(e);
    }
  };
  const deviceSubject = new Subject<MediaDeviceInfo[]>();

  const observable = deviceSubject.pipe(
    finalize(() => {
      navigator?.mediaDevices?.removeEventListener(
        'devicechange',
        onDeviceChange
      );
    })
  );

  if (typeof window !== 'undefined') {
    if (!window.isSecureContext) {
      throw new Error(
        `Accessing media devices is available only in secure contexts (HTTPS and localhost), in some or all supporting browsers. See: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/mediaDevices`
      );
    }
    navigator?.mediaDevices?.addEventListener('devicechange', onDeviceChange);
  }
  // because we rely on an async function, concat the promise to retrieve the initial values with the observable
  return concat(
    Room.getLocalDevices(kind, requestPermissions).catch(e => {
      onError?.(e);
      return [] as MediaDeviceInfo[];
    }),
    observable
  );
}

export function createActiveDeviceObservable(
  room: Room,
  kind: MediaDeviceKind
) {
  return roomEventSelector(room, RoomEvent.ActiveDeviceChanged).pipe(
    filter(([kindOfDevice]) => kindOfDevice === kind),
    map(([kind, deviceId]) => {
      log.debug('activeDeviceObservable | RoomEvent.ActiveDeviceChanged', {
        kind,
        deviceId,
      });
      return deviceId;
    })
  );
}

export function observeRoomEvents(
  room: Room,
  ...events: RoomEvent[]
): Observable<Room> {
  const observable = new Observable<Room>(subscribe => {
    const onRoomUpdate = () => {
      subscribe.next(room);
    };

    events.forEach(evt => {
      room.on(evt, onRoomUpdate);
    });

    const unsubscribe = () => {
      events.forEach(evt => {
        room.off(evt, onRoomUpdate);
      });
    };
    return unsubscribe;
  }).pipe(startWith(room));

  return observable;
}

export function activeSpeakerObserver(room: Room) {
  return roomEventSelector(room, RoomEvent.ActiveSpeakersChanged).pipe(
    map(([speakers]) => speakers)
  );
}
