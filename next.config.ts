import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdfjs-dist precisa ser carregado como dependência externa no runtime Node,
  // senão o bundler do Next tenta resolver o worker no browser.
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
