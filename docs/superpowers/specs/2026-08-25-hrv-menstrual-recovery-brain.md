# RUSH App — Cérebro Científico do Agente: VFC + Ciclo Menstrual + Recuperação

**Data:** 2026-08-25
**Status:** Aprovação Pendente
**Versão:** 1.0

---

## Objetivo

Reescrever e expandir o cérebro do agente de prescrição de treinos do RUSH App com base em evidências científicas pesquisadas (2007–2025), incorporando três novos subsistemas:

1. **VFC Avançada** — Baseline de 28 dias, correlação RHR, detecção de saturação parassimpática, contador de dias consecutivos em recuperação.
2. **Ciclo Menstrual** — Baselines de VFC específicos por fase, ajuste de prescrição por fase, rastreamento de sintomas para usuárias femininas.
3. **Protocolo de Recuperação Escalonado** — Resposta escalonada a 1, 2, 3+ dias de VFC baixa; alerta de overtraining; indicações de crioterapia corretas.

---

## Fontes Científicas

| Referência | Aplicação no Algoritmo |
|---|---|
| Plews et al. (2012, 2013, 2014) | Baseline 7d rolling, SWC = 0.5 × SD |
| Buchheit (2014) | RHR como co-variável obrigatória, overreaching detection |
| Kiviniemi et al. (2007) | HRV-guided training supera fixed training em VO2peak |
| Carrasco-Poyatos (2022) | VFC-guided maximiza adaptações sem quebrar atleta |
| Mujika & Padilla (2000, 2003) | Taper: 40-60% volume, 100% intensidade, ≤20% freq. |
| Hooper & Mackinnon (1995) | Wellness Likert 1–5 (sono, fadiga, dor, estresse) |
| Seiler (2010) | Modelo polarizado 80/20 Z1-Z2 / Z4-Z5 |
| McNulty et al. (2020) | Variação de VFC por fase do ciclo menstrual |
| Ansdell et al. (2021) | Periodização baseada no ciclo menstrual |

---

## Subsistema 1 — VFC Avançada

### Mudanças em relação ao código atual

| Atual | Novo (baseado na pesquisa) |
|---|---|
| Baseline de 7 dias para SWC | **Baseline de 28 dias** para SWC (Plews et al., Buchheit 2014) |
| Apenas lnRMSSD | **lnRMSSD + RHR (FC de repouso)** como inputs obrigatórios |
| Sem detecção de saturação por RHR | **Saturação parassimpática** detectada por lnRMSSD↓ com RHR↓ + wellness ok |
| 1 limiar de recovery (-1.5 SD) | **Escalamento por dias consecutivos** de VFC baixa |
| Banho de gelo sempre recomendado | **Banho de gelo só em fase de competição** (inibe adaptações em base/build) |

### Novo algoritmo de classificação

```
Inputs diários:
  - rmssd_ms (medição matinal)  → calcular lnRMSSD
  - rhr_bpm (FC de repouso)
  - wellness: {sleep, fatigue, soreness, stress, readiness} (Hooper 1-5)

Processamento:
  1. Calcular lnRMSSD = ln(rmssd_ms)
  2. Buscar histórico de 28 dias → calcular Mean28 e SD28 para lnRMSSD e RHR
  3. SWC = max(0.5 × SD28, 0.05)  ← salvaguarda mínima
  4. Calcular 7d rolling average (lnRMSSD7d e RHR7d)
  5. Normal Band: [Mean28 - SWC] a [Mean28 + SWC]

Classificação:
  GREEN  (favorable): lnRMSSD7d >= Mean28 - SWC  E  RHR normal
  SATURATION: lnRMSSD7d < Mean28 - SWC  MAS RHR <= Mean28_RHR + SWC  E wellness ok → tratar como GREEN
  YELLOW (attention): lnRMSSD7d < Mean28 - SWC  E  RHR > Mean28_RHR + SWC  (mas > Mean28 - 1.5×SWC)
  RED    (recovery):  lnRMSSD7d < Mean28 - 1.5×SWC  OU  3+ dias consecutivos em YELLOW/RED

Escalamento de recuperação:
  1 dia RED  → treino leve Z1/Z2, volume -50%
  2 dias RED → descanso ativo (caminhada 20min, mobilidade)
  3+ dias RED → descanso passivo completo + checklist lifestyle
  Overreaching flag: 5+ dias sem retorno ao GREEN
```

