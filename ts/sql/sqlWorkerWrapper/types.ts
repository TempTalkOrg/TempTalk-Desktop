import { ThreadWorkerType } from '../sqlTypes';
import { CallResult } from '../sqlWorkers/types';

export type WorkerData = {
  workerType: ThreadWorkerType;
};

export type WrappedCallResult = CallResult & { seqId: Number };
