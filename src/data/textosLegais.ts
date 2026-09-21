// ============================================================
// RUSH RUNNING — Política de Privacidade e Termos de Uso
// ------------------------------------------------------------
// O conteúdo vive aqui, separado da tela, por dois motivos:
// a tela fica só com apresentação, e um teste consegue cobrar
// que TODA categoria de dado que o app coleta aparece no texto.
// Se alguém adicionar coleta nova sem atualizar a política, o
// teste quebra — que é exatamente quando isso precisa doer.
//
// O levantamento saiu das 36 tabelas de server/database/schema.js,
// não de um modelo pronto de internet.
//
// ⚠️ DUAS COISAS QUE PRECISAM DE VOCÊ, E ESTÃO MARCADAS NO TEXTO:
//    o responsável legal (razão social / CNPJ) e o e-mail de
//    contato do encarregado. Eu não invento identidade jurídica.
//
// ⚠️ E UMA RESSALVA QUE NÃO SAI DAQUI: isto é um rascunho escrito
//    por quem leu o código, não por advogado. Precisa de revisão
//    jurídica antes de ir ao ar — o app trata dado de saúde, que
//    a LGPD classifica como sensível (art. 5º, II).
// ============================================================

/** Marcadores que o dono do app precisa preencher antes de publicar. */
export const PENDENTE_RESPONSAVEL = '[RAZÃO SOCIAL / CNPJ — PREENCHER]';
export const PENDENTE_CONTATO = '[E-MAIL DE CONTATO — PREENCHER]';

export interface SecaoLegal {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
}

export const ATUALIZADO_EM = '21 de setembro de 2026';

