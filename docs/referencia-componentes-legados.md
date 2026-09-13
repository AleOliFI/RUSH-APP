# Conteúdo extraído dos componentes legados

Este arquivo guarda o **conteúdo útil** dos componentes que usavam o design
system antigo e foram removidos do código. O código em si está no histórico do
git (último commit antes da remoção: `ad44e60`), mas ele foi escrito para o
design system anterior e teria de ser reescrito de qualquer forma — o que vale
preservar é o texto, os limiares e as referências científicas abaixo, para
quando as telas equivalentes forem desenhadas.

Três dos componentes removidos implementavam funcionalidades que **ainda não
têm substituto** nas telas novas: fase do ciclo menstrual, zonas de FC e guia
de aquecimento. Um quarto — o alerta de overreaching — expôs uma lacuna que
não estava mapeada.

---

## 1. Alerta de overreaching (era `RecoveryAlert.jsx`)

**Lacuna aberta.** O backend calcula `consecutive_low_days`, `recovery_level` e
`recovery_activities` e devolve tudo dentro de `daily_status`. Nenhuma tela do
app novo lê esses campos, então o atleta com VFC deprimida há vários dias
seguidos não recebe nenhum aviso. É o sinal de segurança mais importante do
app e hoje ele é silencioso.

Não é uma tela: é um banner no topo do Início, que só aparece a partir de
2 dias consecutivos.

### Limiares e textos

| Dias consecutivos | Severidade | Etiqueta | Texto |
|---|---|---|---|
| 0–1 | nenhuma | — | banner não aparece |
| 2 | atenção | ⚡ FADIGA ACUMULADA | "O sistema nervoso autônomo está demandando recuperação. O treino de hoje foi automaticamente adaptado para Z1/Z2 com foco regenerativo." |
| 3–4 | severa | ⚡ FADIGA ACUMULADA | mesmo texto, com destaque maior |
| ≥ 5 | crítica | ⚠️ ALERTA DE OVERREACHING | "Seu sistema parassimpático apresenta supressão severa contínua. Para evitar sobretreino crônico (NFOR), treinos de alta intensidade foram temporariamente bloqueados." |

Título da linha: `{n} dias seguidos abaixo da baseline` (até 4) ou
`{n} dias consecutivos com VFC deprimida` (5 ou mais).

### Protocolo escalonado (`server/agent/recoveryProtocol.js`)

O backend já devolve a sessão ajustada e a lista de atividades de recuperação;
a tela deve **exibir** essa lista, nunca escrever a própria:

- **Nível 1** — treino intenso vira rodagem leve Z2 de 30 min; se o plano já era
  leve, volume reduzido em 30% e mantido em Z1.
- **Nível 2** (2 dias) — descanso ativo: caminhada leve de 20 min ou
  mobilidade/yoga, sem impacto.
- **Nível 3** (3 dias) — descanso passivo completo.
- **Nível 4** (≥ 5 dias) — descanso obrigatório, com aviso de overreaching.

A base das atividades sugeridas inclui "Sono ≥ 8 h esta noite" e
"Hidratação: 35 ml/kg de peso".

---

## 2. Fase do ciclo menstrual (era `CyclePhaseCard.jsx`)

Textos por fase, para a tela de ciclo. A fase vem calculada da API
(`GET /api/menstrual/today`), nunca do atleta.

| Fase | Dias | Cor | Etiqueta de treino | Descrição |
|---|---|---|---|---|
| `menstrual` | 1–5 | `#FF4D4D` | REGENERAÇÃO & Z1/Z2 | Estrogênio e progesterona baixos. Priorize escuta do corpo e conforto. |
| `follicular` | 6–13 | `#00E676` | JANELA DE OURO (HIIT / VAM) | Estrogênio em alta: máxima recuperação e dominância parassimpática. |
| `ovulatory` | 14 ±1 | `#00B0FF` | PICO DE FORÇA & ENERGIA | Pico hormonal de estrogênio. Alta energia. Capriche no aquecimento articular. |
| `luteal` | 15–28 | `#FFB300` | BASE AERÓBICA & Z2 | Progesterona dominante: o corpo prefere queimar gordura. VFC naturalmente um pouco menor. |

O campo `recommendation.modifier` da API traz o ajuste de treino da fase e deve
ser exibido como veio.

---

## 3. Zonas de frequência cardíaca (era `HeartRateZonesModal.jsx`)

Cores por zona, usadas na borda esquerda de cada ficha:

| Zona | Cor |
|---|---|
| Z1 | `#4CAF50` |
| Z2 | `#00E676` |
| Z3 | `#FFB300` |
| Z4 | `#FF9100` |
| Z5 | `#FF3800` |

Textos de apoio:

- FC máxima rotulada como **estimada**, pelo método de Gellish, quando não há
  teste de campo.
- Distribuição polarizada: **80% Z1/Z2 • 20% Z4/Z5**.
- Regra dos 80/20 (Seiler): "Mantenha a maior parte dos treinos em Z2
  (conversacional) para construir mitocôndrias e queima de gordura sem fadiga
  residual."

