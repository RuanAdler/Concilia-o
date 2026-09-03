'use client';

import { useFormStatus } from 'react-dom';

export function BotaoSubmit({
  children,
  className = 'botao',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Salvando…' : children}
    </button>
  );
}
