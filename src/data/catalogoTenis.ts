// ============================================================
// RUSH RUNNING — Catálogo de modelos de corrida
// ------------------------------------------------------------
// O cadastro de um par era um formulário em branco: a pessoa
// digitava tudo, inclusive o uso e a vida útil. Este catálogo
// existe só para encurtar isso — escolheu o modelo, o resto vem
// preenchido e continua totalmente editável.
//
// DUAS HONESTIDADES SOBRE ESTA LISTA, e elas importam:
//
// 1. São FAMÍLIAS, não versões. "Nike Pegasus", não "Pegasus 41".
//    A numeração muda todo ano e cravar um número aqui envelheceria
//    a lista sem ninguém perceber — e, pior, poria no app um modelo
//    que talvez nunca tenha existido. Quem cadastra completa a
//    versão no campo de nome, que continua livre.
//
// 2. A vida útil NÃO é especificação de fabricante. É uma faixa
//    de referência por categoria de uso (VIDA_UTIL_POR_CATEGORIA),
//    não um número medido por modelo. Entra como ponto de partida
//    e a pessoa ajusta — quem sabe a durabilidade real do próprio
//    par é ela, não esta tabela.
//
// A placa de carbono, sim, é característica declarada e pública
// dos modelos de prova marcados com `placa: 'carbono'`.
// ============================================================

export type CategoriaTenis = 'rodagem' | 'estabilidade' | 'tempo' | 'prova' | 'trail';

export interface ModeloDeTenis {
  /** Marca + família, como a pessoa reconhece na caixa. */
  nome: string;
  categoria: CategoriaTenis;
  /** Só quando é característica declarada do modelo. */
  placa?: 'carbono';
}

/** Rótulo e vida útil de referência de cada categoria. */
export const CATEGORIAS: Record<CategoriaTenis, { rotulo: string; usoPrincipal: string; vidaUtilKm: number }> = {
  rodagem: {
    rotulo: 'Rodagem',
    usoPrincipal: 'Rodagem diária e longões',
    vidaUtilKm: 700,
  },
  estabilidade: {
    rotulo: 'Estabilidade',
    usoPrincipal: 'Rodagem com suporte de pisada',
    vidaUtilKm: 700,
  },
  tempo: {
    rotulo: 'Ritmo',
    usoPrincipal: 'Treinos de ritmo e intervalados',
    vidaUtilKm: 600,
  },
  prova: {
    rotulo: 'Prova',
    usoPrincipal: 'Provas e treinos-chave',
    // Espumas de competição perdem resposta bem antes de se
    // desmanchar. O número baixo é proposital — e ajustável.
    vidaUtilKm: 350,
  },
  trail: {
    rotulo: 'Trail',
    usoPrincipal: 'Trilha e terreno irregular',
    vidaUtilKm: 600,
  },
};

/**
 * Famílias conhecidas, agrupadas por marca. A lista não pretende
 * ser exaustiva: é um atalho para os casos mais comuns, e o campo
 * de nome segue aceitando qualquer coisa digitada à mão.
 */
