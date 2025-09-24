// worker file
// must be called run as a worker thread

import { parentPort, workerData } from 'worker_threads';
import { ThreadWorkerType } from './sqlTypes';

if (!parentPort) {
  throw new Error('Must run sql worker as a worker thread');
}

import { WorkerDatabase } from './sqlWorkers/workerDatabase';
import { WorkerAccelerator } from './sqlWorkers/workerAccelerator';

const { workerType }: { workerType: ThreadWorkerType } = workerData;
switch (workerType) {
  case 'sql_worker_main':
    new WorkerDatabase();
    break;
  case 'sql_worker_acc':
    new WorkerAccelerator();
    break;
  default:
    throw new Error(`unknown thread worker type ${workerType}`);
}
