export function Mensagem({ erro, sucesso }: { erro?: string | null; sucesso?: string | null }) {
  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (sucesso) return <p className="text-sm text-emerald-700">{sucesso}</p>;
  return null;
}