export const POLITICA_DE_PRIVACIDADE: SecaoLegal[] = [
  {
    titulo: 'Quem é o responsável',
    paragrafos: [
      `O RUSH RUNNING é operado por ${PENDENTE_RESPONSAVEL}, responsável pelo tratamento dos dados descritos abaixo, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
      `Para qualquer assunto relativo a dados pessoais, inclusive o exercício dos direitos listados no fim desta página, o contato é ${PENDENTE_CONTATO}.`,
    ],
  },
  {
    titulo: 'Dados de cadastro e perfil',
    paragrafos: [
      'São os dados que você mesmo informa ao criar a conta e ao completar o perfil.',
    ],
    itens: [
      'E-mail e senha. A senha nunca é guardada como você a digitou: fica apenas um hash, que não permite recuperá-la.',
      'Nome, nome de usuário, foto, biografia e localidade.',
      'Data de nascimento e gênero — usados para estimar faixas de frequência cardíaca e ajustar a leitura fisiológica.',
      'Peso e altura, quando informados.',
      'Links de Instagram e Strava, quando você os preenche.',
    ],
  },
  {
    titulo: 'Dados de saúde',
    paragrafos: [
      'Esta é a parte central do app, e também a mais sensível. A LGPD classifica dado referente à saúde como dado pessoal sensível (art. 5º, II), e o tratamento aqui se apoia no seu consentimento específico e destacado (art. 11, I).',
    ],
    itens: [
      'Variabilidade da frequência cardíaca (VFC/RMSSD), medida na leitura matinal.',
      'Frequência cardíaca durante as atividades, amostrada batida a batida quando há cinta ou sensor conectado.',
      'Frequência cardíaca máxima e de repouso, medidas ou estimadas.',
      'VO₂máx estimado.',
      'Índices de prontidão e bem-estar calculados a partir do que você registra.',
    ],
  },
  {
    titulo: 'Ciclo menstrual',
    paragrafos: [
      'Se você optar por usar o acompanhamento de ciclo, o app registra as datas e fases informadas e as usa para contextualizar a leitura fisiológica — variações de VFC ao longo do ciclo são esperadas e ignorá-las distorce a prescrição.',
      'Este dado é tratado como de alta sensibilidade. Ele é opcional, é seu, e não é usado para nenhuma finalidade além da leitura fisiológica dentro do app. Ele não é compartilhado com anunciantes, não alimenta publicidade e não é usado para qualquer decisão sobre emprego, crédito ou seguro.',
    ],
  },
  {
    titulo: 'Localização',
    paragrafos: [
      'Durante uma corrida, e apenas enquanto ela está em andamento, o app registra a sua posição por GPS para calcular distância, ritmo e o traçado do percurso.',
      'O traçado fica guardado junto da atividade. Você pode definir zonas de privacidade — regiões, como o entorno da sua casa, cujo traçado é omitido do que outras pessoas veem.',
    ],
  },
  {
    titulo: 'Atividades e treino',
    itens: [
      'Corridas registradas: distância, duração, ritmo, parciais e percepção de esforço.',
      'Planos e sessões de treino, prescritos ou atribuídos.',
      'Calçados cadastrados e a quilometragem acumulada de cada par.',
    ],
  },
  {
    titulo: 'Conteúdo social',
    paragrafos: [
      'Publicações, comentários, curtidas, seguidores, desafios e conquistas. Este conteúdo é, por natureza, visível a outras pessoas do app, conforme os seus ajustes de privacidade.',
      'Os ajustes de privacidade ficam em Ajustes, e controlam o que aparece no seu perfil público: atividades, status de VFC, VO₂máx e conquistas.',
    ],
  },
  {
    titulo: 'Dados de dispositivo',
    itens: [
      'Inscrição de notificações, quando você as autoriza.',
      'Sensores e dispositivos vestíveis que você conecta.',
      'Tokens de sessão, que mantêm você conectado.',
    ],
  },
  {
    titulo: 'Assinatura',
    paragrafos: [
      'Registro da sua assinatura: plano, situação e período de validade. O RUSH não recebe nem armazena número de cartão: o pagamento acontece na loja de aplicativos, que confirma a compra ao app.',
    ],
  },
  {
    titulo: 'Compartilhamento com treinador ou assessoria',
    paragrafos: [
      'Se você se vincular a uma assessoria, o treinador responsável passa a ver os seus dados de treino e a sua leitura fisiológica — incluindo prontidão, VFC e histórico de atividades. É assim que a prescrição funciona.',
      'Esse acesso é consequência direta do vínculo. Se você não quer que um treinador veja esses dados, não se vincule a uma assessoria, ou peça o desvínculo.',
    ],
  },
  {
    titulo: 'Com quem mais os dados são compartilhados',
    paragrafos: [
      'O RUSH não vende dados pessoais e não os compartilha com anunciantes. Há três categorias de terceiros envolvidos na operação:',
    ],
    itens: [
      'Hospedagem e banco de dados — onde o app roda e onde os dados ficam guardados.',
      'Serviço de envio de e-mail — usado apenas para mensagens transacionais, como o código de redefinição de senha.',
      'Serviço de notificações do dispositivo, quando você as autoriza.',
    ],
  },
  {
    titulo: 'Por quanto tempo os dados ficam, e o que acontece ao excluir a conta',
    paragrafos: [
      'Os dados ficam enquanto a sua conta existir.',
      'A exclusão de conta está dentro do app, em Ajustes, e exige a sua senha. É importante ser transparente sobre como ela funciona: a exclusão é lógica. A conta é marcada como excluída, deixa de ser acessível e some do app, mas a linha permanece na base — porque atividades, comentários e vínculos apontam para ela, e apagá-la fisicamente corromperia o histórico de outras pessoas.',
      'Se você quiser a remoção física e definitiva dos seus dados, peça pelo contato indicado no início desta página: é um direito seu previsto na LGPD (art. 18, VI) e será atendido.',
    ],
  },
  {
    titulo: 'Seus direitos',
    paragrafos: [
      'A LGPD (art. 18) garante a você, a qualquer momento:',
    ],
    itens: [
      'Confirmar que existe tratamento dos seus dados e acessá-los.',
      'Corrigir dados incompletos, inexatos ou desatualizados.',
      'Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei.',
      'Pedir a portabilidade dos seus dados. O app já exporta o seu histórico de atividades em CSV.',
      'Revogar o consentimento, inclusive o consentimento específico para dados de saúde.',
      'Ser informado sobre com quem os seus dados foram compartilhados.',
    ],
  },
  {
    titulo: 'Menores de idade',
    paragrafos: [
      'O RUSH não se destina a menores de 13 anos. Entre 13 e 18, o uso depende de consentimento de pelo menos um dos pais ou do responsável legal.',
    ],
  },
  {
    titulo: 'Mudanças nesta política',
    paragrafos: [
      `Esta política pode ser atualizada. A data da última revisão é ${ATUALIZADO_EM}. Mudanças relevantes serão comunicadas dentro do app.`,
    ],
  },
];

export const TERMOS_DE_USO: SecaoLegal[] = [
  {
    titulo: 'O que o RUSH é',
    paragrafos: [
      'O RUSH RUNNING é um app de acompanhamento de treino de corrida. Ele registra atividades, mede variabilidade da frequência cardíaca e sugere ajustes de carga a partir desses números.',
    ],
  },
  {
    titulo: 'O que o RUSH não é',
    paragrafos: [
      'O RUSH não é um dispositivo médico, não faz diagnóstico e não substitui profissional de saúde.',
      'As leituras de prontidão, as faixas de frequência cardíaca e as prescrições de treino são estimativas baseadas nos dados que você fornece. Elas podem estar erradas, e erram mais quando os dados são poucos ou irregulares.',
      'Antes de iniciar ou mudar um programa de treino, consulte um profissional. Se sentir dor no peito, falta de ar desproporcional, tontura ou desmaio, pare e procure atendimento — nenhuma métrica deste app substitui isso.',
    ],
  },
  {
    titulo: 'Sua conta',
    itens: [
      'Você é responsável pelas informações que cadastra e por manter sua senha em segurança.',
      'Uma conta é pessoal. Não a compartilhe.',
      'Você pode excluir sua conta a qualquer momento, em Ajustes.',
    ],
  },
  {
    titulo: 'Conteúdo que você publica',
    paragrafos: [
      'O conteúdo que você publica continua seu. Ao publicá-lo no app, você autoriza que ele seja exibido às outras pessoas conforme os seus ajustes de privacidade.',
      'Não é permitido publicar conteúdo ilegal, ofensivo, ou que exponha dados de terceiros sem autorização.',
    ],
  },
  {
    titulo: 'Assinatura RUSH PRO',
    paragrafos: [
      'Recursos avançados dependem de assinatura. A compra e a renovação acontecem na loja de aplicativos do seu dispositivo, sob as regras dela — inclusive cancelamento e reembolso, que são feitos pela própria loja.',
      'O período de teste gratuito, quando oferecido, é de uso único por conta.',
    ],
  },
  {
    titulo: 'Disponibilidade',
    paragrafos: [
      'O serviço é oferecido como está. Pode haver interrupção para manutenção, falha de terceiros ou motivo fora do nosso controle.',
      'Recomendamos que você não dependa exclusivamente do app como único registro dos seus treinos: a exportação em CSV existe justamente para você manter a sua própria cópia.',
    ],
  },
  {
    titulo: 'Lei aplicável',
    paragrafos: [
      'Estes termos são regidos pela lei brasileira.',
    ],
  },
  {
    titulo: 'Contato',
    paragrafos: [
      `Dúvidas sobre estes termos: ${PENDENTE_CONTATO}.`,
    ],
  },
];
