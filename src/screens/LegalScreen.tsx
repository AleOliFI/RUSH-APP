// ============================================================
// RUSH RUNNING — Privacidade e Termos
// ------------------------------------------------------------
// Tela PÚBLICA, e isso é requisito, não escolha: as duas lojas
// exigem uma URL de política de privacidade que abra sem login.
// Por isso ela não passa por ProtectedRoute nem por PublicRoute
// — este último redireciona quem JÁ está autenticado, o que
// deixaria a página inacessível justamente para quem usa o app.
//
// O conteúdo vem de src/data/textosLegais.ts. Aqui só apresentação.
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RushLogo } from '../components/rush/RushLogo';
import {
  ATUALIZADO_EM,
  POLITICA_DE_PRIVACIDADE,
  SecaoLegal,
  TERMOS_DE_USO,
} from '../data/textosLegais';

interface LegalScreenProps {
  documento: 'privacidade' | 'termos';
}

const Secao: React.FC<{ secao: SecaoLegal }> = ({ secao }) => (
  <section className="space-y-3">
    <h2 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide">{secao.titulo}</h2>
    {secao.paragrafos?.map((p, i) => (
      <p key={i} className="font-body text-sm text-[#A1A1AA] leading-relaxed">
        {p}
      </p>
    ))}
    {secao.itens && (
      <ul className="space-y-2 pl-4">
        {secao.itens.map((item, i) => (
          <li key={i} className="font-body text-sm text-[#A1A1AA] leading-relaxed list-disc">
            {item}
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const LegalScreen: React.FC<LegalScreenProps> = ({ documento }) => {
  const navigate = useNavigate();
  const ehPrivacidade = documento === 'privacidade';
  const secoes = ehPrivacidade ? POLITICA_DE_PRIVACIDADE : TERMOS_DE_USO;

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#F7F5F3]">
      <header className="sticky top-0 z-10 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-[#262626] pt-safe">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <RushLogo className="h-6 w-auto" />
          <nav className="flex items-center gap-1 text-[11px] font-label-caps uppercase tracking-wider">
            <button
              onClick={() => navigate('/privacidade')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                ehPrivacidade ? 'bg-[#FF5500] text-[#0D0D0D] font-bold' : 'text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              Privacidade
            </button>
            <button
              onClick={() => navigate('/termos')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                !ehPrivacidade ? 'bg-[#FF5500] text-[#0D0D0D] font-bold' : 'text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              Termos
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="font-headline text-3xl uppercase tracking-tight">
            {ehPrivacidade ? 'Política de Privacidade' : 'Termos de Uso'}
          </h1>
          <p className="font-telemetry text-[11px] text-[#737373] uppercase tracking-widest">
            Atualizado em {ATUALIZADO_EM}
          </p>
        </div>

        {ehPrivacidade && (
          <div className="rounded-2xl border border-[#FACC15]/40 bg-[#FACC15]/5 p-4">
            <p className="font-body text-[13px] text-[#FACC15] leading-relaxed">
              O RUSH trata dados de saúde — variabilidade cardíaca, frequência cardíaca e, se você
              escolher usá-lo, o acompanhamento de ciclo menstrual. A LGPD classifica esses dados como
              sensíveis. Esta página descreve, sem rodeio, o que é coletado e para quê.
            </p>
          </div>
        )}

        {secoes.map((secao) => (
          <Secao key={secao.titulo} secao={secao} />
        ))}

        <footer className="pt-6 border-t border-[#262626]">
          <button
            onClick={() => navigate('/')}
            className="font-label-caps text-[11px] uppercase tracking-wider text-[#FF5500] hover:text-[#FF6B00] cursor-pointer"
          >
            ← Voltar ao app
          </button>
        </footer>
      </main>
    </div>
  );
};