Os demais dados de cada zona (nome, faixa em bpm, `%` da máxima, RPE, propósito
e faixa de DFA-α1) vêm prontos de `GET /api/hrv/zones`.

---

## 4. Aquecimento dinâmico e educativos (era `WarmupGuideModal.jsx`)

Conteúdo inteiramente estático — não depende de nenhum endpoint. São três
fases, 12 exercícios.

**Aviso de abertura:** por que nunca alongar parado antes de correr —
alongamento estático pré-corrida reduz a rigidez elástica do tendão em cerca de
5,4% (Simic et al., 2013), diminuindo a velocidade e aumentando o risco de
entorse. O aquecimento dinâmico é o padrão da literatura.

Referências citadas: Fradkin et al. (2010), Simic et al. (2013),
Behm & Chaouachi (2011).

### Fase 01 — Mobilidade articular dinâmica (2 a 3 min)

*Lubrificação das articulações sinoviais e amplitude de movimento sem perda de
rigidez elástica.*

| Exercício | Repetições | Comando | Benefício |
|---|---|---|---|
| Círculos de tornozelo e mobilidade no chão | 10 rotações para cada lado, por perna | Calcanhar apoiado, projete o joelho à frente sem descolar o calcanhar | Previne canelite (MTSS) e fascite plantar |
| Balanço de perna ântero-posterior e lateral | 12 repetições controladas por perna | Balanço de pêndulo, ampliando aos poucos | Soltura da cápsula do quadril e isquiotibiais |
| Abertura de quadril em avanço com rotação | 6 passos alternados para cada lado | Passo largo, joelho a 90°, gire o tronco para o lado da perna dianteira | Ativação de psoas e glúteos, mobilidade torácica |

### Fase 02 — Ativação muscular específica (2 a 3 min)

*Despertar dos estabilizadores pélvicos e extensores de quadril para absorção
de impacto.*

| Exercício | Repetições | Comando | Benefício |
|---|---|---|---|
| Ponte de glúteos unilateral dinâmica | 10 por perna | Eleve o quadril pressionando o calcanhar no solo, 1 s no topo | Ativação do glúteo máximo, motor da propulsão |
| Caminhada monstro (glúteo médio) | 15 passos laterais para cada lado | Pés paralelos à frente, joelhos levemente flexionados | Evita queda pélvica (valgo dinâmico) e lesão da banda iliotibial |
| Elevação de panturrilha em 1 pé | 12 por perna | Suba na ponta do pé com controle, ênfase na articulação do dedão | Prepara o complexo gastrocnêmio-sóleo para forças de até 2,5× o peso corporal |

### Fase 03 — Educativos técnicos de corrida (3 a 4 min)

*Mecânica de passada, tempo de contato com o solo e rigidez elástica do tendão.*

| Exercício | Séries | Comando | Benefício |
|---|---|---|---|
| Skipping baixo e alto | 2 × 20 m | Tronco ereto, joelho a 90°, tornozelo dorsifletido, braços a 90° | Cadência e tripla extensão tornozelo-joelho-quadril |
| Anfersen (calcanhar no glúteo) | 2 × 20 m | Joelho aponta para o solo, calcanhar sobe rápido ao ísquio | Otimiza o ciclo da perna livre e reduz o braço de alavanca |
| Drible de tornozelo / saltitos de mola | 2 × 15 m | Apoio no antepé, joelhos firmes, ressalto rápido como mola | Reduz o tempo de contato com o solo e melhora a economia de corrida |
| Soldadinho (chute dinâmico) | 2 × 20 m | Pernas estendidas à frente, puxando o solo ativamente para trás | Potência da cadeia posterior e pré-ativação dos isquiotibiais |
| Acelerações progressivas (strides) | 3 × 60 m a 80–90% | Comece suave e acelere com técnica; caminhe de volta para recuperar | Prepara o sistema neuromuscular e cardiovascular para o ritmo do treino |

---

## 5. Componentes removidos que já têm substituto

Nenhum conteúdo a preservar: as telas novas cobrem a mesma função.

| Removido | Substituto atual |
|---|---|
| `AthleteProfileModal.jsx` | `components/rush/AthleteModal.tsx` |
| `BluetoothHrvMonitor.jsx` | `hooks/useHrvCapture.ts` (BLE GATT 0x180D) |
| `CameraHrvMonitor.jsx` | `hooks/useHrvCapture.ts` (PPG por câmera) |
| `FieldTestModal.jsx` | `components/rush/FieldProtocolModal.tsx` |
| `PostWorkoutModal.jsx` | `components/rush/WorkoutSummaryModal.tsx` |
| `ForgotPasswordModal.jsx` | fluxo de recuperação dentro de `screens/LoginScreen.tsx` |
| `SocialIcons.jsx` | ícones Material Symbols do design system novo |
| `src/counter.ts`, `src/main.ts` | sobras do template do Vite, nunca usadas |

Uma diferença importante: o `CameraHrvMonitor` antigo, quando o sinal era
insuficiente, devolvia um RMSSD inventado (55 ou 58 ms). O `useHrvCapture`
atual falha com mensagem clara em vez de fabricar o número.
