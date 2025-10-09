import { base58Encode } from './base58';

export const getBase58Id = (number: string) => {
  const idNumber = Number(number.replace('+', ''));
  return base58Encode(idNumber);
};
