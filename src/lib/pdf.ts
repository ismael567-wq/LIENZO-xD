export interface PdfPageImage {
  /** Bytes JPEG del render de la página. */
  jpeg: Uint8Array;
  /** Tamaño en píxeles del render. */
  width: number;
  height: number;
}

function latin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

/**
 * Escribe un PDF 1.4 mínimo con una imagen JPEG por página. Sin dependencias:
 * suficiente para «una página por marco» y para abrir en cualquier lector.
 */
export function buildPdfBlob(pages: PdfPageImage[]): Blob {
  const safePages = pages.length > 0 ? pages : [];
  const objectCount = safePages.length * 3 + 2;
  const offsets = new Array<number>(objectCount + 1).fill(0);
  const chunks: Uint8Array[] = [];
  let length = 0;

  const push = (data: string | Uint8Array): number => {
    const bytes = typeof data === 'string' ? latin1(data) : data;
    chunks.push(bytes);
    length += bytes.length;
    return length;
  };

  push('%PDF-1.4\n%âãÏÓ\n');

  const writeObject = (id: number, header: string, body?: Uint8Array, footer = ''): void => {
    offsets[id] = length;
    push(`${id} 0 obj\n${header}`);
    if (body) push(body);
    if (footer) push(footer);
    push('\nendobj\n');
  };

  writeObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = safePages.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
  writeObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${safePages.length} >>`);

  safePages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const pointWidth = Math.max(1, page.width * 0.75);
    const pointHeight = Math.max(1, page.height * 0.75);
    const content = `q\n${pointWidth.toFixed(2)} 0 0 ${pointHeight.toFixed(
      2,
    )} 0 0 cm\n/Im0 Do\nQ`;
    writeObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pointWidth.toFixed(
        2,
      )} ${pointHeight.toFixed(
        2,
      )}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    writeObject(
      contentId,
      `<< /Length ${latin1(content).length} >>\nstream\n${content}\nendstream`,
    );
    writeObject(
      imageId,
      `<< /Type /XObject /Subtype /Image /Width ${Math.max(
        1,
        Math.round(page.width),
      )} /Height ${Math.max(
        1,
        Math.round(page.height),
      )} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${
        page.jpeg.length
      } >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    );
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n`);
  push('0000000000 65535 f \n');
  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
