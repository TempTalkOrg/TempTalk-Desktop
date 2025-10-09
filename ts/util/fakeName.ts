import { getBase58Id } from './base58Id';

export const getFakeName = (number: string) => {
  return `TT-${getBase58Id(number)}`;
};
