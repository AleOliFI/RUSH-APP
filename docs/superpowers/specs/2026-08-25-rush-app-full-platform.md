# RUSH App — Arquitetura da Plataforma Completa de Corrida Científica

**Data:** 2026-08-25
**Objetivo:** Transformar o RUSH App em uma plataforma completa, intuitiva e 100% embasada na ciência para corredores amadores e avançados.

---

## 1. Módulos e Funcionalidades a Serem Desenvolvidos

### Módulo A: Monitoramento de VFC via Câmera do Celular (Web PPG Óptico)
- **Princípio:** Fotopletismografia (PPG) pela lente da câmera traseira do smartphone + flash/lanterna.
- **Processamento de Sinal:**
  - Captura de stream de vídeo em alta taxa via `MediaDevices API`.
  - Processamento em tempo real via HTML5 Canvas (extração do canal vermelho central).
  - Algoritmo de filtragem e detecção de picos sistólicos (Intervalos R-R).
  - Cálculo de BPM instantâneo, RMSSD (ms) e $\ln\text{RMSSD}$.
  - Indicador de qualidade de sinal (detecta se o dedo está cobrindo a lente corretamente).
  - Temporizador de 60 segundos com onda de pulso animada em tempo real.
  - Botão para transferir diretamente o resultado medido para o check-in matinal do dia.

### Módulo B: Autenticação Completa (Esqueci a Senha + Reset)
- Backend:
  - `POST /api/auth/forgot-password`: gera token/código de redefinição com expiração de 1 hora.
  - `POST /api/auth/reset-password`: valida token e atualiza a senha com hash bcrypt.
- Frontend:
  - Fluxo na tela de Login: "Esqueceu a senha?", modal/painel com envio de código e definição de nova senha.

### Módulo C: Perfil Expandido + Redes Sociais + Setup de Zonas/Paces
- Novos campos no banco e perfil:
  - Redes Sociais: Instagram (`@handle`), Strava (`link/user`).
  - Foto de Perfil (upload de foto / presets atléticos).
  - Pace de referência (ex: 5K, 10K, 21K, 42K).
  - Teste de FCmax e FC de Repouso.
  - Histórico ou dados prévios de VFC.
- Setup guiado de Zonas:
  - Opção 1: Corredor já sabe seu pace de 5K $\rightarrow$ calcula automaticamente Z1 a Z5 e paces correspondentes.
  - Opção 2: Corredor tem relógio com FCmax $\rightarrow$ calcula faixas de BPM.
  - Opção 3: Corredor iniciante sem dados $\rightarrow$ Teste de Campo Guiado no App.

### Módulo D: Teste de Campo para Iniciantes (Protocolo Científico)
- **Protocolo Joe Friel / Foster (30 min / 12 min Cooper)** integrado no app.
- Passo a passo na tela para o usuário executar na esteira ou rua.
- Cálculo automático das zonas individuais Z1 a Z5, FC de Reserva (Karvonen) e Paces de Treino.
- Explicação científica clara sobre por que não correr sempre na Zona 3 ("No man's land").

### Módulo E: Guia Científico de Aquecimentos Dinâmicos & Educativos (Drills)
- Base científica: *Fradkin et al. (2010)* e *Simic et al. (2013)* sobre por que aquecimento estático antes da corrida inibe potência e aumenta risco de lesão.
- Protocolo dinâmico em 3 fases:
  1. Mobilidade Articular (tornozelo, quadril, coluna).
  2. Ativação Muscular (glúteo médio, isquiotibiais).
  3. Educativos Técnicos (Skipping alto/baixo, Anfersen, Drible/Stiffness, Soldadinho, Strides).
- Componente / modal ilustrado no app para consulta antes de cada treino.

### Módulo F: Feedback Pós-Treino (Percepção Subjetiva de Esforço - RPE) & Previsão de Amanhã
- Ao finalizar um treino:
  - Modal de Registro Pós-Treino: Pace real, Distância real, RPE de 1 a 10 (Escala de Borg/Foster), Como se sentiu, Foto do treino.
  - Cálculo de Carga Interna (TRIMP = RPE $\times$ Duração).
  - Se RPE $>$ esperado $\rightarrow$ agente adapta o treino de amanhã.
- Card no Dashboard: **"Treino de Amanhã (Previsão)"** com nota educativa de confirmação pós-VFC matinal.

### Módulo G: Feed Social Estilo Instagram Completo
- Abas no Feed: "Seguindo" e "Explorar".
- Criar Postagem com Foto do treino, métricas (KM, Pace, VFC, RPE) e legenda.
- Curtidas (coração), Comentários e Contadores.
- Seguir / Deixar de Seguir atletas diretamente pelo feed e perfil público.
- Modal de Perfil de Atleta Público ao clicar no autor do post.

---

## 2. Estrutura de Arquivos

### Backend
- `server/database/schema.js` (novas colunas e migrações para posts com foto, RPE, reset de senha, instagram/strava)
- `server/routes/auth.js` (`/forgot-password`, `/reset-password`)
- `server/routes/users.js` (`/profile` expandido com instagram, strava, paces, zonas)
- `server/routes/social.js` (`/posts` com foto, explorar feed, perfil público de atletas)
- `server/routes/activities.js` (RPE e feedback pós-treino)
- `server/agent/trainingAgent.js` (cálculo de paces por zona, teste de campo, TRIMP de Foster)

### Frontend
- `src/components/CameraHrvMonitor.jsx` (NOVO: Medição de VFC via Câmera/PPG)
- `src/components/WarmupGuideModal.jsx` (NOVO: Guia Científico de Aquecimentos e Drills)
- `src/components/FieldTestModal.jsx` (NOVO: Teste de Campo de Zonas para Iniciantes)
- `src/components/PostWorkoutModal.jsx` (NOVO: Registro de Feedback / RPE pós-treino e foto)
- `src/components/AthleteProfileModal.jsx` (NOVO: Modal de Perfil Público estilo Instagram)
- `src/components/ForgotPasswordModal.jsx` (NOVO: Recuperação de Senha)
- `src/pages/Dashboard.jsx` (Atualizado com Previsão de Amanhã, Botão da Câmera VFC, Guia de Aquecimento)
- `src/pages/Feed.jsx` (Atualizado com abas Seguindo/Explorar, criação de posts com fotos, modal de atletas)
- `src/pages/Profile.jsx` (Atualizado com Instagram, Strava, upload de foto, setup de Paces e Zonas)
- `src/pages/Login.jsx` (Atualizado com Esqueci a Senha)
