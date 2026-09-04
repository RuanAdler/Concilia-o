import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdfjs-dist precisa ser carregado como dependência externa no runtime Node,
  // senão o bundler do Next tenta resolver o worker no browser.
  serverExternalPackages: ['pdfjs-dist'],
  // O rastreamento de arquivos da função serverless não segue o import()
  // dinâmico que o pdfjs-dist faz internamente para montar o "fake worker"
  // em Node — sem isso o pdf.worker.mjs fica de fora do deploy na Vercel.
  outputFileTracingIncludes: {
    '/api/importacao/processar': ['./node_modules/pdfjs-dist/legacy/build/*.mjs'],
  },
};

export default nextConfig;
