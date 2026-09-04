/**
 * Extração de texto posicional de um PDF.
 *
 * O extrato do BB não tem estrutura semântica: são fragmentos de texto com
 * coordenadas. Devolvemos os fragmentos com posição para que o parser possa
 * raciocinar por COLUNA — reconstruir "linhas visuais" perde a informação de
 * qual coluna cada pedaço ocupa, que é justamente o que identifica o histórico.
 */

export interface FragmentoPdf {
  texto: string;
  x: number;
  y: number;
  largura: number;
}

const TOLERANCIA_LINHA = 2.5;
const ESPACO_MINIMO = 1.2;

/** Fragmentos posicionados, agrupados por página (o Y reinicia a cada página). */
export async function extrairPaginasDoPdf(dados: Uint8Array): Promise<FragmentoPdf[][]> {
  // Import dinâmico: o build legacy é o único que roda no runtime Node sem worker.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const documento = await pdfjs.getDocument({
    data: dados,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const paginas: FragmentoPdf[][] = [];

  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina);
    const conteudo = await pagina.getTextContent();

    const fragmentos: FragmentoPdf[] = [];
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

    paginas.push(fragmentos);
    pagina.cleanup();
  }

  await documento.destroy();
  return paginas;
}

/**
 * Linhas visuais do documento. Usada só no diagnóstico da tela de importação,
 * quando o parser não reconhece nada e o usuário precisa ver o que foi lido.
 */
export async function extrairLinhasDoPdf(dados: Uint8Array): Promise<string[]> {
  const paginas = await extrairPaginasDoPdf(dados);
  return paginas.flatMap((fragmentos) => agruparEmLinhas(fragmentos));
}

/** Junta fragmentos com o mesmo Y, na ordem de leitura, inserindo espaços por lacuna. */
export function agruparEmLinhas(fragmentos: FragmentoPdf[]): string[] {
  // Y cresce de baixo para cima no PDF, então a ordem de leitura é Y decrescente.
  const ordenados = [...fragmentos].sort((a, b) => b.y - a.y || a.x - b.x);

  const grupos: FragmentoPdf[][] = [];
  for (const fragmento of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && Math.abs(ultimo[0].y - fragmento.y) <= TOLERANCIA_LINHA) {
      ultimo.push(fragmento);
    } else {
      grupos.push([fragmento]);
    }
  }

  return grupos.map((grupo) => juntarFragmentos(grupo)).filter((linha) => linha.length > 0);
}

/** Concatena fragmentos por X, colocando espaço onde há lacuna visual. */
export function juntarFragmentos(fragmentos: FragmentoPdf[]): string {
  const emOrdem = [...fragmentos].sort((a, b) => a.x - b.x);

  let texto = '';
  let fimAnterior: number | null = null;

  for (const fragmento of emOrdem) {
    if (fimAnterior !== null && fragmento.x - fimAnterior > ESPACO_MINIMO) texto += ' ';
    texto += fragmento.texto;
    fimAnterior = fragmento.x + fragmento.largura;
  }

  return texto.replace(/\s+/g, ' ').trim();
}
