# RUSH-APP — Prompt de Desenvolvimento Diário Autônomo

Você é o desenvolvedor autônomo do **RUSH-APP**. Sua tarefa hoje é pesquisar um app concorrente, identificar a melhoria mais valiosa que ainda não existe no RUSH-APP, implementá-la e mergear um PR — tudo sem intervenção manual.

---

## 1. Identidade do RUSH-APP

**O que é:** App mobile React Native (Expo SDK 56) para corredores que mede a Variabilidade da Frequência Cardíaca (VFC/HRV) via câmera PPG e gera prescrições de treino personalizadas.

**Stack:**
- React Native + Expo SDK 56 + Expo Router (file-based routing)
- NativeWind v4 (Tailwind CSS para React Native)
- Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- RevenueCat (`react-native-purchases`) — R$19,90/mês | R$119,90/ano
- TypeScript strict

**Algoritmo V2 (já implementado):**
- `S_VFC` = linearização lnRMSSD → 0–100
- `S_FCR` = escore de frequência cardíaca em repouso 0–100
- `E_WB` = escore de bem-estar normalizado 0–100
- `E_Prontidão = 0.50×S_VFC + 0.20×S_FCR + 0.30×E_WB`
- Módulo hormonal feminino (fases do ciclo, SOP, AHF/RED-S)
- Detecção de downregulation metabólica masculina
- Fator catabólico T:C via TRIMP acumulado

**Freemium:**
- Grátis: medição PPG, S_VFC, questionário bem-estar, histórico 7 dias
- Premium: prescrições detalhadas, módulo hormonal, downregulation, histórico 28 dias, wearables

**Arquivos principais:**
```
app/
  (tabs)/index.tsx         # home dashboard
  (tabs)/history.tsx       # histórico S_VFC
  (tabs)/profile.tsx       # perfil + dados hormonais
  (auth)/onboarding/       # cadastro + calibração
  measurement/             # camera → wellbeing → result
  subscription/index.tsx   # paywall RevenueCat
  wearables/index.tsx      # placeholder (Em breve)
src/
  lib/algorithms/          # ppg.ts, hrv.ts, readiness.ts, hormonal.ts
  hooks/useHRVBaseline.ts  # baselines S_VFC µ7/µ28/σ28
  hooks/useSubscription.ts # useIsPremium()
  components/charts/       # ReadinessRing, SVFCTrendChart
supabase/
  migrations/              # 001–008 aplicadas
  functions/revenuecat-webhook/
docs/
  DAILY_AGENDA.md          # log de execuções anteriores — SEMPRE LER ANTES DE COMEÇAR
```

---

## 2. Concorrente a Pesquisar Hoje

Identifique o dia da semana atual e pesquise o concorrente correspondente:

| Dia | Concorrente | Foco de pesquisa |
|-----|-------------|-----------------|
| Segunda | **WHOOP 4.0** | Recovery Score, Strain Coach, coaching diário |
| Terça | **Garmin Connect** | HRV Status, Training Readiness, Body Battery, Morning Report |
| Quarta | **HRV4Training** | camera PPG, readiness score, acute:chronic ratio |
| Quinta | **TrainingPeaks** | TSS, CTL/ATL/TSB, Performance Manager Chart, workout plans |
| Sexta | **Polar Flow** | Training Load Pro, Orthostatic Test, FitSpark AI coach |
| Sábado | **Runna / Tempo** | planos de corrida adaptativos, IA coach, periodização |
| Domingo | **Apple Fitness+ / Health** | VO₂max, Cardio Fitness trends, métricas de recuperação |

---

## 3. Processo de Execução (SIGA EXATAMENTE)

### Passo 1 — Ler o histórico
Leia `docs/DAILY_AGENDA.md` para saber o que já foi implementado. Não reimplemente features existentes.

### Passo 2 — Pesquisar concorrente
Use WebSearch para buscar:
- `"[concorrente] new features [ano atual]"`
- `"[concorrente] changelog update"`
- Reviews recentes da App Store / Google Play sobre o concorrente
- Blog posts técnicos ou press releases recentes

Liste as **3 funcionalidades mais interessantes** encontradas.

### Passo 3 — Escolher a melhoria
Selecione a **1 feature** de maior impacto para o RUSH-APP que:
- Ainda não existe no app (verificar `docs/DAILY_AGENDA.md` e o codebase)
- É viável implementar em 1 sessão (escopo razoável)
- Agrega valor real para corredores amadores e intermediários
- Respeita o modelo freemium (features avançadas ficam em Premium)

### Passo 4 — Implementar
1. Crie branch: `claude/daily-YYYY-MM-DD` (com a data de hoje)
2. Implemente a feature seguindo os padrões do codebase:
   - TypeScript strict — zero erros de tipo
   - NativeWind v4 classes (não StyleSheet inline)
   - Expo Router (file-based navigation)
   - Supabase RLS em toda tabela nova
   - `useIsPremium()` para gates de premium
3. Se precisar de migration SQL, crie em `supabase/migrations/00X_nome.sql`
4. Não commite `.env.local`, chaves de API ou secrets

### Passo 5 — Criar e mergear PR
1. Commit com mensagem descritiva em inglês (`feat:`, `fix:`, etc.)
2. Push da branch
3. Crie PR com:
   - Título em português descrevendo a feature
   - Body com: inspiração no concorrente, o que foi implementado, onde encontrar na UI
4. Mergear o PR (squash merge)

### Passo 6 — Atualizar o log
Atualize `docs/DAILY_AGENDA.md` adicionando uma linha na tabela de histórico com:
- Data de hoje
- Concorrente pesquisado
- Feature implementada (1 linha)
- Número e link do PR

---

## 4. Restrições e Padrões

- **Nunca** quebrar funcionalidades existentes — V2 deve continuar funcionando
- **Nunca** commitar `.env.local` ou qualquer secret/chave
- **Testes de tipo**: antes de criar o PR, verificar que não há erros TypeScript óbvios
- **Escopo realista**: se a feature for muito grande, implemente a base funcional e documente o restante em `docs/DAILY_AGENDA.md` como "continuação"
- **Padrão de cores**: usar tokens do design system (`text-text-primary`, `bg-bg-card`, `text-rush-lime`, etc.)
- **Sem comentários desnecessários**: só comentar quando o "porquê" for não-óbvio
- **Sem novos packages** sem necessidade clara — usar o que já está no `package.json`

---

## 5. Exemplos de Features que Faltam (se não houver inspiração do concorrente)

- Gráfico Performance Manager (CTL/ATL/TSB) similar ao TrainingPeaks
- Notificação push matinal às 8h lembrando de medir HRV
- Widget iOS/Android com S_VFC do dia
- VO₂max estimado por pace + HR em corridas (dados do log de sessão)
- Tela de tendências semanais com delta S_VFC vs semana anterior
- Exportar dados HRV como CSV (premium)
- Teste ortostático (diferença HRV deitado → em pé)
- Integração com Apple Health para importar dados de sono
- Plano de treino adaptativo semanal baseado no S_VFC histórico
- Streak de dias consecutivos medidos (gamificação)
