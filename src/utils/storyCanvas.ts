// ============================================================
// RUSH RUNNING — Render do story 9:16
// ------------------------------------------------------------
// Desenha de fato a arte 1080x1920 num canvas: foto de fundo
// (quando houver), gradiente, marca d'água e o cartão de telemetria
// com os números da atividade escolhida. O resultado é um PNG real,
// não a foto original renomeada.
// ============================================================

export interface StoryData {
  title: string;
  distanceKm: number;
  duration: string;
  avgPace: string;
  avgHr: number | null;
  dateLabel: string;
  shoeName?: string | null;
  locationLabel?: string | null;
}

export interface StoryOptions {
  accentColor: string;
  backgroundImageUrl?: string | null;
  showHr: boolean;
  showShoe: boolean;
}

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Necessário para não "sujar" o canvas quando a imagem vem de outra origem.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem de fundo.'));
    img.src = src;
  });
}

/** Desenha um retângulo arredondado no contexto. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cobre o canvas com a imagem preservando proporção (object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
  const scale = Math.max(STORY_WIDTH / img.width, STORY_HEIGHT / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (STORY_WIDTH - w) / 2, (STORY_HEIGHT - h) / 2, w, h);
}

/**
 * Renderiza o story e devolve o canvas pronto.
 * Fontes personalizadas podem não estar carregadas no momento do desenho;
 * por isso as famílias vêm com fallback de sistema.
 */
export async function renderStoryCanvas(
  data: StoryData,
  options: StoryOptions,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não permite gerar a imagem.');

  // Fundo
  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  if (options.backgroundImageUrl) {
    try {
      const img = await loadImage(options.backgroundImageUrl);
      drawCover(ctx, img);
    } catch {
      // Segue com o fundo sólido quando a foto não carrega.
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#0D0D0D');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  }

  // Escurecimento para o texto ficar legível sobre qualquer foto
  const shade = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0.15)');
  shade.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Marca d'água — largura calculada a partir do texto realmente medido,
  // porque as fontes personalizadas podem não estar disponíveis no canvas.
  const badgeH = 76;
  const badgeY = 90;
  const badgeX = 60;
  const padX = 34;
  const dotRadius = 10;
  const gap = 18;

  ctx.textBaseline = 'middle';
  ctx.font = '700 34px Anton, Impact, sans-serif';
  const brandWidth = ctx.measureText('RUSH PRO').width;
  ctx.font = '600 24px "JetBrains Mono", monospace';
  const tagWidth = ctx.measureText('TELEMETRY').width;

  const badgeW = padX + dotRadius * 2 + gap + brandWidth + gap + tagWidth + padX;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const badgeMidY = badgeY + badgeH / 2;
  let cursorX = badgeX + padX;

  ctx.fillStyle = options.accentColor;
  ctx.beginPath();
  ctx.arc(cursorX + dotRadius, badgeMidY, dotRadius, 0, Math.PI * 2);
  ctx.fill();
  cursorX += dotRadius * 2 + gap;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 34px Anton, Impact, sans-serif';
  ctx.fillText('RUSH PRO', cursorX, badgeMidY + 2);
  cursorX += brandWidth + gap;

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText('TELEMETRY', cursorX, badgeMidY + 2);

  // Métricas definidas antes do cartão para dimensioná-lo pelo conteúdo.
  const metrics: { label: string; value: string; accent?: boolean }[] = [
    { label: 'DISTÂNCIA', value: `${data.distanceKm.toFixed(2)} km` },
    { label: 'TEMPO', value: data.duration },
    { label: 'RITMO', value: data.avgPace, accent: true },
  ];
  if (options.showHr && data.avgHr) {
    metrics.push({ label: 'FC MÉDIA', value: `${data.avgHr} bpm` });
  }

  const cols = 2;
  const rows = Math.ceil(metrics.length / cols);
  const metricRowH = 140;

  const cardX = 60;
  const cardW = STORY_WIDTH - 120;
  const hasFooter = !!(data.locationLabel || (options.showShoe && data.shoeName));
  const cardH = 170 + rows * metricRowH + (hasFooter ? 90 : 30);
  const cardY = STORY_HEIGHT - cardH - 190;

  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  roundedRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Título da sessão
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 46px Anton, Impact, sans-serif';
  ctx.textBaseline = 'top';
  const title = data.title.toUpperCase();
  const maxTitleWidth = cardW - 100;
  let renderedTitle = title;
  while (ctx.measureText(renderedTitle).width > maxTitleWidth && renderedTitle.length > 4) {
    renderedTitle = renderedTitle.slice(0, -2);
  }
  if (renderedTitle !== title) renderedTitle += '…';
  ctx.fillText(renderedTitle, cardX + 50, cardY + 46);

  ctx.fillStyle = options.accentColor;
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillText(data.dateLabel.toUpperCase(), cardX + 50, cardY + 108);

  // Métricas em duas colunas, com o valor reduzido se não couber na célula.
  const cellW = (cardW - 100) / cols;

  metrics.forEach((metric, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cardX + 50 + col * cellW;
    const y = cardY + 170 + row * metricRowH;

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(metric.label, x, y);

    ctx.fillStyle = metric.accent ? options.accentColor : '#FFFFFF';
    let valueSize = 62;
    const maxValueWidth = cellW - 30;
    ctx.font = `700 ${valueSize}px Anton, Impact, sans-serif`;
    while (ctx.measureText(metric.value).width > maxValueWidth && valueSize > 30) {
      valueSize -= 2;
      ctx.font = `700 ${valueSize}px Anton, Impact, sans-serif`;
    }
    ctx.fillText(metric.value, x, y + 36);
  });

  // Rodapé do cartão
  if (hasFooter) {
    const footerY = cardY + cardH - 62;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 50, footerY - 22);
    ctx.lineTo(cardX + cardW - 50, footerY - 22);
    ctx.stroke();

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    if (data.locationLabel) {
      ctx.fillText(data.locationLabel, cardX + 50, footerY);
    }
    if (options.showShoe && data.shoeName) {
      ctx.textAlign = 'right';
      ctx.fillText(data.shoeName, cardX + cardW - 50, footerY);
      ctx.textAlign = 'left';
    }
  }

  return canvas;
}

/** Converte o canvas em Blob PNG. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar o arquivo de imagem.'));
    }, 'image/png');
  });
}
