export function isFileRegular(extension: string): string {
  extension = extension.toLowerCase();
  let ext = '';
  if (
    extension === 'zip' ||
    extension === '7z' ||
    extension === 'rar' ||
    extension === 'bz' ||
    extension === 'tar' ||
    extension === 'gz' ||
    extension === 'gzip' ||
    extension === 'bzip2'
  ) {
    ext = 'zip';
  }
  if (extension === 'doc' || extension === 'docx') {
    ext = 'word';
  }
  if (extension === 'xlsx' || extension === 'xls') {
    ext = 'xlsx';
  }
  if (
    extension === 'ppt' ||
    extension === 'pptx' ||
    extension === 'pps' ||
    extension === 'ppsx'
  ) {
    ext = 'ppt';
  }
  if (extension === 'pdf') {
    ext = 'pdf';
  }
  if (extension === 'key') {
    ext = 'keynote';
  }
  if (extension === 'numbers') {
    ext = 'numbers';
  }
  if (extension === 'pages') {
    ext = 'pages';
  }
  return ext;
}
