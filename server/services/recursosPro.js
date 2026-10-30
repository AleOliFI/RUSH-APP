// ============================================================
// RUSH RUNNING — O que a assinatura RUSH PRO compra
// ------------------------------------------------------------
// Até aqui `is_pro` era calculado, informado ao cliente... e nunca
// cobrado. Nenhuma rota exigia assinatura e nenhuma tela escondia
// nada: quem pagava comprava um selo laranja no perfil. A conta
// grátis usava o aplicativo inteiro.
//
// ONDE PASSA A LINHA, E POR QUÊ
//
// Fica de GRAÇA o ciclo de treino inteiro, e por três razões que não
// são de marketing:
//
//   Saúde. A medição de VFC, a prontidão do dia e a recomendação que
//   vem com ela ("seu corpo não está pronto") não se cobram. Cobrar
//   por isso é cobrar para avisar alguém que ele não deveria treinar
//   forte hoje.
//
//   Direito sobre os próprios dados. Exportar o histórico e excluir
//   a conta nunca ficam atrás de pagamento — é exigência da LGPD,
//   não cortesia.
//
//   O que a pessoa já comprou. Sensores Bluetooth e os tênis da
//   garagem são dela. O app não cobra para falar com o hardware
//   dela.
//
// Também é grátis tudo que o treinador prescreve: quem paga a
// assessoria já pagou, e o atleta não pode ficar sem ver o próprio
// plano.
//
// Fica PAGO o que é análise de laboratório — números que não mudam o
// treino de hoje, mas explicam a temporada:
//
//   VO₂ máx estimado e sua tendência
//   Carga aguda:crônica (ACWR)
//   A série longa de VFC (além de uma semana)
//   O protocolo de campo, que troca zonas estimadas por idade pelas
//     zonas medidas da pessoa
//   A arte 9:16 para publicar nas redes
//
// Quem não assina continua treinando, medindo e vendo a prontidão de
// hoje — só não vê a análise que olha para trás.
// ============================================================

/**
 * Os recursos pagos, com o texto que a pessoa lê quando esbarra em
 * um deles. O mesmo texto vai na resposta da API e na tela: dois
 * textos diferentes para a mesma porta confundem quem bate nela.
 */
const RECURSOS_PRO = {
  vo2max: {
    titulo: 'VO₂ máximo estimado',
    explicacao:
      'A estimativa de VO₂ máximo e a tendência dela ao longo das semanas fazem parte do RUSH PRO.',
  },
  carga_de_treino: {
    titulo: 'Carga aguda:crônica',
    explicacao:
      'A razão entre a carga das últimas semanas e a dos últimos meses — e o alerta de sobrecarga — fazem parte do RUSH PRO.',
  },
  protocolo_de_campo: {
    titulo: 'Protocolo de campo',
    explicacao:
      'O teste de campo substitui as zonas estimadas pela sua idade pelas zonas medidas no seu corpo. Faz parte do RUSH PRO.',
  },
  serie_de_vfc: {
    titulo: 'Série longa de variabilidade',
    explicacao:
      'Sem assinatura, o histórico de VFC mostra os últimos 7 dias. A série completa faz parte do RUSH PRO.',
  },
  arte_para_redes: {
    titulo: 'Arte 9:16 para redes',
    explicacao:
      'A arte da corrida no formato de story faz parte do RUSH PRO.',
  },
};

/** Quantos dias de histórico de VFC uma conta sem assinatura vê. */
const DIAS_DE_VFC_SEM_ASSINATURA = 7;

/**
 * Código devolvido pela API quando a porta está fechada.
 *
 * O cliente decide pelo CÓDIGO, não pelo texto: mudar a redação da
 * mensagem não pode quebrar a tela que mostra o convite para assinar.
 */
const CODIGO_SEM_ASSINATURA = 'assinatura_necessaria';

module.exports = {
  RECURSOS_PRO,
  DIAS_DE_VFC_SEM_ASSINATURA,
  CODIGO_SEM_ASSINATURA,
};
