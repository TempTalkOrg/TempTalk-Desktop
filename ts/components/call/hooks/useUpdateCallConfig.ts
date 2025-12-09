import { useEffect } from 'react';
import { currentCall } from '../initCall';

type UpdateCallConfigData = {
  roomId: string;
  updates: {
    key: string;
    value: any;
  }[];
};

interface UseUpdateCallConfigProps {
  onCriticalAlertUpdate: (value: boolean) => void;
}

export const useUpdateCallConfig = (props: UseUpdateCallConfigProps) => {
  const { onCriticalAlertUpdate } = props;
  useEffect(() => {
    const handler = (window as any).registerUpdateCallConfigHandler(
      (_: any, data: UpdateCallConfigData) => {
        const { roomId, updates } = data;
        if (roomId !== currentCall.roomId) {
          return;
        }
        for (const update of updates) {
          const { key, value } = update;
          switch (key) {
            case 'criticalAlert':
              onCriticalAlertUpdate(value);
              break;
            default:
              break;
          }
        }
      }
    );

    return () => {
      handler.remove();
    };
  }, []);
};
