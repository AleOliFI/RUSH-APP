// ============================================================
// RUSH RUNNING — Exportação do histórico em CSV
// Gera o arquivo no cliente a partir das atividades já carregadas
// e dispara o download via Blob.
// ============================================================

const COLUMNS = [
  'data',
  'titulo',
  'tipo',
  'distancia_km',
  'duracao_segundos',
  'pace_medio',
  'fc_media',
  'fc_maxima',
  'pse',
  'status_vfc',
  'privacidade',
] as const;

/** Escapa um valor para CSV (aspas duplas conforme RFC 4180). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function activitiesToCsv(activities: any[]): string {
  const header = COLUMNS.join(';');
  const rows = activities.map((a) =>
    [
      a.date,
      a.title,
      a.type,
      a.distance_km,
      a.duration_seconds,
      a.avg_pace,
      a.avg_hr,
      a.max_hr,
      a.rpe_score ?? a.rpe,
      a.hrv_status_display,
      a.privacy,
    ]
      .map(escapeCell)
      .join(';'),
  );
  // BOM para que o Excel reconheça acentuação em UTF-8.
  return `﻿${header}\n${rows.join('\n')}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
