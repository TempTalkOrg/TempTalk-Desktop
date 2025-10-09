import { useMemoizedFn, useUpdate } from 'ahooks';
import { Participant, Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect, useMemo, useState } from 'react';
import { UserSessionCipher } from '../types';
import { getFakeName } from '../../../util';

const mainWindow = window as any;

export class Contact {
  id: string;
  name?: string;
  avatarPath?: string;
  fakeName: string;
  cipher?: UserSessionCipher;

  constructor(contact: {
    id: string;
    name?: string;
    avatarPath?: string;
    cipher?: UserSessionCipher;
  }) {
    this.id = contact.id;
    this.name = contact.name ?? '';
    this.avatarPath = contact.avatarPath ?? '';
    this.fakeName = getFakeName(contact.id);
    if (contact.cipher) {
      this.setCipher(contact.cipher);
    }
  }

  public getDisplayName() {
    return this.name || this.fakeName;
  }

  public setCipher(cipher: UserSessionCipher) {
    this.cipher = cipher;
  }

  public getCipher() {
    return this.cipher;
  }
}

export type IInitials =
  | { id: string; name: string; avatarPath: string }[]
  | null;

export const useInitials = (room: Room) => {
  const [initials, setInitials] = useState<IInitials>(null);
  const update = useUpdate();
  const getContacts = async () => {
    try {
      const contacts = await mainWindow.getAllContacts();
      setInitials(contacts);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    getContacts();
  }, []);

  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    if (!initials) {
      return map;
    }
    for (let contact of initials) {
      map.set(contact.id, new Contact(contact));
    }
    return map;
  }, [initials]);

  const supplementContactMap = useMemoizedFn(
    async (participant: Participant) => {
      const id = participant.identity.split('.')[0];

      const { ciphers } = await (
        window as any
      ).textsecure.UserSessionCipher.batchLoadCiphers([id], (ids: string[]) =>
        (window as any).webapiServer
          .getKeysV3ForUids(ids)
          .then((data: any) => data?.keys)
      );

      const cipher = ciphers[0];

      const found = contactMap.get(id);

      if (found) {
        return found.setCipher(cipher);
      } else {
        const contact = new Contact({
          id,
          cipher,
        });
        contactMap.set(id, contact);
      }
    }
  );

  useEffect(() => {
    room.once(RoomEvent.SignalConnected, () => {
      for (let participant of room.remoteParticipants.values()) {
        supplementContactMap(participant);
      }
      update();
    });

    room.on(RoomEvent.ParticipantConnected, supplementContactMap);

    return () => {
      room.off(RoomEvent.ParticipantConnected, supplementContactMap);
    };
  }, []);

  return {
    initials,
    contactMap,
  };
};
