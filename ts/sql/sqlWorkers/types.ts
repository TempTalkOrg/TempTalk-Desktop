import { LogLevel } from '../../logger/types';

export type RequestType = 'dbCall' | 'sqlCall';
export type ResponseType = 'log' | 'response';

// types of call request
export type CallRequest = Readonly<{
  type: RequestType;
  method: string;
  args: ReadonlyArray<any>;
}>;

export type WorkerRequest = CallRequest & Readonly<{ seqId: number }>;

// type of call result
export type CallResult = Readonly<{
  duration: number;
  result: any;
}>;

// types of log response
export type LogRepsonse = Readonly<{
  type: 'log';
  level: LogLevel;
  args: ReadonlyArray<any>;
}>;

export type CallResponse = Readonly<{
  type: 'response';
  seqId: number;
  error: string | undefined;
  result: CallResult;
}>;

export type WorkerResponse = LogRepsonse | CallResponse;