---

## Subsistema 2 — Ciclo Menstrual

### Por que é necessário

A fase lútea reduz o lnRMSSD em 3–8% naturalmente (McNulty et al. 2020). Sem correção por fase, o app classificaria atletas femininas em "recovery" erroneamente na fase lútea todo mês, prescrevendo treinos leves quando elas podem treinar normalmente.

### Fases e impacto fisiológico

| Fase | Dias (ciclo 28d) | lnRMSSD | FC Repouso | Recomendação de treino |
|---|---|---|---|---|
| **Menstrual** | 1–5 | Leve supressão + variável | Normal/alta | Z1/Z2; reduzir se sintomática |
| **Folicular** | 6–14 | **Mais alto e estável** ↑ | Baixa | HIIT, VAM, força — janela de ouro |
| **Ovulatória** | ~14 | Pico de estrogênio | Baixa | Alta intensidade, foco em estabilidade |
| **Lútea** | 15–28 | **Queda natural -3–8%** | Ligeiramente alta | Base/longão Z2; deload nos dias 24–28 |

### Correção de baseline por fase

O agente mantém **4 baselines independentes**, um por fase do ciclo. A comparação lnRMSSD de hoje é feita contra o baseline da **fase atual**, não o baseline global.

### Campos de dados novos (usuárias femininas)

```
user_menstrual_profile:
  - lmp_date          → data do início do último período
  - cycle_length_days → duração média do ciclo (padrão: 28)
  - uses_hormonal_contraceptive → bool (contraceptivos "achatam" a curva)
  - contraceptive_type → tipo se aplicável

menstrual_tracking (por dia):
  - phase              → menstrual / follicular / ovulatory / luteal
  - cramp_level        → 0–5 (cólica)
  - bloating_level     → 0–5 (inchaço)
  - energy_level       → 0–5 (energia)
  - mood_level         → 0–5 (humor)
  - bleeding_intensity → none / light / moderate / heavy (apenas dias 1–7)
```

### Algoritmo integrado VFC × Ciclo

```
1. Determinar fase_atual com base em (hoje - lmp_date) % cycle_length
2. Selecionar baseline da fase_atual (ou global se < 2 ciclos de histórico)
3. Calcular delta_fase = lnRMSSD_hoje - mean_fase
4. Calcular score_sintomas = (cramp + bloating + (5 - energy) + (5 - mood)) / 20
5. Classificar status com o delta_fase (não delta_global)
6. Se score_sintomas > 0.6 → degradar um nível (GREEN→YELLOW, YELLOW→RED)
7. Override de recomendação por fase:
   - Fase folicular + GREEN = sugerir intensidade máxima (HIIT/VAM)
   - Fase lútea (dias 24-28) + GREEN = preferir Z2/base (econômico de gordura)
```

---

## Subsistema 3 — Protocolo de Recuperação Escalonado

### Resposta escalonada ao status RED

```
Nível 1 (1 dia RED):
  - Substituir treino intenso por rodagem leve Z1/Z2 (20–30 min)
  - Sugerir: foam rolling (1–2 min/grupo muscular), mobilidade 10 min
  
Nível 2 (2 dias RED):
  - Descanso ativo: caminhada leve 20 min ou yoga/mobilidade 20 min
  - Checklist mostrado ao usuário: sono < 7h? nutrição adequada? estresse alto?
  
Nível 3 (3+ dias RED):
  - Descanso passivo completo
  - Alerta de overreaching no app
  - Sugerir: verificar sono, hidratação, carga de trabalho
  
Nível 4 (5+ dias RED ou overtraining flag):
  - Alerta crítico: "Considere consultar um profissional de saúde"
  - Bloquear treinos de alta intensidade no app
  - Registro de overreaching no histórico do atleta
```

