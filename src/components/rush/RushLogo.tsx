// ============================================================
// RUSH RUNNING — Marca do app
// ------------------------------------------------------------
// Desenho original entregue no design system: três barras
// inclinadas em degradê de laranja e o wordmark empilhado —
// RUSH em cima, RUNNING embaixo com tracking largo. As
// coordenadas, as cores e o espaçamento são os do arquivo
// entregue; nada aqui foi "melhorado".
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
    viewBox="0 0 180 48"
    fill="none"
    className={className}
    role={titulo ? 'img' : 'presentation'}
    aria-label={titulo ? 'RUSH RUNNING' : undefined}
    aria-hidden={titulo ? undefined : true}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10 36L26 12H36L20 36H10Z" fill="#FF5500" />
    <path d="M24 36L40 12H50L34 36H24Z" fill="#FF7700" />
    <path d="M38 36L54 12H64L48 36H38Z" fill="#FFAA00" />
    <text
      x="70"
      y="27"
      fill="#FFFFFF"
      fontFamily="Anton, Impact, sans-serif"
      fontSize="20"
      fontWeight="900"
      letterSpacing="1.5"
    >
      RUSH
    </text>
    <text
      x="70"
      y="38"
      fill="#FF5500"
      fontFamily="Anton, Impact, sans-serif"
      fontSize="10"
      fontWeight="700"
      letterSpacing="3"
    >
      RUNNING
    </text>
  </svg>
);
