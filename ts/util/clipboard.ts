export const tryGetAttachmentsFromHtml = async (
  itemsArray: DataTransferItem[]
) => {
  const parseHTML = (html: string) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
  };

  try {
    const attachments: File[] = [];
    for (const item of itemsArray) {
      if (item.type === 'text/html') {
        // Use getAsString to get the HTML content
        const htmlContent = await new Promise<string>(resolve => {
          item.getAsString(resolve);
        });

        const doc = parseHTML(htmlContent);
        const imgTags: HTMLImageElement[] = Array.from(
          doc.content.querySelectorAll('img')
        );

        for (const imgTag of imgTags) {
          const imgUrl = imgTag.getAttribute('src');
          if (imgUrl) {
            const blob = await fetch(imgUrl).then(res => res.blob());
            const mimeType = blob.type || 'image/png';
            const extension = mimeType.split('/')[1] || 'png';
            const fileName = `image.${extension}`;
            const file = new File([blob], fileName, { type: mimeType });
            attachments.push(file);
          }
        }
      }
    }
    return attachments;
  } catch (error) {
    console.log('Error getting attachments from HTML:', error);
    return [];
  }
};
