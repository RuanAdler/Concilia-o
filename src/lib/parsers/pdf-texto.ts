/**
 * Extração de texto posicional de um PDF.
 *
 * O extrato do BB não tem estrutura semântica: o que existe são fragmentos de
 * texto com coordenadas. Reagrupamos por linha (mesmo Y) e ordenamos por X para
 * reconstruir as linhas visuais do extrato, que é o que o parser consome.
 */

const TOLERANCIA_LINHA = 2.5; // pontos de diferença em Y ainda contam como mesma linha
const ESPACO_MINIMO = 1.2; // separação em X que já indica um espaço entre fragmentos

interface Fragmento {
  texto: string;
  x: number;
  y: number;
  largura: number;
}

export async function extrairLinhasDoPdf(dados: Uint8Array): Promise<string[]> {
  // Import dinâmico: o build legacy é o único que roda no runtime Node sem worker.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const documento = await pdfjs.getDocument({
    data: dados,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const linhas: string[] = [];

  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina);
    const conteudo = await pagina.getTextContent();

    const fragmentos: Fragmento[] = [];
    for (const item of conteudo.items) {
      if (!('str' in item) || typeof item.str !== 'string') continue;
      if (item.str.trim() === '') continue;
      const transform = item.transform as number[];
      fragmentos.push({
        texto: item.str,
        x: transform[4],
        y: transform[5],
        largura: typeof item.width === 'number' ? item.width : 0,
      });
    }

    for (const linha of agruparEmLinhas(fragmentos)) linhas.push(linha);

    pagina.cleanup();
  }

  await documento.destroy();
  return linhas;
}

function agruparEmLinhas(fragmentos: Fragmento[]): string[] {
  // Y cresce de baixo para cima no PDF, então a ordem de leitura é Y decrescente.
  const ordenados = [...fragmentos].sort((a, b) => b.y - a.y || a.x - b.x);

  const grupos: Fragmento[][] = [];
  for (const fragmento of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && Math.abs(ultimo[0].y - fragmento.y) <= TOLERANCIA_LINHA) {
      ultimo.push(fragmento);
    } else {
      grupos.push([fragmento]);
    }
  }

  return grupos.map((grupo) => {
    const emOrdem = grupo.sort((a, b) => a.x - b.x);
    let texto = '';
    let fimAnterior: number | null = null;

    for (const fragmento of emOrdem) {
      if (fimAnterior !== null && fragmento.x - fimAnterior > ESPACO_MINIMO) texto += ' ';
      texto += fragmento.texto;
      fimAnterior = fragmento.x + fragmento.largura;
    }

    return texto.replace(/\s+/g, ' ').trim();
  }).filter((linha) => linha.length > 0);
}
