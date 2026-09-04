import type { FragmentoPdf } from '@/lib/parsers/pdf-texto';

/**
 * Gera um PDF válido mínimo com textos em posições dadas.
 * Serve para exercitar a extração posicional real (pdfjs) nos testes, sem
 * depender de um extrato de verdade no repositório.
 */
export function montarPdfPosicionado(itens: Array<Pick<FragmentoPdf, 'texto' | 'x' | 'y'>>): Uint8Array {
  const comandos = itens
    .map((item) => {
      const escapado = item.texto.replace(/([\\()])/g, '\\$1');
      return `BT /F1 9 Tf ${item.x.toFixed(2)} ${item.y.toFixed(2)} Td (${escapado}) Tj ET`;
    })
    .join('\n');

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${comandos.length} >>\nstream\n${comandos}\nendstream`,
  ];

  let corpo = '%PDF-1.4\n';
  const deslocamentos: number[] = [];

  objetos.forEach((objeto, indice) => {
    deslocamentos.push(corpo.length);
    corpo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const inicioXref = corpo.length;
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const deslocamento of deslocamentos) {
    corpo += `${String(deslocamento).padStart(10, '0')} 00000 n \n`;
  }
  corpo +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(corpo, 'latin1'));
}
