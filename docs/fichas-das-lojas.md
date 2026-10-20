# Fichas das lojas — textos e materiais

> Rascunho escrito a partir do que o app **faz de fato**, lido do código.
> Revise antes de publicar: ficha de loja é promessa, e promessa que o app
> não cumpre vira avaliação de uma estrela.
>
> **Uma regra que eu segui e que vale manter:** nada aqui promete diagnóstico,
> tratamento ou resultado de saúde. O app calcula prontidão a partir de VFC e
> sugere carga de treino — isso é orientação de treino, não medicina. Os
> termos de uso já dizem que ele não é dispositivo médico; a ficha não pode
> dizer o contrário.

## Identificação

| campo | valor |
|---|---|
| Nome | RUSH RUNNING |
| Nome curto (ícone) | RUSH |
| Pacote / Bundle | `com.rushrunning.app` |
| Categoria | Saúde e fitness |
| Idioma principal | Português (Brasil) |

## Subtítulo (Apple, 30 caracteres)

```
Treine pelo que seu corpo diz
```
*(29 caracteres)*

## Descrição curta (Google Play, 80 caracteres)

```
Prontidão por VFC, prescrição diária e corrida com GPS. Treine no dia certo.
```
*(75 caracteres)*

## Descrição completa

```
O RUSH RUNNING mede a variabilidade da sua frequência cardíaca pela manhã e
usa esse número para dizer que treino faz sentido HOJE — não o que estava na
planilha há três semanas.

MEDIÇÃO MATINAL
Dois minutos deitado, com a câmera do celular ou uma cinta cardíaca. O app
calcula RMSSD e frequência de repouso, compara com a sua linha de base e
devolve um índice de prontidão.

PRESCRIÇÃO QUE RESPONDE AO SEU DIA
Prontidão alta libera intervalado e limiar. Prontidão baixa prescreve
recuperação — e explica por quê, em vez de só mandar.

CORRIDA COM GPS
Distância, ritmo, parciais e traçado do percurso. Conecte uma cinta por
Bluetooth para frequência cardíaca em tempo real.

GARAGEM DE TÊNIS
Cadastre seus pares e o app acumula a quilometragem de cada um sozinho, a
cada corrida, avisando quando a espuma passou do ponto.

ACOMPANHAMENTO DE CICLO
Para quem menstrua, a VFC varia ao longo do ciclo. O app leva isso em conta
na leitura — é opcional, e o dado é só seu.

TREINADOR E ASSESSORIA
Se você treina com alguém, o seu treinador vê sua prontidão e prescreve
direto no app.

PELOTÃO
Publique suas corridas, acompanhe quem você segue, participe de desafios.

RUSH PRO
Recursos avançados por assinatura, com 7 dias de teste grátis.

---
O RUSH RUNNING não é um dispositivo médico e não substitui profissional de
saúde. As leituras são estimativas baseadas nos dados que você fornece.
Consulte um profissional antes de iniciar ou mudar um programa de treino.
```

## Palavras-chave (Apple, 100 caracteres)

```
corrida,vfc,hrv,treino,gps,pace,maratona,running,prontidao,recuperacao,ritmo
```
*(76 caracteres)*

Sem espaços depois das vírgulas — a Apple conta espaço como caractere. Não
repita palavras que já estão no nome ou no subtítulo: elas já indexam.

## Capturas

Geradas em `resources/lojas/`, nos tamanhos que cada loja exige:

| pasta | tamanho | para |
|---|---|---|
| `apple-6.7/` | 1290 × 2796 | App Store (iPhone 6,7") |
| `android/` | 1080 × 1920 | Google Play (telefone) |

Cinco telas: prontidão, medição, treino, pelotão, perfil.

**Duas ressalvas sobre elas:**

1. Vieram da conta de demonstração, com **uma** medição semeada pela própria
   rota do app — a prontidão exibida foi calculada pelo servidor, não
   desenhada. Mas, por ser a primeira medição, a tela diz *"0% acima da
   baseline histórica"*: não há histórico para comparar. Numa conta com
   algumas semanas de uso, esse número fica interessante. Vale regravar
   depois que houver histórico de verdade.
2. A Apple pede capturas também para iPad se o app for universal. Hoje ele é
   declarado só para iPhone (`UIRequiredDeviceCapabilities`).

## Ícone da loja

`resources/icon.png` (1024 × 1024), sem transparência e sem cantos
arredondados — as duas lojas aplicam a máscara sozinhas.

## Classificação indicativa

O app tem conteúdo social (publicações e comentários entre pessoas) e coleta
dado de saúde. No questionário:

- **Interação entre usuários**: sim — há feed, comentários e seguidores.
- **Compartilhamento de localização**: sim, entre usuários, conforme os
  ajustes de privacidade de cada um.
- **Conteúdo sensível**: não há violência, linguagem adulta ou jogos de azar.
- **Compras no app**: sim — assinatura.

Minha leitura é que isso leva a uma classificação livre ou 12+, dependendo de
como cada loja pesa a interação entre usuários. **Não tenho certeza** e não
quero chutar: responda o questionário com o app aberto na frente.

## Novidades desta versão (primeira publicação)

```
Primeira versão do RUSH RUNNING.
```

## Antes de enviar

- [ ] Revisar a descrição — é promessa, e o app precisa cumprir
- [ ] Regravar as capturas com uma conta que tenha histórico
- [ ] URL da política de privacidade (`/privacidade`) no formulário das duas
- [ ] E-mail de suporte e URL de marketing
- [ ] Classificação indicativa respondida com o app na frente
