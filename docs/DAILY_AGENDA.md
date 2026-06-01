# RUSH-APP — Log de Desenvolvimento Diário

> Arquivo atualizado automaticamente pelo workflow diário às 9h BRT.  
> O Claude lê este arquivo antes de cada sessão para evitar reimplementar features.

---

## Já implementado (base V2 — junho 2026)

- Motor algorítmico V2: `S_VFC` (lnRMSSD linearizado), `S_FCR`, `E_WB`
- Escore ponderado 3D: `E_Prontidão = 0.50×S_VFC + 0.20×S_FCR + 0.30×E_WB`
- Zonas de cor: Verde (≥70) / Laranja (40–69) / Vermelho (<40) / Cinza (calibrando)
- Prescrições de treino em PT-BR por zona (Alta Intensidade / Zona 2 / Coerência Cardíaca)
- Módulo hormonal feminino: fases do ciclo, correção lútea ×1.15, perfis SOP e AHF/RED-S
- Detecção de downregulation metabólica masculina (penalização 45%)
- Fator catabólico T:C via TRIMP acumulado (3 dias)
- Filtro de artefatos R-R com interpolação spline cúbica
- Medição 2 fases: 60s estabilização + 60s aquisição ativa
- Baselines µ_VFC7, µ_VFC28, σ_VFC28 com banda σ no gráfico
- Gráfico S_VFC com banda µ±σ (`SVFCTrendChart.tsx`)
- Onboarding com perfil hormonal + data da última menstruação
- Histórico de leituras com badge S_VFC por linha
- Tela de perfil com fase do ciclo atual + stats µ28/σ
- Logger de sessão de treino com TRIMP ao vivo (Banister)
- Paywall RevenueCat: R$19,90/mês | R$119,90/ano
- Webhook RevenueCat → Supabase Edge Function (sync subscription_tier)
- Web fallback para acesso premium via DB quando SDK não disponível
- Tela de wearables placeholder (Garmin/Strava/Apple Health/Google Fit — Em breve)
- Migrations 001–008 aplicadas

---

## Próximas prioridades sugeridas

- Gráfico Performance Manager (CTL/ATL/TSB) estilo TrainingPeaks
- Notificações push diárias às 8h para lembrar de medir HRV
- Widget iOS/Android com S_VFC do dia na tela inicial do celular
- VO₂max estimado por pace + FC média no log de corrida
- Tela de tendências semanais: delta S_VFC vs semana anterior
- Exportar dados HRV como CSV (premium)
- Teste ortostático: diferença HRV deitado → em pé → classificar SNA
- Integração Apple Health para importar dados de sono e FC
- Plano de treino adaptativo semanal baseado no S_VFC histórico
- Streak de dias consecutivos medidos (gamificação / retenção)
- Comparativo de S_VFC em dias de treino vs repouso
- Score de consistência mensal (% de dias medidos)

---

## Histórico de execuções diárias

| Data | Concorrente pesquisado | Feature implementada | PR |
|------|----------------------|---------------------|----|
| 2026-06-01 | — | Setup do workflow de desenvolvimento diário | — |
