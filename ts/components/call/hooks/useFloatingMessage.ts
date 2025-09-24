import { useMemoizedFn } from 'ahooks';
import {
  Participant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from '@cc-livekit/livekit-client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LocalizerType } from '../../../types/Util';
import { get } from 'lodash';

export interface FloatingMessage {
  id: string;
  text: string;
  timestamp: number;
  identity: string;
  name: string;
}

interface IProps {
  room: Room;
  contactMap: Map<string, any>;
  i18n: LocalizerType;
}

const DEFAULT_CHAT_DURATION = 9000;

export function useFloatingMessage({ room, contactMap, i18n }: IProps) {
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const timeoutRefs = useRef<{ [key: string]: number }>({});
  const [chatPresets, setChatPresets] = useState<string[]>([]);
  const [chatDuration, setChatDuration] = useState(DEFAULT_CHAT_DURATION);
  const PRESET_MESSAGE_TYPE = useMemo(
    () => ({
      join: i18n('floatingMessage.join'),
      'mic-on': i18n('floatingMessage.micOn'),
      'mic-off': i18n('floatingMessage.micOff'),
      'start-screen': i18n('floatingMessage.startScreen'),
    }),
    []
  );

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const addMessage = useMemoizedFn(
    ({ identity, text }: { identity: string; text: string }) => {
      const newMessage: FloatingMessage = {
        id: Math.random().toString(36).substring(2, 9),
        text,
        identity,
        timestamp: Date.now(),
        name: contactMap.get(identity.split('.')[0])?.getDisplayName(),
      };

      setMessages(prev => {
        const updatedMessages = [newMessage, ...prev].slice(0, 6);
        return updatedMessages;
      });

      const timeoutId = window.setTimeout(() => {
        removeMessage(newMessage.id);
      }, chatDuration);

      timeoutRefs.current[newMessage.id] = timeoutId;
    }
  );

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

  const handleTrackUnmuted = useCallback(
    (track: TrackPublication, participant: Participant) => {
      if (track.kind === 'audio') {
        addMessage({
          identity: participant.identity,
          text: PRESET_MESSAGE_TYPE['mic-on'],
        });
      }
    },
    []
  );

  const handleTrackMuted = useCallback(
    (track: TrackPublication, participant: Participant) => {
      if (track.kind === 'audio') {
        addMessage({
          identity: participant.identity,
          text: PRESET_MESSAGE_TYPE['mic-off'],
        });
      }
    },
    []
  );

  const handleParticipantConnected = useCallback((participant: Participant) => {
    addMessage({
      identity: participant.identity,
      text: PRESET_MESSAGE_TYPE.join,
    });
  }, []);

  const handleTrackPublished = useCallback(
    (track: TrackPublication, participant: Participant) => {
      if (track.source === Track.Source.ScreenShare) {
        addMessage({
          identity: participant.identity,
          text: PRESET_MESSAGE_TYPE['start-screen'],
        });
      }
    },
    []
  );

  useEffect(() => {
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);

    return () => {
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.LocalTrackPublished, handleTrackPublished);
    };
  }, []);

  const initChatPresets = useMemoizedFn(async () => {
    const globalConfig = await (window as any).getGlobalConfig();
    const chatPresets = get(globalConfig, 'call.chatPresets');
    const chatDuration = get(
      globalConfig,
      'call.chat.autoHideTimeout',
      DEFAULT_CHAT_DURATION
    );
    setChatPresets(chatPresets);
    setChatDuration(chatDuration);
  });

  useEffect(() => {
    initChatPresets();
  }, []);

  return { messages, addMessage, chatPresets };
}
