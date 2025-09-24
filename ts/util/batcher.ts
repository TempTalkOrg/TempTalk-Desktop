import PQueue from 'p-queue';

import { sleep } from './sleep';
import * as Errors from '../types/errors';

declare global {
  interface Window {
    batchers: Array<BatcherType<any>>;
    waitForAllBatchers: () => Promise<unknown>;
  }
}

window.batchers = [];

window.waitForAllBatchers = async () => {
  (window as any).log.info('batcher#waitForAllBatchers');
  try {
    await Promise.all(window.batchers.map(item => item.flushAndWait()));
  } catch (error) {
    (window as any).log.error(
      'batcher#waitForAllBatchers: error flushing all',
      Errors.toLogFormat(error)
    );
  }
};

export type BatcherOptionsType<ItemType> = {
  name: string;
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => void | Promise<void>;
};

export type BatcherType<ItemType> = {
  add: (item: ItemType) => void;
  removeAll: (needle: ItemType) => void;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  flushAndWait: () => Promise<void>;
  unregister: () => void;
  pause: () => void;
  resume: () => void;
};

export function createBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let batcher: BatcherType<ItemType>;
  let timeout: NodeJS.Timeout | null;
  let items: Array<ItemType> = [];
  const queue = new PQueue({
    concurrency: 1,
    timeout: 1000 * 60 * 2,
    throwOnTimeout: true,
  });

  function _kickBatchOff() {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = null;

    const itemsRef = items;
    items = [];
    queue.add(async () => {
      await options.processBatch(itemsRef);
    });
  }

  function add(item: ItemType) {
    items.push(item);

    if (items.length === 1) {
      // Set timeout once when we just pushed the first item so that the wait
      // time is bounded by `options.wait` and not extended by further pushes.
      timeout = setTimeout(_kickBatchOff, options.wait);
    } else if (items.length >= options.maxSize) {
      _kickBatchOff();
    }
  }

  function removeAll(needle: ItemType) {
    items = items.filter(item => item !== needle);
  }

  function anyPending(): boolean {
    return queue.size > 0 || queue.pending > 0 || items.length > 0;
  }

  async function onIdle() {
    while (anyPending()) {
      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }

      if (items.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(options.wait * 2);
      }
    }
  }

  function unregister() {
    window.batchers = window.batchers.filter(item => item !== batcher);
  }

  async function flushAndWait() {
    (window as any).log.info(
      `batcher#Flushing ${options.name} batcher items.length=${items.length}`
    );

    if (queue.isPaused) {
      queue.start();
    }

    while (anyPending()) {
      _kickBatchOff();

      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }
    }
    (window as any).log.info(`batcher#Flushing complete ${options.name}`);
  }

  function pause() {
    if (!queue.isPaused) {
      queue.pause();
    }
  }

  function resume() {
    if (queue.isPaused) {
      queue.start();
    }
  }

  batcher = {
    add,
    removeAll,
    anyPending,
    onIdle,
    flushAndWait,
    unregister,
    pause,
    resume,
  };

  window.batchers.push(batcher);

  return batcher;
}
