import { useMemoizedFn } from 'ahooks';
import {
  DataPacket_Kind,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
} from '@cc-livekit/livekit-client';
import { decodeText, encodeText } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { useEffect } from 'react';
import { Contact } from './useInitials';
import { CallRoomCipher } from '../types';

type ChatMessageType = {
  text: string;
  topic: 'chat';
};
type ControlMessageType = {
  topic: 'mute-other';
  identities: string[];
  sendTimestamp: number;
};

type ContinueCallAfterSilenceMessageType = {
  topic: 'continue-call-after-silence';
  identities: string[];
};

export type SetCountdownMessageType = {
  topic: 'set-countdown';
  durationSec: number;
};

type ClearCountdownMessageType = {
  topic: 'clear-countdown';
};

type ExtendCountdownMessageType = {
  topic: 'extend-countdown';
  extendSec: number;
};

type RestartCountdownMessageType = {
  topic: 'restart-countdown';
};

type RaiseHandMessageType = {
  topic: 'raise-hand';
};

type CancelHandMessageType = {
  topic: 'cancel-hand';
  hands: string[];
};

type EndCallMessageType = {
  topic: 'end-call';
  sendTimestamp: number;
};

type UserMessageType =
  | ChatMessageType
  | ControlMessageType
  | ContinueCallAfterSilenceMessageType
  | SetCountdownMessageType
  | ClearCountdownMessageType
  | ExtendCountdownMessageType
  | RestartCountdownMessageType
  | CountdownResponseMessageType
  | RaiseHandMessageType
  | CancelHandMessageType
  | EndCallMessageType;

type RtmMessageType = {
  userMessage: UserMessageType;
  uuid: string;
  sendTimestamp: number;
};

export type CountdownResponseMessageType = {
  topic: string;
  currentTimeMs: number;
  expiredTimeMs: number;
  durationMs: number;
  operatorIdentity: string;
};

export type RaiseHandResponseMessageType = {
  topic: string;
  hands: { identity: string; ts: number }[];
  operatorIdentity: string;
};

async function generateRtmData(
  userMessage: UserMessageType,
  roomCipher?: CallRoomCipher
) {
  const userMessageString = JSON.stringify(userMessage);

  // no need encrypt
  if (!roomCipher) {
    const data = {
      payload: userMessageString,
      sendTimestamp: Date.now(),
      uuid: uuidv4(),
    };

    return encodeText(JSON.stringify(data));
  }

  const messageBuffer = encodeText(userMessageString).buffer;
  const { payload, signature } = await roomCipher.encrypt(messageBuffer);

  const data = {
    payload,
    signature,
    sendTimestamp: Date.now(),
    uuid: uuidv4(),
  };

  return encodeText(JSON.stringify(data));
}

async function parseRtmData(
  data: Uint8Array,
  roomCipher?: CallRoomCipher,
  contact?: Contact
): Promise<RtmMessageType> {
  const cipherObject = JSON.parse(decodeText(data));
  const { uuid, sendTimestamp } = cipherObject;

  if (!roomCipher || !contact) {
    return {
      uuid,
      sendTimestamp,
      userMessage: JSON.parse(cipherObject.payload),
    };
  }

  const decryptedBuffer = await roomCipher.decrypt(
    cipherObject,
    contact.getCipher()?.getRawIdentityKey()
  );

  const decryptedText = decodeText(decryptedBuffer);

  return {
    uuid,
    sendTimestamp,
    userMessage: JSON.parse(decryptedText),
  };
}

const ENCRYPTED_TOPICS = [
  'chat',
  'mute-other',
  'continue-call-after-silence',
  'end-call',
];

