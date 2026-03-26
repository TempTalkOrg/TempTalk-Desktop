import bs58 from 'bs58';
import { isNumber } from 'lodash';

export const base58Encode = (data: number | string) => {
  if (isNumber(data)) {
    const number = Number(data);
    const hex = number.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    const buffer = Buffer.from(paddedHex, 'hex');

    return bs58.encode(buffer);
  } else {
    const bytes = Buffer.from(data);
    const address = bs58.encode(bytes);

    return address;
  }
};
