# Declaração de apps de saúde — Google Play Console

> Conteúdo preparado para você transcrever no formulário do Play Console.
> **O envio é seu**: eu não tenho acesso ao console.
>
> O formulário é **obrigatório para todo app publicado** no Google Play —
> inclusive em teste fechado e aberto —, mesmo para apps sem recursos de
> saúde. O RUSH tem, e de categoria sensível.

## Por que este app cai na declaração

O RUSH coleta e processa dados que o Google classifica como de saúde, e um
deles está na faixa de **alta sensibilidade**:

| dado | onde está no código | sensibilidade |
|---|---|---|
| Variabilidade da frequência cardíaca (RMSSD) | `hrv_measurements`, `hrv_phase_baselines` | saúde |
| Frequência cardíaca (amostras durante a atividade) | `activity_hr_samples` | saúde |
| FC máxima e de repouso | `user_profiles.hr_max_tested`, `hr_rest_tested` | saúde |
| VO₂máx estimado | `vo` | saúde |
| Prontidão / bem-estar | `daily_status`, `wellness_scores` | saúde |
| **Fases do ciclo menstrual** | `menstrual_tracking`, `user_menstrual_profile` | **alta** |
| Peso e altura | `user_profiles.weight_kg`, `height_cm` | saúde |

## Respostas a preparar

**O app oferece recursos de saúde?** Sim.

**Categoria.** Acompanhamento de treino e condicionamento físico, com leitura
de variabilidade cardíaca para orientar carga de treino.

**Finalidade de cada dado.** Todos os dados acima são usados exclusivamente
para calcular prontidão fisiológica e ajustar a prescrição de treino dentro
do app. O ciclo menstrual entra porque a VFC varia ao longo dele — ignorar
essa variação distorce a leitura.

**Usos proibidos — confirmar que NÃO ocorrem.** O Google veda explicitamente
o uso de dado sensível de saúde para elegibilidade de emprego ou seguro, e
para compartilhamento social não autorizado. Nenhum desses usos existe aqui:

- não há publicidade no app;
- não há venda nem compartilhamento de dados com terceiros para marketing;
- os dados de saúde não alimentam nenhuma decisão fora da prescrição de treino;
- o compartilhamento social é opt-in e controlado em Ajustes → privacidade
  (`privacy_settings`), e o status de VFC só aparece no perfil público se a
  pessoa ligar.

**Compartilhamento com treinador.** Existe e precisa ser declarado: ao se
vincular a uma assessoria (`academies`), o treinador passa a ver a leitura
fisiológica e o histórico de treino do atleta. É consequência direta e
voluntária do vínculo.

**Exclusão de dados.** Há exclusão de conta dentro do app
(`DeleteAccountScreen` → `DELETE /api/users/me`). **Declare com precisão**:
ela é lógica — a conta é marcada com `deleted_at` e some do app, mas a linha
permanece na base. A remoção física é atendida por solicitação ao contato da
política. Não descreva como remoção imediata e total: não é.

**Política de privacidade.** URL pública: `https://<seu-domínio>/privacidade`

**Health Connect.** O app **não** se integra ao Health Connect hoje. Se isso
mudar, a declaração precisa ser refeita com justificativa por tipo de dado.

## Antes de enviar

- [ ] Preencher razão social e contato em `src/data/textosLegais.ts`
- [ ] Publicar a política numa URL estável e acessível sem login
- [ ] Revisão jurídica do texto (trata dado sensível sob LGPD)
