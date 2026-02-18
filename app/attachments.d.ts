export async function getAllAttachments(
  userDataPath: string
): Promise<string[]>;

export async function deleteAll({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: string[];
}): Promise<void>;
