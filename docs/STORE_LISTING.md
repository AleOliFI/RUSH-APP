# RUSH — Textos para as Lojas

## Nome do app
**RUSH — Treinador de Recuperação HRV**

## Subtítulo (iOS — máx 30 caracteres)
Prescrição de treino por VFC

## Descrição curta (Google Play — máx 80 caracteres)
Lê sua VFC da cinta ou relógio e prescreve o treino certo para cada dia.

## Descrição longa (PT-BR)

**RUSH conecta à sua cinta cardíaca ou relógio por Bluetooth, mede sua Variabilidade da Frequência Cardíaca (VFC/HRV) e te diz exatamente como treinar hoje.**

Chega de treinar no chute. Em 2 minutos de medição você sabe se seu corpo está pronto para uma sessão intensa, precisa de Zona 2 ou de descanso ativo.

### Como funciona
1. Conecte sua cinta ou relógio por Bluetooth
2. 60 segundos em repouso
3. Receba sua prescrição de treino personalizada

### Precisão
O RUSH lê os intervalos entre batimentos direto do sensor, com resolução de ~1 milissegundo — o mesmo dado que estudos de VFC usam. Compatível com Polar H10, Garmin HRM, Wahoo TICKR e outros sensores do padrão Bluetooth de frequência cardíaca.

### O que o RUSH analisa
- **S_VFC** — score de VFC linearizado (0–100) baseado em RMSSD
- **S_FCR** — score de frequência cardíaca em repouso
- **E_WB** — escore de bem-estar (sono, estresse, fadiga, DOMS)
- **E_Prontidão** — score final ponderado que guia sua prescrição

### Prescrições inteligentes
🟢 **Verde (≥70)** — Alta intensidade: limiares, intervalados, HIIT
🟡 **Laranja (40–69)** — Zona 2: corrida contínua conversacional
🔴 **Vermelho (<40)** — Recuperação: coerência cardíaca, mobilidade

### Módulo Hormonal Feminino (Premium)
Ajuste automático por fase do ciclo menstrual, perfis SOP e AHF/RED-S. Nunca mais treine contra seu hormônio.

### Ciência validada
Algoritmo baseado em protocolos científicos de HRV4Training, WHOOP e literatura de periodização do treino.

---

## Palavras-chave (App Store)
hrv,variabilidade cardíaca,treino,corrida,recuperação,vfc,frequência cardíaca,polar h10,cinta cardíaca,atleta

## Categoria
- App Store: **Saúde e Forma Física**
- Google Play: **Saúde e Fitness**

## Classificação etária
- App Store: 4+
- Google Play: Todos

## URL de suporte
https://aleolifi.github.io/rush-app/support.html

## URL de privacidade
https://aleolifi.github.io/rush-app/privacy-policy.html

---

## Checklist antes de submeter

### Google Play
- [ ] Conta de desenvolvedor criada (play.google.com/console) — US$25 taxa única
- [ ] `google-services-key.json` gerado no Play Console para submit automático
- [ ] Preencher `ascAppId` em eas.json com o ID do app no Play Console
- [ ] Screenshots: mínimo 2 de phone (16:9), opcionalmente tablet
- [ ] Feature graphic: 1024×500px
- [ ] Política de privacidade publicada (URL válida)

### Apple App Store
- [ ] Conta Apple Developer (developer.apple.com) — US$99/ano
- [ ] Preencher `appleId`, `ascAppId` e `appleTeamId` em eas.json
- [ ] Screenshots: iPhone 6.9" e iPhone 6.5" (obrigatórios)
- [ ] Política de privacidade publicada (URL válida)
- [ ] App Review Information: conta de teste para o revisor da Apple

---

## Comandos para publicar

```bash
# 1. Login no EAS (uma vez)
npx eas-cli login

# 2. Configurar projeto (uma vez — gera projectId)
npx eas-cli build:configure

# 3. Build de produção
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production

# 4. Submeter às lojas (após builds prontos)
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```
