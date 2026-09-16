// ============================================================
// RUSH RUNNING — Periodização de planos de treino
// ------------------------------------------------------------
// Estas duas funções eram privadas de routes/training.js, usadas só
// pela rota que gera um plano sob demanda. O seed precisava das
// mesmas 12 semanas, e copiar a periodização para lá criaria duas
// versões da mesma fisiologia, que divergiriam no primeiro ajuste.
//
// Então elas saíram da rota para cá sem nenhuma alteração de lógica:
// a rota continua gerando o plano do jeito que gerava, e o seed passa
// a gerar pelo mesmo caminho. O que o atleta de demonstração vê é,
// agora, exatamente o que o app produz para um atleta de verdade.
//
// São funções puras — não tocam no banco. Quem grava é quem chama.
// ============================================================

// ============================================================
// Templates de volume por distância e nível
// ============================================================

function getTrainingTemplates(distanceKm, level) {
  const baseDistances = {
    5: { easy: 4, long: 6, interval: 3, tempo: 4 },
    10: { easy: 6, long: 10, interval: 5, tempo: 6 },
    21: { easy: 8, long: 16, interval: 6, tempo: 8 },
    42: { easy: 10, long: 25, interval: 8, tempo: 10 },
  };

  const multipliers = {
    beginner: 0.7,
    intermediate: 1.0,
    advanced: 1.2,
  };

  const base = baseDistances[distanceKm] || baseDistances[10];
  const mult = multipliers[level] || 1.0;

  return {
    easy: +(base.easy * mult).toFixed(1),
    long: +(base.long * mult).toFixed(1),
    interval: +(base.interval * mult).toFixed(1),
    tempo: +(base.tempo * mult).toFixed(1),
  };
}

/**
 * Em que fase da periodização cai uma semana.
 *
 * Estava embutida em generateWeekSessions, onde só o gerador
 * enxergava. A tela do plano precisa da mesma resposta para
 * desenhar a régua das fases, e recalculá-la lá criaria uma
 * segunda fonte de verdade — que é como a FCmáx medida passou a
 * ser ignorada e como a semana da prescrição quase saiu trocada.
 *
 * As proporções são as que o gerador sempre usou: o primeiro
 * terço é base, até dois terços é build, o que vem depois é pico,
 * e as duas últimas semanas são o taper.
 *
 * @returns {'base'|'build'|'peak'|'taper'}
 */
function faseDaSemana(weekNumber, totalWeeks) {
  const total = Number(totalWeeks) || 1;
  const semana = Number(weekNumber) || 1;
  if (semana <= Math.round(total * 0.33)) return 'base';
  if (semana <= Math.round(total * 0.66)) return 'build';
  if (semana <= total - 2) return 'peak';
  return 'taper';
}

/**
 * Gera sessões semanais com periodização fisiológica e salvaguardas biomecânicas.
 * Baseado em modelos de periodização linear reversa e blocos (Daniels, Pfitzinger, Seiler).
 */