export const useRTMMessage = ({
  room,
  roomCipher,
  contactMap,
  onChatMessage,
  onContinueCall,
  onSetCountdown,
  onClearCountdown,
  onExtendCountdown,
  onRestartCountdown,
  onRaiseHand,
  onCancelHand,
  onEndCall,
}: {
  room: Room;
  roomCipher: CallRoomCipher;
  contactMap: Map<string, Contact>;
  onChatMessage: (arg: { identity: string; text: string }) => void;
  onContinueCall: () => void;
  onSetCountdown: (arg: CountdownResponseMessageType) => void;
  onClearCountdown: () => void;
  onExtendCountdown: (arg: CountdownResponseMessageType) => void;
  onRestartCountdown: (arg: CountdownResponseMessageType) => void;
  onRaiseHand: (arg: RaiseHandResponseMessageType) => void;
  onCancelHand: (arg: RaiseHandResponseMessageType) => void;
  onEndCall: () => void;
}) => {
  const sendRTMMessage = useMemoizedFn(
    async (
      message: UserMessageType & { identities?: string[] },
      roomCipher?: CallRoomCipher
    ) => {
      const needEncrypt = ENCRYPTED_TOPICS.includes(message.topic);

      if (needEncrypt && !roomCipher) {
        throw new Error(
          `roomCipher is required by encrypting topic: ${message.topic}`
        );
      }

      const dataBuffer = await generateRtmData(message, roomCipher);

      await room.localParticipant.publishData(dataBuffer, {
        reliable: true,
        topic: message.topic,
        destinationIdentities: message.identities,
      });
    }
  );

  const sendChatText = useMemoizedFn(async (text: string) => {
    try {
      const chatMessage: ChatMessageType = {
        text,
        topic: 'chat',
      };

      await sendRTMMessage(chatMessage, roomCipher);
      onChatMessage?.({ identity: room.localParticipant.identity, text });
    } catch (e) {
      console.log('sendChatText error', e);
    }
  });

  const sendMuteMessage = useMemoizedFn(async (participant: Participant) => {
    try {
      const identities = [participant.identity];
      const muteMessage: ControlMessageType = {
        topic: 'mute-other',
        identities,
        sendTimestamp: Date.now(),
      };

      await sendRTMMessage(muteMessage, roomCipher);
    } catch (e) {
      console.log('sendMuteMessage error', e);
    }
  });

  const sendContinueMessage = useMemoizedFn(async () => {
    try {
      const identities = Array.from(room.remoteParticipants.values()).map(
        p => p.identity
      );
      const continueMessage: ContinueCallAfterSilenceMessageType = {
        topic: 'continue-call-after-silence',
        identities,
      };

      await sendRTMMessage(continueMessage, roomCipher);
    } catch (e) {
      console.log('sendContinueMessage error', e);
    }
  });

  const sendSetCountdownMessage = useMemoizedFn(async (durationSec: number) => {
    try {
      const setCountdownMessage: SetCountdownMessageType = {
        topic: 'set-countdown',
        durationSec,
      };

      await sendRTMMessage(setCountdownMessage);
    } catch (e) {
      console.log('sendSetCountdownMessage error', e);
    }
  });

  const sendClearCountdownMessage = useMemoizedFn(async () => {
    try {
      const clearCountdownMessage: ClearCountdownMessageType = {
        topic: 'clear-countdown',
      };

      await sendRTMMessage(clearCountdownMessage);
    } catch (e) {
      console.log('sendClearCountdownMessage error', e);
    }
  });

  const sendExtendCountdownMessage = useMemoizedFn(
    async (extendSec: number = 60) => {
      try {
        const extendCountdownMessage: ExtendCountdownMessageType = {
          topic: 'extend-countdown',
          extendSec,
        };

        await sendRTMMessage(extendCountdownMessage);
      } catch (e) {
        console.log('sendExtendCountdownMessage error', e);
      }
    }
  );

  const sendRestartCountdownMessage = useMemoizedFn(async () => {
    try {
      const restartCountdownMessage: RestartCountdownMessageType = {
        topic: 'restart-countdown',
      };

      await sendRTMMessage(restartCountdownMessage);
    } catch (e) {
      console.log('sendRestartCountdownMessage error', e);
    }
  });

  const sendRaiseHandMessage = useMemoizedFn(async () => {
    try {
      const handupMessage: RaiseHandMessageType = {
        topic: 'raise-hand',
      };

      await sendRTMMessage(handupMessage);
    } catch (e) {
      console.log('sendHandupMessage error', e);
    }
  });

  const sendCancelHandMessage = useMemoizedFn(async (hands: string[]) => {
    try {
      if (!hands || hands.length === 0) {
        throw new Error('hands is required');
      }

      const handdownMessage: CancelHandMessageType = {
        topic: 'cancel-hand',
        hands,
      };

      await sendRTMMessage(handdownMessage);
    } catch (e) {
      console.log('sendHanddownMessage error', e);
    }
  });

  const sendEndCallMessage = useMemoizedFn(async () => {
    try {
      const endCallMessage: EndCallMessageType = {
        topic: 'end-call',
        sendTimestamp: Date.now(),
      };

      await sendRTMMessage(endCallMessage, roomCipher);
    } catch (e) {
      console.log('sendEndCallMessage error', e);
    }
  });

  const handleChatTopic = useMemoizedFn(
    async (chatMessage: ChatMessageType, participant: RemoteParticipant) => {
      try {
        onChatMessage?.({
          identity: participant.identity,
          text: chatMessage.text,
        });
      } catch (e) {
        console.log(e);
      }
    }
  );

  const handleMuteTopic = useMemoizedFn(
    async (muteMessage: ControlMessageType) => {
      if (muteMessage.identities.includes(room.localParticipant.identity)) {
        room.localParticipant.setMicrophoneEnabled(false);
      }
    }
  );

  const handleContinueCall = useMemoizedFn(
    async (continueMessage: ContinueCallAfterSilenceMessageType) => {
      if (continueMessage.identities.includes(room.localParticipant.identity)) {
        onContinueCall?.();
      }
    }
  );

  const handleSetCountdown = useMemoizedFn(
    async (setCountdownMessage: CountdownResponseMessageType) => {
      onSetCountdown?.(setCountdownMessage);
    }
  );

  const handleExtendCountdown = useMemoizedFn(
    async (extendCountdownMessage: CountdownResponseMessageType) => {
      onExtendCountdown?.(extendCountdownMessage);
    }
  );

  const handleRestartCountdown = useMemoizedFn(
    async (extendCountdownMessage: CountdownResponseMessageType) => {
      onRestartCountdown?.(extendCountdownMessage);
    }
  );

  const handleClearCountdown = useMemoizedFn(async () => {
    onClearCountdown?.();
  });

  const handleRaiseHand = useMemoizedFn(
    async (raiseHandMessage: RaiseHandResponseMessageType) => {
      onRaiseHand?.(raiseHandMessage);
    }
  );

  const handleCancelHand = useMemoizedFn(
    async (cancelHandMessage: RaiseHandResponseMessageType) => {
      onCancelHand?.(cancelHandMessage);
    }
  );

  const handleEndCall = useMemoizedFn(async () => {
    onEndCall?.();
  });

  const handleDataReceived = useMemoizedFn(
    async (
      data: Uint8Array,
      participant?: RemoteParticipant,
      _?: DataPacket_Kind,
      topic?: string
    ) => {
      try {
        if (!topic) {
          return console.log('handle rtm data error: no topic');
        }

        const needEncrypt = ENCRYPTED_TOPICS.includes(topic);

        let contact;

        if (needEncrypt) {
          if (!participant) {
            return console.log('handle rtm data error: no participant');
          }

          contact = contactMap.get(participant.identity.split('.')[0]);
          if (!contact) {
            return console.log('handle rtm data error: contact not found.');
          }
        }

        const { userMessage } = await parseRtmData(
          data,
          needEncrypt ? roomCipher : undefined,
          needEncrypt ? contact : undefined
        );

        if (userMessage.topic !== topic) {
          return console.log('topic mismatch', userMessage, topic);
        }

        switch (topic) {
          case 'chat':
            return handleChatTopic(
              userMessage as ChatMessageType,
              participant as RemoteParticipant
            );
          case 'mute-other':
            return handleMuteTopic(userMessage as ControlMessageType);
          case 'continue-call-after-silence':
            return handleContinueCall(
              userMessage as ContinueCallAfterSilenceMessageType
            );
          case 'extend-countdown':
            return handleExtendCountdown(
              userMessage as CountdownResponseMessageType
            );
          case 'set-countdown':
            onChatMessage?.({
              identity: (userMessage as CountdownResponseMessageType)
                .operatorIdentity,
              text: 'starts a countdown timer',
            });
            return handleSetCountdown(
              userMessage as CountdownResponseMessageType
            );
          case 'restart-countdown':
            return handleRestartCountdown(
              userMessage as CountdownResponseMessageType
            );
          case 'clear-countdown': {
            return handleClearCountdown();
          }
          case 'raise-hand':
            return handleRaiseHand(userMessage as RaiseHandResponseMessageType);
          case 'cancel-hand':
            return handleCancelHand(
              userMessage as RaiseHandResponseMessageType
            );
          case 'end-call':
            return handleEndCall();
          default:
            return console.log('unknown topic', topic);
        }
      } catch (e) {
        console.log('handleDataReceived error', e, 'topic', topic);
      }
    }
  );

  useEffect(() => {
    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, []);

  return {
    sendChatText,
    sendMuteMessage,
    sendContinueMessage,
    // countdown
    sendSetCountdownMessage,
    sendClearCountdownMessage,
    sendExtendCountdownMessage,
    sendRestartCountdownMessage,
    // raise hand
    sendRaiseHandMessage,
    sendCancelHandMessage,
    // end call
    sendEndCallMessage,
  };
};
