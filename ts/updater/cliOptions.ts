import { createParser } from 'dashdash';

export function getCliOptions<T>(options: any): T {
  const parser = createParser({ options });
  const cliOptions = parser.parse(process.argv);

  if (cliOptions.help) {
    const help = parser.help().trimEnd();
    console.log(help);
    process.exit(0);
  }

  return cliOptions as unknown as T;
}
