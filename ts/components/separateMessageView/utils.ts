function detectFontFamily() {
  const div = document.createElement('div');
  div.style.display = 'none';
  document.body.appendChild(div);
  const fontFamily = getComputedStyle(div).fontFamily;
  document.body.removeChild(div);
  return fontFamily;
}

export function splitTextToRows(
  text: string,
  maxWidth: number,
  font: string
): string[] {
  if (!text) {
    return [''];
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return [text];
  }
  const fontFamily = detectFontFamily();
  ctx.font = `${font} ${fontFamily}`;

  const rows: string[] = [];

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const currentLineSegment = lines[i];

    if (currentLineSegment.length === 0) {
      rows.push('');
      continue;
    }

    let currentRowText = '';
    let currentLineWidth = 0;

    for (let j = 0; j < currentLineSegment.length; j++) {
      const char = currentLineSegment[j];
      const charWidth = ctx.measureText(char).width;

      if (currentLineWidth + charWidth > maxWidth) {
        if (currentRowText.length > 0) {
          rows.push(currentRowText);
          currentRowText = '';
          currentLineWidth = 0;
        }
      }

      currentRowText += char;
      currentLineWidth += charWidth;
    }

    if (currentRowText.length > 0) {
      rows.push(currentRowText);
    }
  }
  return rows;
}
