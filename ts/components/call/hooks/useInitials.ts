import { useMemoizedFn, useUpdate } from 'ahooks';
import { Participant, Room, RoomEvent } from '@cc-livekit/livekit-client';
import { useEffect, useMemo, useState } from 'react';
import { UserSessionCipher } from '../types';
import { getFakeName } from '../../../util';
import { inviteMembersAtom } from '../atoms/roomAtom';
import { useAtom } from 'jotai';

const mainWindow = window as any;

export class Contact {
  id: string;
  name?: string;
  avatarPath?: string;
  fakeName: string;
  cipher?: UserSessionCipher;
  accountName?: string;

  constructor(contact: {
    id: string;
    name?: string;
    avatarPath?: string;
    cipher?: UserSessionCipher;
    accountName?: string;
  }) {
    this.id = contact.id;
    this.name = contact.name ?? '';
    this.avatarPath = contact.avatarPath ?? '';
    this.fakeName = getFakeName(contact.id);
    this.accountName = contact.accountName ?? '';

    if (contact.cipher) {
      this.setCipher(contact.cipher);
    }
  }

  public getDisplayName() {
    return this.name || this.fakeName;
  }

  public getAccountName() {
    return this.accountName;
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
  const [inviteMembers, setInviteMembers] = useAtom(inviteMembersAtom);
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
    for (const contact of initials) {
      map.set(contact.id, new Contact(contact));
    }
    return map;
  }, [initials]);

  const supplementContactMap = useMemoizedFn(
    async (participant: Participant) => {
      const id = participant.identity.split('.')[0];

      if (inviteMembers.has(id)) {
        setInviteMembers(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }

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
      for (const participant of room.remoteParticipants.values()) {
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
