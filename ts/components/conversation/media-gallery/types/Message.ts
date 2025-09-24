import { Attachment } from '../../../../types/Attachment';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  sent_at: number;
  received_at: number;
  serverTimestamp: number;
};
