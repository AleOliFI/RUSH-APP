// ============================================================
// RUSH RUNNING — Preparo de imagens enviadas pelo atleta
// ------------------------------------------------------------
// O backend guarda imagens como string (a mesma convenção já usada
// para o avatar do perfil), então o arquivo escolhido é redimensionado
// e convertido em data URL JPEG antes de subir. Isso mantém o payload
// bem abaixo do limite de 10 MB do express.json.
// ============================================================

/** Maior dimensão permitida após o redimensionamento. */
const MAX_DIMENSION = 1280;
/** Qualidade do JPEG resultante. */
const JPEG_QUALITY = 0.82;
/** Tamanho máximo aceito do arquivo original. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  approxBytes: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido.'));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Valida, redimensiona e comprime a imagem escolhida.
 * Lança Error com mensagem pronta para exibição quando o arquivo é inválido.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('A imagem escolhida passa de 12 MB. Escolha um arquivo menor.');
  }

  const originalDataUrl = await readAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Este navegador não permite processar a imagem.');
  }

  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  return {
    dataUrl,
    width,
    height,
    // Base64 carrega ~4 bytes a cada 3 bytes de dado binário.
    approxBytes: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75),
  };
}
