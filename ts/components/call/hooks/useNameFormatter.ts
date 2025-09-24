import { useCallback } from 'react';

export const useNameFormatter = (contactMap: any) => {
  const nameFormatter = useCallback(
    (participant: any) => {
      if (!contactMap.size) return '';
      const key = participant.identity.split('.')[0];
      const target = contactMap.get(key);
      return target?.getDisplayName();
    },
    [contactMap]
  );

  return {
    nameFormatter,
  };
};
