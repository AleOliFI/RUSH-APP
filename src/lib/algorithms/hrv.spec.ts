import {
  RR_ARTEFACT_THRESHOLD,
  RR_MAX_ARTEFACT_RATE,
  calculateBaselines,
  calculateEWB,
  calculateRMSSD,
  calculateSDNN,
  calculateSFCR,
  calculateSVFC,
  filterRRArtefacts,
} from './hrv';
import type { HRVReading } from '../../types/hrv';

/** Série estável alternando ±spread em torno de 900 ms. */
function cleanSeries(count = 60, base = 900, spread = 20): number[] {
  return Array.from({ length: count }, (_, i) => base + (i % 2 === 0 ? spread : -spread));
}

describe('filterRRArtefacts', () => {
  it('não descarta nada numa série estável', () => {
    const result = filterRRArtefacts(cleanSeries());
    expect(result.accepted).toHaveLength(60);
    expect(result.artefactRate).toBe(0);
  });

  it('lida com série vazia', () => {
    expect(filterRRArtefacts([])).toEqual({ accepted: [], artefactRate: 0 });
  });

  it('mantém o primeiro intervalo, que não tem anterior para comparar', () => {
    expect(filterRRArtefacts([900]).accepted).toEqual([900]);
  });

  it('descarta o batimento ectópico', () => {
    // 450 é metade do anterior — desvio de 50%, muito acima do limiar.
    expect(filterRRArtefacts([900, 890, 450, 895]).accepted).toEqual([900, 890, 895]);
  });

  it('aceita variação dentro do limiar', () => {
    const dentro = 900 * (1 + RR_ARTEFACT_THRESHOLD * 0.9);
    expect(filterRRArtefacts([900, dentro]).accepted).toHaveLength(2);
  });

  it('reporta a fração descartada', () => {
    // 4 intervalos, 1 descartado.
    expect(filterRRArtefacts([900, 890, 450, 895]).artefactRate).toBeCloseTo(0.25, 10);
  });

  /**
   * Este é o teste que existe por causa de uma regressão real: a filtragem foi
   * removida junto com o pipeline da câmera e sobrou só a faixa de plausibilidade
   * de 300–2000 ms. Um batimento perdido de 1850 ms cabe nessa faixa.
   */
  it('impede que um batimento perdido infle o RMSSD', () => {
    const limpa = cleanSeries();
    const referencia = calculateRMSSD(limpa);

    const comFalha = [...limpa];
    comFalha[30] = 1850;

    // 1850 ms é fisiologicamente plausível (32 bpm) — a faixa sozinha não pega.
    expect(1850).toBeGreaterThanOrEqual(300);
    expect(1850).toBeLessThanOrEqual(2000);

    const semFiltro = calculateRMSSD(comFalha);
    const comFiltro = calculateRMSSD(filterRRArtefacts(comFalha).accepted);

    // Sem filtro o valor mais que quadruplica; com filtro volta à referência.
    expect(semFiltro).toBeGreaterThan(referencia * 4);
    expect(comFiltro).toBeCloseTo(referencia, 0);
  });

  it('marca como inaceitável a série majoritariamente ruidosa', () => {
    const ruidosa = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? 1700 : 900));
    expect(filterRRArtefacts(ruidosa).artefactRate).toBeGreaterThan(RR_MAX_ARTEFACT_RATE);
  });
});

describe('calculateRMSSD', () => {
  it('é zero com menos de dois intervalos', () => {
    expect(calculateRMSSD([])).toBe(0);
    expect(calculateRMSSD([900])).toBe(0);
  });

  it('é zero numa série constante — sem variabilidade', () => {
    expect(calculateRMSSD([900, 900, 900])).toBe(0);
  });

  it('calcula o valor conhecido de uma série pequena', () => {
    // diffs ±100 → quadrados 10000 → média 10000 → raiz 100
    expect(calculateRMSSD([800, 900, 800, 900])).toBeCloseTo(100, 6);
  });

  it('não depende da ordem de grandeza absoluta, só das diferenças', () => {
    expect(calculateRMSSD([500, 600, 500])).toBeCloseTo(calculateRMSSD([1000, 1100, 1000]), 6);
  });
});

