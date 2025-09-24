import type { AfterPackContext } from 'electron-builder';
import { afterSign as notarize } from './notarize-app';
import { formatError } from '../logger/utils';

export async function afterSign(context: AfterPackContext): Promise<void> {
  // notarize app after signed
  try {
    await notarize(context);
  } catch (error) {
    console.log('skipped macOS notarization reason=', formatError(error));
  }
}
