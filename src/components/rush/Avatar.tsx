// ============================================================
// RUSH RUNNING — Avatar com degradação graciosa
// ------------------------------------------------------------
// Os avatares vêm de URLs que podem falhar (foto removida, CDN fora
// do ar, asset temporário do protótipo). Quando a imagem não carrega,
// em vez de um ícone quebrado mostramos as iniciais do atleta.
// ============================================================

import React, { useEffect, useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  /** Classe aplicada ao fallback de iniciais, para ajustar o tamanho do texto. */
  initialsClassName?: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', initialsClassName = 'text-xs' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`bg-[#262626] border border-[#353534] flex items-center justify-center select-none ${className}`}
        aria-label={name}
        role="img"
      >
        <span className={`font-headline text-[#FF5500] uppercase ${initialsClassName}`}>
          {initialsFrom(name)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