describe('calculateSDNN', () => {
  it('é zero com menos de dois intervalos', () => {
    expect(calculateSDNN([900])).toBe(0);
  });

  it('mede dispersão em torno da média, não entre sucessivos', () => {
    // Mesma dispersão, ordens diferentes: SDNN igual, RMSSD diferente.
    const a = [800, 800, 1000, 1000];
    const b = [800, 1000, 800, 1000];
    expect(calculateSDNN(a)).toBeCloseTo(calculateSDNN(b), 6);
    expect(calculateRMSSD(a)).not.toBeCloseTo(calculateRMSSD(b), 1);
  });
});

describe('calculateSVFC', () => {
  it('devolve 0 para valor não positivo', () => {
    expect(calculateSVFC(0)).toBe(0);
    expect(calculateSVFC(-5)).toBe(0);
  });

  it('satura nos extremos do envelope', () => {
    expect(calculateSVFC(5)).toBeCloseTo(0, 6);
    expect(calculateSVFC(250)).toBeCloseTo(100, 6);
    expect(calculateSVFC(1000)).toBe(100);
  });

  it('é monotônico crescente', () => {
    expect(calculateSVFC(20)).toBeLessThan(calculateSVFC(40));
    expect(calculateSVFC(40)).toBeLessThan(calculateSVFC(80));
  });
});

describe('calculateSFCR', () => {
  it('dá nota cheia sem baseline', () => {
    expect(calculateSFCR(60, 0)).toBe(100);
  });

  it('dá nota cheia com FC igual ou abaixo da baseline', () => {
    expect(calculateSFCR(50, 50)).toBe(100);
    expect(calculateSFCR(45, 50)).toBe(100);
  });

  it('decai 10 pontos por bpm acima da baseline', () => {
    expect(calculateSFCR(53, 50)).toBe(70);
  });

  it('zera a partir de 10 bpm acima', () => {
    expect(calculateSFCR(60, 50)).toBe(0);
    expect(calculateSFCR(75, 50)).toBe(0);
  });
});

describe('calculateEWB', () => {
  it('devolve 100 no melhor cenário possível', () => {
    // sono 5, e estresse/fadiga/dor no mínimo.
    expect(calculateEWB(5, 1, 1, 1)).toBeCloseTo(100, 6);
  });

  it('devolve 0 no pior cenário possível', () => {
    expect(calculateEWB(1, 5, 5, 5)).toBeCloseTo(0, 6);
  });

  it('trata sono como positivo e os demais como negativos', () => {
    expect(calculateEWB(5, 3, 3, 3)).toBeGreaterThan(calculateEWB(1, 3, 3, 3));
    expect(calculateEWB(3, 1, 3, 3)).toBeGreaterThan(calculateEWB(3, 5, 3, 3));
  });
});

describe('calculateBaselines', () => {
  function reading(rmssd: number, metric: 'rmssd' | 'sdnn', daysAgo = 1): HRVReading {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return {
      measured_at: d.toISOString(),
      rmssd,
      hrv_metric: metric,
      rhr: 50,
    } as HRVReading;
  }

  /**
   * RMSSD e SDNN medem componentes diferentes da variabilidade: 40 ms de um não
   * significa o mesmo que 40 ms do outro. Misturá-los na mesma baseline desloca
   * µ28/σ28, que são exatamente os valores contra os quais o status é medido.
   */
  it('ignora leituras de outra métrica', () => {
    const leituras = [
      reading(40, 'rmssd', 1),
      reading(42, 'rmssd', 2),
      reading(200, 'sdnn', 3), // não pode entrar na média de RMSSD
    ];

    expect(calculateBaselines(leituras, 'rmssd').mu7).toBeCloseTo(41, 6);
    expect(calculateBaselines(leituras, 'sdnn').mu7).toBeCloseTo(200, 6);
  });

  it('trata leitura sem métrica declarada como rmssd', () => {
    const semMetrica = { measured_at: new Date().toISOString(), rmssd: 44, rhr: 50 } as HRVReading;
    expect(calculateBaselines([semMetrica], 'rmssd').mu7).toBeCloseTo(44, 6);
  });

  it('devolve zeros quando não há leitura da métrica pedida', () => {
    const baselines = calculateBaselines([reading(40, 'rmssd')], 'sdnn');
    expect(baselines.mu7).toBe(0);
    expect(baselines.mu28).toBe(0);
    expect(baselines.sigma28).toBe(0);
  });
});
