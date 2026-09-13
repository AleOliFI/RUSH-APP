// ============================================================
// RUSH RUNNING — Assets estáticos do app
// ------------------------------------------------------------
// As URLs originais vinham do CDN temporário do protótipo
// (lh3.googleusercontent.com/aida/...), que é efêmero. Elas foram
// trocadas por arquivos servidos pelo próprio app, em /public/assets.
//
// Os arquivos atuais são gráficos vetoriais neutros (marca, avatar
// genérico, ilustração por tipo de sessão e silhueta de calçado):
// NÃO são as fotos do protótipo — o ambiente de desenvolvimento não
// conseguiu baixá-las antes de o CDN parar de responder. Para usar
// fotos reais, basta substituir os arquivos em /public/assets
// mantendo os mesmos nomes; nenhum código precisa mudar.
//
// Os dados mockados do protótipo (atletas, feed, tênis, comentários,
// treinos) foram removidos: todas as telas agora leem da API.
// ============================================================

export const APP_IMAGES = {
  logo: '/assets/logo.svg',
  headerAvatar: '/assets/avatar-placeholder.svg',
  workoutSprintTrack: '/assets/session-interval.svg',
  marianaActionRunning: '/assets/session-tempo.svg',
  marianaSunlight: '/assets/session-long.svg',
  shoeAlphafly: '/assets/shoe-1.svg',
  shoeSuperblast: '/assets/shoe-2.svg',
  shoeEndorphin: '/assets/shoe-3.svg',
  wornShoeAsics: '/assets/shoe-worn.svg',
};
