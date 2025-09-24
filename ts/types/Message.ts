import { Attachment } from './Attachment';
import { Contact } from './Contact';
import { IndexableBoolean, IndexablePresence } from './IndexedDB';

export type Message = UserMessage | VerifiedChangeMessage;
export type UserMessage = IncomingMessage | OutgoingMessage;

export type IncomingMessage = Readonly<
  {
    type: 'incoming';
    // Required
    attachments: Array<Attachment>;
    id: string;
    received_at: number;

    // Optional
    body?: string;
    quote?: any;
    atPersons?: string;
    decrypted_at?: number;
    errors?: Array<any>;
    expireTimer?: number;
    flags?: number;
    source?: string;
    sourceDevice?: number;
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    MessageSchemaVersion6 &
    ExpirationTimerUpdate &
    MessageSchemaVersion11
>;

export type OutgoingMessage = Readonly<
  {
    type: 'outgoing';

    // Required
    attachments: Array<Attachment>;
    destination: string; // PhoneNumber
    expirationStartTimestamp: number;
    id: string;
    received_at: number;
    sent: boolean;
    sent_to: Array<string>; // Array<PhoneNumber>

    // Optional
    body?: string;
    quote?: any;
    atPersons?: string;
    expires_at?: number;
    expireTimer?: number;
    recipients?: Array<string>; // Array<PhoneNumber>
    synced: boolean;
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    ExpirationTimerUpdate &
    MessageSchemaVersion11
>;

export type VerifiedChangeMessage = Readonly<
  {
    type: 'verified-change';
  } & SharedMessageProperties &
    MessageSchemaVersion5 &
    ExpirationTimerUpdate
>;

type SharedMessageProperties = Readonly<{
  conversationId: string;
  sent_at: number;
  timestamp: number;
  serverTimestamp: number;
}>;

type ExpirationTimerUpdate = Partial<
  Readonly<{
    expirationTimerUpdate: Readonly<{
      expireTimer: number;
      fromSync: boolean;
      source: string; // PhoneNumber
    }>;
  }>
>;

type MessageSchemaVersion5 = Partial<
  Readonly<{
    hasAttachments: IndexableBoolean;
    hasVisualMediaAttachments: IndexablePresence;
    hasFileAttachments: IndexablePresence;
  }>
>;

type MessageSchemaVersion6 = Partial<
  Readonly<{
    contact: Array<Contact>;
  }>
>;

type MessageSchemaVersion11 = Partial<
  Readonly<{
    mentionsAtFlags?: number;
    mentionsQuoteFlags?: number;
  }>
>;

export const isUserMessage = (message: Message): message is UserMessage =>
  message.type === 'incoming' || message.type === 'outgoing';

export const hasExpiration = (message: Message): boolean => {
  if (!isUserMessage(message)) {
    return false;
  }

  const { expireTimer } = message;

  return typeof expireTimer === 'number' && expireTimer > 0;
};
