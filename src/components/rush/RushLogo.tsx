// ============================================================
// RUSH RUNNING — Marca do app
// ------------------------------------------------------------
// Desenho entregue no design system (Kinetic Telemetry): três
// barras inclinadas em degradê de laranja, o wordmark em Anton e
// o selo PRO. Os números aqui são os do arquivo original — as
// coordenadas, as cores e o espaçamento não foram "melhorados".
//
// É um componente, e não um <img src="logo.svg">, por um motivo
// prático: SVG carregado como imagem não enxerga as fontes da
// página, então o wordmark em Anton só sai certo quando o SVG
// está no próprio DOM. A versão em arquivo (public/assets/logo.svg)
// existe para uso externo e carrega a fonte embutida.
// ============================================================

import React from 'react';

interface RushLogoProps {
  /** Classe de tamanho. O padrão serve ao cabeçalho. */
  className?: string;
  /** `false` quando a marca é decorativa e já há texto ao lado. */
  titulo?: boolean;
}

export const RushLogo: React.FC<RushLogoProps> = ({ className = 'h-7 w-auto', titulo = true }) => (
  <svg
    viewBox="0 0 160 48"
    fill="none"
    className={className}
    role={titulo ? 'img' : 'presentation'}
    aria-label={titulo ? 'RUSH PRO' : undefined}
    aria-hidden={titulo ? undefined : true}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 36L28 12H38L22 36H12Z" fill="#FF5500" />
    <path d="M26 36L42 12H52L36 36H26Z" fill="#FF7700" />
    <path d="M40 36L56 12H66L50 36H40Z" fill="#FF9933" />
    <text
      x="74"
      y="32"
      fill="#FFFFFF"
      fontFamily="Anton, Impact, sans-serif"
      fontSize="26"
      fontWeight="900"
      letterSpacing="2"
    >
      RUSH
    </text>
    <text
      x="136"
      y="22"
      fill="#FF5500"
      fontFamily="Anton, Impact, sans-serif"
      fontSize="10"
      fontWeight="700"
    >
      PRO
    </text>
  </svg>
);
