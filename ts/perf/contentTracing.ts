import { app, contentTracing, shell } from 'electron';
import { createWriteStream } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { createGzip } from 'zlib';
import { createCipheriv, randomBytes, publicEncrypt } from 'crypto';
import path from 'path';
import os from 'os';
import tar from 'tar';

// @ts-ignore
import * as packageJson from '../../package.json';
import mkdirp from 'mkdirp';
import { pipeline } from 'stream/promises';

let isRecording = false;

const pubKey = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA1e3qM2XtcCNM7FmdUNAatQdpvJ0IUxh/4j7qVK90bkM/5XxyDD89
MN2QnGhxCgDdfQFnjYiNhegMyFBEjQkfkZ4UGTl+obZaScvE+g7MBLODXrxrsrtP
pWXKZ1Lhahg8CbkM3l4i439/BwcX40vdeq+ZX5G3x2WZaFsaBY5gzGwNEne7FtUO
ZDkh1CShWD8W9FfqghHURCtfipAe+7t+op7WbZ6azhkFGo40DvOAGOxzSB5qYba1
PdE3VB+FsEDVclzSplcQbuRpJvHMyX5NQObfiZO1RoAWITxJ4wzwZqcY105NJZRi
5v08nerN0oXQlGG578/YpF9QC0uUcDMJDwIDAQAB
-----END RSA PUBLIC KEY-----
`;

async function doRecordTracing() {
  await contentTracing.startRecording({
    recording_mode: 'record-until-full',
    included_categories: [
      'cc',
      'benchmark',
      'blink',
      'blink.console',
      'blink.user_timing',
      'devtools.timeline',
      'disabled-by-default-cpu_profiler',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline.stack',
      'disabled-by-default-memory-infra',
      'disabled-by-default-system_stats',
      'disabled-by-default-v8.cpu_profiler',
      'disabled-by-default-v8.cpu_profiler.hires',
      'disabled-by-default-v8.stack_trace',
      'electron',
      'latencyInfo',
      'memory',
      'mojom',
      'net',
      'raf_investigation',
      'rail',
      'renderer',
      'renderer.scheduler',
      'resources',
      'scheduler',
      'scheduler.long_tasks',
      'toplevel',
      'toplevel.flow',
      'ui',
      'v8',
      'v8.execute',
      'views',
      'views.frame',
    ],
    excluded_categories: ['*'],
    memory_dump_config: {
      triggers: [
        { mode: 'light', periodic_interval_ms: 2000 },
        { mode: 'detailed', periodic_interval_ms: 5000 },
      ],
    },
  });

  await new Promise(r => setTimeout(r, 15000));

  return await contentTracing.stopRecording();
}

export async function recordContentTracing() {
  if (!app.isReady()) {
    console.log('app is not ready.');
    return;
  }

  if (isRecording) {
    console.log(
      'Another recording is already running, only one trace operation can be in progress at a time.'
    );
    return;
  }

  console.log('recording start.');

  isRecording = true;

  const matricArray = [];
  //gather matrics before tracing
  matricArray.push(gatherMatrics());

  const traceFilePath = await doRecordTracing();

  //gather matrics after tracing
  matricArray.push(gatherMatrics());

  isRecording = false;

  const basePath = app.getPath('userData');
  const tlogsPath = path.join(basePath, 'tlogs');
  await mkdirp(tlogsPath);

  const filename = `${packageJson.productName}-${Date.now()}`;
  const tlogFile = path.join(tlogsPath, `${filename}.tlog`);

  try {
    const matricsFile = `${traceFilePath}.mtrc`;
    await writeFile(matricsFile, JSON.stringify(matricArray));

    const gzip = createGzip();
    const destination = createWriteStream(tlogFile);

    const algorithm = 'aes-256-ctr';
    const secretKey = randomBytes(32);
    const iv = randomBytes(16);

    const encrypt = createCipheriv(algorithm, secretKey, iv);
    const secret = publicEncrypt(pubKey, secretKey);

    destination.write(iv);
    destination.write(secret);

    const pack = tar.c(
      {
        gzip: false,
        cwd: path.dirname(traceFilePath),
      },
      [path.basename(traceFilePath), path.basename(matricsFile)]
    );

    await pipeline(pack, gzip, encrypt, destination);

    // remove tempfile
    await unlink(traceFilePath);
    await unlink(matricsFile);

    shell.openPath(tlogsPath);
  } catch (error) {
    console.log('recording write failed.', error);
  }

  console.log('recording finish.', tlogFile);
}

function gatherMatrics() {
  return {
    osCpus: os.cpus(),
    sysMem: process.getSystemMemoryInfo(),
    loadavg: os.loadavg(),
    appMatrics: app.getAppMetrics(),
  };
}
