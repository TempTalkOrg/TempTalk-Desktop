export async function initialize(options: {
  configDir: string;
  cleanupOrphanedAttachments: () => Promise<void>;
}): Promise<void>;