function generateWeekSessions(templates, weekNumber, totalWeeks, distanceKm, level) {
  // 4 Fases de Periodização
  const phase = faseDaSemana(weekNumber, totalWeeks);

  // Progressão de volume linear e suave (sem drops na transição Base -> Build)
  const baseFraction = Math.max(1, Math.round(totalWeeks * 0.33));
  const buildFraction = Math.max(1, Math.round(totalWeeks * 0.66) - baseFraction);

  const baseProgress = Math.min(1.0, weekNumber / baseFraction);
  const buildProgress = Math.min(1.0, Math.max(0, (weekNumber - baseFraction) / buildFraction));

  const volumeMultiplier = {
    base: 0.70 + baseProgress * 0.25,     // 0.70 -> 0.95
    build: 0.95 + buildProgress * 0.15,   // 0.95 -> 1.10
    peak: 1.10,                           // Sobrecarga de pico
    taper: 0.60,                          // Redução de volume de 40-50% no taper
  }[phase];

  const sessions = [];
  const weekDays = level === 'beginner' ? [2, 4, 6] : level === 'intermediate' ? [1, 3, 4, 6] : [1, 2, 3, 5, 6];
  const isPeakTestWeek = (phase === 'peak' && weekNumber === totalWeeks - 2);

  for (let i = 0; i < weekDays.length; i++) {
    const day = weekDays[i];
    let session;

    if (i === weekDays.length - 1) {
      // Última sessão da semana (Sábado, dia 6)
      if (isPeakTestWeek) {
        // Salvaguarda biomecânica: no final de semana de teste, o teste substitui o longão no Sábado
        const testDist = distanceKm <= 10 ? distanceKm : +(distanceKm / 2).toFixed(1);
        session = {
          day_of_week: day,
          type: 'test',
          distance_km: testDist,
          duration_min: Math.round(testDist * 5.0),
          target_hr_zone: 'Z4',
          description: `Simulado / Teste de Performance (${testDist}km) - TREINO FIXO`,
          is_fixed: true,
        };
      } else {
        session = {
          day_of_week: day,
          type: 'long_run',
          distance_km: +(templates.long * volumeMultiplier).toFixed(1),
          duration_min: Math.round(templates.long * volumeMultiplier * 6.5),
          target_hr_zone: 'Z2',
          description: `Longão ${phase === 'taper' ? '(taper)' : ''} - Manter ritmo confortável em Z2`,
          is_fixed: false,
        };
      }
    } else if (i === 1 && level !== 'beginner') {
      // Segunda sessão = Intervalado / Tempo run alternado
      if (isPeakTestWeek) {
        // Na semana de teste, faz polimento controlado (ritmo moderado Z3)
        session = {
          day_of_week: day,
          type: 'tempo',
          distance_km: +(templates.tempo * 0.8).toFixed(1),
          duration_min: Math.round(templates.tempo * 0.8 * 5.5),
          target_hr_zone: 'Z3',
          description: 'Polimento pré-teste: ritmo controlado em Z3 com baixo desgaste',
          is_fixed: false,
        };
      } else {
        const isInterval = weekNumber % 2 === 0;
        session = {
          day_of_week: day,
          type: isInterval ? 'interval' : 'tempo',
          distance_km: +(isInterval ? templates.interval : templates.tempo * volumeMultiplier).toFixed(1),
          duration_min: isInterval ? Math.round(templates.interval * 5) : Math.round(templates.tempo * volumeMultiplier * 5.5),
          target_hr_zone: isInterval ? 'Z4' : 'Z3',
          description: isInterval
            ? `Intervalado: ${Math.max(3, Math.round(templates.interval))}x1000m com recuperação`
            : `Tempo run em Z3 - Ritmo controlado`,
          is_fixed: false,
        };
      }
    } else {
      // Rodagem leve
      const easyMult = isPeakTestWeek ? volumeMultiplier * 0.85 : volumeMultiplier;
      session = {
        day_of_week: day,
        type: 'easy_run',
        distance_km: +(templates.easy * easyMult).toFixed(1),
        duration_min: Math.round(templates.easy * easyMult * 6),
        target_hr_zone: 'Z2',
        description: 'Rodagem leve em Z2 - Foco na base aeróbica',
        is_fixed: false,
      };
    }

    sessions.push(session);
  }

  // Na semana de teste do pico, prescrever trote regenerativo no Domingo pós-teste para remoção de lactato
  if (isPeakTestWeek) {
    sessions.push({
      day_of_week: 7,
      type: 'recovery',
      distance_km: 3.0,
      duration_min: 20,
      target_hr_zone: 'Z1',
      description: 'Trote regenerativo pós-teste em Z1 para recuperação ativa e eliminação de metabólitos',
      is_fixed: false,
    });
  }

  return sessions;
}

module.exports = { getTrainingTemplates, generateWeekSessions, faseDaSemana };