export const CATALOGO_TENIS: ModeloDeTenis[] = [
  // ---------- Nike ----------
  { nome: 'Nike Pegasus', categoria: 'rodagem' },
  { nome: 'Nike Vomero', categoria: 'rodagem' },
  { nome: 'Nike Invincible', categoria: 'rodagem' },
  { nome: 'Nike Structure', categoria: 'estabilidade' },
  { nome: 'Nike Zoom Fly', categoria: 'tempo' },
  { nome: 'Nike Vaporfly', categoria: 'prova', placa: 'carbono' },
  { nome: 'Nike Alphafly', categoria: 'prova', placa: 'carbono' },
  { nome: 'Nike Pegasus Trail', categoria: 'trail' },

  // ---------- Adidas ----------
  { nome: 'Adidas Ultraboost', categoria: 'rodagem' },
  { nome: 'Adidas Supernova', categoria: 'rodagem' },
  { nome: 'Adidas Adizero Boston', categoria: 'tempo' },
  { nome: 'Adidas Adizero Adios', categoria: 'tempo' },
  { nome: 'Adidas Adizero Adios Pro', categoria: 'prova', placa: 'carbono' },
  { nome: 'Adidas Adizero Takumi Sen', categoria: 'prova', placa: 'carbono' },
  { nome: 'Adidas Terrex Agravic', categoria: 'trail' },

  // ---------- Asics ----------
  { nome: 'Asics Gel-Nimbus', categoria: 'rodagem' },
  { nome: 'Asics Gel-Cumulus', categoria: 'rodagem' },
  { nome: 'Asics Novablast', categoria: 'rodagem' },
  { nome: 'Asics Gel-Kayano', categoria: 'estabilidade' },
  { nome: 'Asics GT-2000', categoria: 'estabilidade' },
  { nome: 'Asics Magic Speed', categoria: 'tempo', placa: 'carbono' },
  { nome: 'Asics Metaspeed Sky', categoria: 'prova', placa: 'carbono' },
  { nome: 'Asics Metaspeed Edge', categoria: 'prova', placa: 'carbono' },
  { nome: 'Asics Gel-Trabuco', categoria: 'trail' },

  // ---------- Brooks ----------
  { nome: 'Brooks Ghost', categoria: 'rodagem' },
  { nome: 'Brooks Glycerin', categoria: 'rodagem' },
  { nome: 'Brooks Adrenaline GTS', categoria: 'estabilidade' },
  { nome: 'Brooks Hyperion', categoria: 'tempo' },
  { nome: 'Brooks Hyperion Elite', categoria: 'prova', placa: 'carbono' },
  { nome: 'Brooks Cascadia', categoria: 'trail' },

  // ---------- Hoka ----------
  { nome: 'Hoka Clifton', categoria: 'rodagem' },
  { nome: 'Hoka Bondi', categoria: 'rodagem' },
  { nome: 'Hoka Arahi', categoria: 'estabilidade' },
  { nome: 'Hoka Mach', categoria: 'tempo' },
  { nome: 'Hoka Rocket X', categoria: 'prova', placa: 'carbono' },
  { nome: 'Hoka Speedgoat', categoria: 'trail' },

  // ---------- Saucony ----------
  { nome: 'Saucony Ride', categoria: 'rodagem' },
  { nome: 'Saucony Triumph', categoria: 'rodagem' },
  { nome: 'Saucony Guide', categoria: 'estabilidade' },
  { nome: 'Saucony Kinvara', categoria: 'tempo' },
  { nome: 'Saucony Endorphin Speed', categoria: 'tempo' },
  { nome: 'Saucony Endorphin Pro', categoria: 'prova', placa: 'carbono' },
  { nome: 'Saucony Peregrine', categoria: 'trail' },

  // ---------- New Balance ----------
  { nome: 'New Balance Fresh Foam 1080', categoria: 'rodagem' },
  { nome: 'New Balance Fresh Foam 880', categoria: 'rodagem' },
  { nome: 'New Balance Fresh Foam 860', categoria: 'estabilidade' },
  { nome: 'New Balance FuelCell Rebel', categoria: 'tempo' },
  { nome: 'New Balance FuelCell SuperComp Elite', categoria: 'prova', placa: 'carbono' },
  { nome: 'New Balance Hierro', categoria: 'trail' },

  // ---------- Mizuno ----------
  { nome: 'Mizuno Wave Rider', categoria: 'rodagem' },
  { nome: 'Mizuno Wave Inspire', categoria: 'estabilidade' },
  { nome: 'Mizuno Wave Rebellion', categoria: 'tempo' },
  { nome: 'Mizuno Wave Daichi', categoria: 'trail' },

  // ---------- On ----------
  { nome: 'On Cloudmonster', categoria: 'rodagem' },
  { nome: 'On Cloudsurfer', categoria: 'rodagem' },
  { nome: 'On Cloudboom', categoria: 'prova', placa: 'carbono' },
  { nome: 'On Cloudultra', categoria: 'trail' },

  // ---------- Puma ----------
  { nome: 'Puma Velocity Nitro', categoria: 'rodagem' },
  { nome: 'Puma Deviate Nitro', categoria: 'tempo', placa: 'carbono' },
  { nome: 'Puma Deviate Nitro Elite', categoria: 'prova', placa: 'carbono' },

  // ---------- Altra ----------
  { nome: 'Altra Escalante', categoria: 'rodagem' },
  { nome: 'Altra Lone Peak', categoria: 'trail' },

  // ---------- Salomon ----------
  { nome: 'Salomon Speedcross', categoria: 'trail' },
  { nome: 'Salomon Sense Ride', categoria: 'trail' },

  // ---------- Marcas com forte presença no Brasil ----------
  { nome: 'Olympikus Corre', categoria: 'rodagem' },
  { nome: 'Olympikus Corre Elite', categoria: 'prova', placa: 'carbono' },
  { nome: 'Fila Racer', categoria: 'tempo' },
  { nome: 'Under Armour HOVR Machina', categoria: 'rodagem' },
];

/**
 * Busca por trecho do nome, ignorando acento e caixa.
 * Devolve no máximo `limite` sugestões para a lista não virar
 * uma parede de texto dentro da modal.
 */
export function buscarModelos(termo: string, limite = 6): ModeloDeTenis[] {
  const alvo = normalizar(termo);
  if (alvo.length < 2) return [];
  return CATALOGO_TENIS.filter((m) => normalizar(m.nome).includes(alvo)).slice(0, limite);
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
