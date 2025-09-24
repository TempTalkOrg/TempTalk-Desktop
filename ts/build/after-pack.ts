import type { AfterPackContext } from 'electron-builder';
import { afterPack as flipFuses } from './flip-fuses';

export async function afterPack(context: AfterPackContext): Promise<void> {
  if (process.env.SKIP_SECURITY_OPTIONS === 'true') {
    console.log('* skipped security options ...');
    return;
  }

  await flipFuses(context);
}
