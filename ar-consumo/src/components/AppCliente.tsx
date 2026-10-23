'use client';

import dynamic from 'next/dynamic';

// O app depende da hora e dos dados do próprio celular: desenhar no servidor só causaria diferenças de fuso na primeira pintura.
const App = dynamic(() => import('./App'), { ssr: false, loading: () => null });

export default App;