### Regras científicas de recuperação implementadas

| Protocolo | Regra | Fonte |
|---|---|---|
| Banho de gelo | Somente se `phase == 'competition'` — NÃO em base/build | Petersen et al. 2021 |
| Taper pré-prova | Volume -40–60%, intensidade 100%, frequência ≤-20% | Mujika & Padilla 2000 |
| Deload semanal | A cada 3 semanas OU quando 7d-avg cair abaixo de SWC | Kiviniemi 2007 |
| Foam rolling | Evidência: alívio neurológico de DOMS, não estrutural | Grgic et al. 2021 |
| Sono mínimo | ≥7h geral, ≥8h em semanas de carga pesada | Knufinke et al. 2018 |

---

## Arquitetura de Arquivos

### Novos arquivos

```
server/agent/
  trainingAgent.js          → MODIFICAR (reescrita significativa)
  menstrualModule.js        → CRIAR (novo módulo de ciclo menstrual)
  recoveryProtocol.js       → CRIAR (recuperação escalonada isolada)

server/database/
  schema.js                 → MODIFICAR (3 novas tabelas)

server/routes/
  hrv.js                    → MODIFICAR (usar RHR, baseline 28d, ciclo)
  users.js                  → MODIFICAR (endpoints menstrual profile)
  menstrual.js              → CRIAR (novo router para ciclo menstrual)

src/pages/
  Dashboard.jsx             → MODIFICAR (RHR no modal matinal, indicador de fase)
  Profile.jsx               → MODIFICAR (seção de perfil menstrual para feminino)

src/components/
  MenstrualTracker.jsx      → CRIAR (componente de rastreamento diário)
  RecoveryAlert.jsx         → CRIAR (alerta de overreaching/overtraining)
  CyclePhaseIndicator.jsx   → CRIAR (indicador visual da fase do ciclo)
```

### Tabelas novas no banco

```sql
-- Perfil menstrual da atleta
CREATE TABLE user_menstrual_profile (
  user_id TEXT PRIMARY KEY,
  lmp_date TEXT,
  cycle_length_days INTEGER DEFAULT 28,
  uses_hormonal_contraceptive INTEGER DEFAULT 0,
  contraceptive_type TEXT,
  created_at TEXT, updated_at TEXT
);

-- Rastreamento diário de sintomas
CREATE TABLE menstrual_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  date TEXT,
  phase TEXT,
  cramp_level INTEGER,
  bloating_level INTEGER,
  energy_level INTEGER,
  mood_level INTEGER,
  bleeding_intensity TEXT,
  created_at TEXT
);

-- Baselines por fase do ciclo (VFC)
CREATE TABLE hrv_phase_baselines (
  user_id TEXT,
  phase TEXT,
  lnrmssd_mean REAL,
  lnrmssd_sd REAL,
  rhr_mean REAL,
  rhr_sd REAL,
  sample_count INTEGER,
  updated_at TEXT,
  PRIMARY KEY (user_id, phase)
);
```

### Modificação na tabela existente

```sql
-- Adicionar RHR na tabela de medições HRV
ALTER TABLE hrv_measurements ADD COLUMN rhr_bpm REAL DEFAULT NULL;
ALTER TABLE hrv_measurements ADD COLUMN consecutive_low_days INTEGER DEFAULT 0;
```

---

## Verificação

### Testes automatizados (Jest)
- `trainingAgent.test.js`: testar novo algoritmo 28d + RHR + saturação
- `menstrualModule.test.js`: testar cálculo de fase, score de sintomas, delta_fase
- `recoveryProtocol.test.js`: testar escalonamento 1d/2d/3d/5d+ RED

### Verificação manual
- Login como usuária feminina → ver seção de perfil menstrual no Profile
- Preencher medição matinal incluindo RHR → verificar que status usa baseline 28d
- Simular 3 dias consecutivos de VFC baixa → ver alerta de overreaching
- Verificar que banho de gelo só é sugerido em fase de competição
