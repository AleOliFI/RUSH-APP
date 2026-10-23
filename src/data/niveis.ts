// ============================================================
// RUSH RUNNING — Níveis de treino
// ------------------------------------------------------------
// O banco guarda 'beginner' | 'intermediate' | 'advanced', que são
// os valores aceitos pelas rotas. A tela mostra o rótulo em
// português — e mostrava em três listas separadas, mais duas telas
// que não traduziam nada e imprimiam "beginner" na cara do usuário
// (ficha do atleta e plano completo).
//
// A lista mora aqui para não divergir: acrescentar um nível em um
// lugar e esquecer dos outros é o tipo de erro que só aparece
// depois, na tela de alguém.
// ============================================================

export type NivelDeTreino = 'beginner' | 'intermediate' | 'advanced';

export const NIVEIS_DE_TREINO: ReadonlyArray<{ valor: NivelDeTreino; rotulo: string }> = [
  { valor: 'beginner', rotulo: 'Iniciante' },
  { valor: 'intermediate', rotulo: 'Intermediário' },
  { valor: 'advanced', rotulo: 'Avançado' },
];

const POR_VALOR: Record<string, string> = Object.fromEntries(
  NIVEIS_DE_TREINO.map(({ valor, rotulo }) => [valor, rotulo]),
);

/**
 * Rótulo em português de um nível.
 *
 * Um valor desconhecido volta como veio, em vez de virar string
 * vazia: é melhor a tela mostrar algo estranho do que esconder que
 * o banco tem um valor que o app não conhece.
 */
export function rotuloDoNivel(nivel: string | null | undefined): string {
  if (!nivel) return '';
  return POR_VALOR[nivel] || nivel;
}
