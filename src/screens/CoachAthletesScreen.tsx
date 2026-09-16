// ============================================================
// RUSH RUNNING — Gestão de atletas da assessoria
// ------------------------------------------------------------
// Dois caminhos para trazer alguém, e eles não são equivalentes:
//
// CONVITE  — só o e-mail. Se a pessoa JÁ tem conta no RUSH e não
//            está em outra assessoria, ela é vinculada na hora,
//            com o histórico dela intacto.
// CADASTRO — o treinador cria a conta pela pessoa, com senha.
//
// Um detalhe que a tela precisa dizer com todas as letras: se o
// e-mail convidado ainda NÃO tem conta, o backend responde
// "pending" — e nada mais acontece. Nenhum e-mail é enviado; não
// há biblioteca de envio no projeto nem tabela de convites
// pendentes. Anunciar "convite enviado" aí seria mentira, e o
// treinador ficaria esperando por uma pessoa que nunca soube.
// ============================================================

import React, { useState } from 'react';
import type { GestaoAtletasData, PainelData } from '../hooks/useAssessoria';

interface CoachAthletesScreenProps {
  painel: PainelData;
  gestao: GestaoAtletasData;
  onVoltar: () => void;
  onConcluido: () => void;
}

type Aba = 'convite' | 'cadastro';

const NIVEIS = [
  { valor: 'beginner', rotulo: 'Iniciante' },
  { valor: 'intermediate', rotulo: 'Intermediário' },
  { valor: 'advanced', rotulo: 'Avançado' },
] as const;

const DISTANCIAS = [5, 10, 21, 42] as const;

const Campo: React.FC<{
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  obrigatorio?: boolean;
  dica?: string;
}> = ({ rotulo, valor, onChange, tipo = 'text', placeholder, obrigatorio, dica }) => (
  <label className="block">
    <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
      {rotulo}
      {obrigatorio && <span className="text-[#FF5500] ml-1">*</span>}
    </span>
    <input
      type={tipo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
    />
    {dica && <span className="text-[9px] text-[#737373] block mt-1">{dica}</span>}
  </label>
);

export const CoachAthletesScreen: React.FC<CoachAthletesScreenProps> = ({
  painel, gestao, onVoltar, onConcluido,
}) => {
  const [aba, setAba] = useState<Aba>('convite');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const [emailConvite, setEmailConvite] = useState('');

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [distancia, setDistancia] = useState<number>(10);
  const [nivel, setNivel] = useState<string>('intermediate');
  const [peso, setPeso] = useState('');
  const [genero, setGenero] = useState('');

  const vagas = painel.vagas;
  const lotado = vagas ? vagas.usadas >= vagas.limite : false;

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    setErroLocal(null);
    gestao.limpar();
  };

  const validarEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const enviarConvite = async () => {
    setErroLocal(null);
    gestao.limpar();
    if (!validarEmail(emailConvite)) {
      setErroLocal('Informe um e-mail válido.');
      return;
    }
    try {
      await gestao.convidar(emailConvite.trim().toLowerCase());
      setEmailConvite('');
      painel.reload();
    } catch { /* gestao.error mostra o motivo */ }
  };

  const enviarCadastro = async () => {
    setErroLocal(null);
    gestao.limpar();

    if (!nome.trim()) { setErroLocal('O nome é obrigatório.'); return; }
    if (!validarEmail(email)) { setErroLocal('Informe um e-mail válido.'); return; }
    if (senha && senha.length < 6) {
      setErroLocal('A senha precisa ter ao menos 6 caracteres.');
      return;
    }

    const pesoNum = peso.trim() ? Number(peso.replace(',', '.')) : null;
    if (pesoNum !== null && (!Number.isFinite(pesoNum) || pesoNum <= 0 || pesoNum > 300)) {
      setErroLocal('Peso inválido.');
      return;
    }

    try {
      await gestao.cadastrar({
        email: email.trim().toLowerCase(),
        password: senha || undefined,
        name: nome.trim(),
        username: usuario.trim().toLowerCase() || undefined,
        distance_km: distancia,
        level: nivel,
        weight_kg: pesoNum,
        gender: genero || undefined,
      });
      setEmail(''); setSenha(''); setNome(''); setUsuario(''); setPeso(''); setGenero('');
      painel.reload();
      onConcluido();
    } catch { /* gestao.error mostra o motivo */ }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] transition-colors cursor-pointer mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Painel</span>
        </button>
        <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
          Assessoria
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          Gestão de atletas
        </h1>
      </div>

      {/* Vagas */}
      {vagas && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2">
          <div className="flex items-end justify-between gap-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
              Vagas do plano
            </span>
            <span className={`font-headline text-xl ${lotado ? 'text-[#EF4444]' : 'text-[#F7F5F3]'}`}>
              {vagas.usadas}<span className="text-[#737373] text-sm">/{vagas.limite}</span>
            </span>
          </div>
          <div className="h-2 bg-[#101010] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${lotado ? 'bg-[#EF4444]' : 'bg-[#FF5500]'}`}
              style={{ width: `${Math.min(100, (vagas.usadas / Math.max(1, vagas.limite)) * 100)}%` }}
            />
          </div>
          {lotado && (
            <p className="text-[10px] text-[#EF4444] leading-relaxed">
              O limite do plano foi atingido. O backend vai recusar novos atletas até o upgrade.
            </p>
          )}
        </div>
      )}

      {/* Abas */}
      <div className="grid grid-cols-2 gap-2">
        {/* `icone:` como campo, e nao como terceiro item de uma tupla:
            o extrator de icones le esse formato, e a tupla ele nao ve.
            Com a tupla, R2.5 passava sem o glifo existir na fonte — e a
            tela mostraria a palavra "mail" no lugar do envelope. */}
        {([
          { chave: 'convite', rotulo: 'Convidar', icone: 'mail' },
          { chave: 'cadastro', rotulo: 'Cadastrar', icone: 'person_add' },
        ] as const).map(
          ({ chave, rotulo, icone }) => (
            <button
              key={chave}
              type="button"
              onClick={() => trocarAba(chave)}
              aria-pressed={aba === chave}
              className={`min-h-[52px] rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                aba === chave
                  ? 'bg-[#1C1C1C] border-[#FF5500]'
                  : 'bg-[#101010] border-[#262626] hover:bg-[#1C1C1C]'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${aba === chave ? 'text-[#FF5500]' : 'text-[#A1A1AA]'}`}>
                {icone}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider ${aba === chave ? 'text-[#F7F5F3]' : 'text-[#A1A1AA]'}`}>
                {rotulo}
              </span>
            </button>
          ),
        )}
      </div>

      {/* Resultado / erro */}
      {gestao.resultado && (
        <div className="bg-[#1C1C1C] border border-[#22C55E] rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{gestao.resultado}</span>
        </div>
      )}
      {(erroLocal || gestao.error) && (
        <div role="alert" className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#EF4444] text-[18px]">error</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{erroLocal || gestao.error}</span>
        </div>
      )}

      {/* ---------- Convite ---------- */}
      {aba === 'convite' && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3.5">
          <div>
            <span className="font-headline text-base text-[#F7F5F3] uppercase block">
              Convidar por e-mail
            </span>
            <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1">
              Se a pessoa já corre com o RUSH, ela é vinculada à sua assessoria na hora — com todo o
              histórico dela preservado.
            </p>
          </div>

          <Campo
            rotulo="E-mail do atleta"
            valor={emailConvite}
            onChange={setEmailConvite}
            tipo="email"
            placeholder="atleta@email.com"
            obrigatorio
          />

          {/* O ponto que não pode ficar implícito. */}
          <div className="bg-[#101010] border border-[#262626] rounded-lg p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-[#FACC15] text-[16px]">warning</span>
            <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
              Se esse e-mail <strong className="text-[#F7F5F3]">ainda não tiver conta</strong> no
              RUSH, nada é enviado: o app não dispara e-mails hoje. Você vai precisar avisar a pessoa
              por fora, ou usar o cadastro direto.
            </p>
          </div>

          <button
            type="button"
            onClick={enviarConvite}
            disabled={gestao.isSaving || lotado}
            className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">send</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
              {gestao.isSaving ? 'Vinculando…' : 'Vincular à assessoria'}
            </span>
          </button>
        </div>
      )}

      {/* ---------- Cadastro ---------- */}
      {aba === 'cadastro' && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3.5">
          <div>
            <span className="font-headline text-base text-[#F7F5F3] uppercase block">
              Cadastro direto
            </span>
            <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1">
              Você cria a conta pelo atleta. Combine a senha com ele e peça que a troque no primeiro
              acesso.
            </p>
          </div>

          <Campo rotulo="Nome" valor={nome} onChange={setNome} placeholder="Marcos Silva" obrigatorio />
          <Campo rotulo="E-mail" valor={email} onChange={setEmail} tipo="email" placeholder="marcos@email.com" obrigatorio />
          <Campo
            rotulo="Senha inicial"
            valor={senha}
            onChange={setSenha}
            tipo="password"
            placeholder="ao menos 6 caracteres"
            dica="Em branco, o backend define uma senha padrão — combine a troca com o atleta."
          />
          <Campo
            rotulo="Usuário"
            valor={usuario}
            onChange={setUsuario}
            placeholder="marcos_silva"
            dica="Opcional: em branco, é gerado a partir do e-mail."
          />

          <div>
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1.5">
              Objetivo
            </span>
            <div className="grid grid-cols-4 gap-2">
              {DISTANCIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistancia(d)}
                  aria-pressed={distancia === d}
                  className={`min-h-[44px] rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                    distancia === d
                      ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                      : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:bg-[#262626]'
                  }`}
                >
                  {d} km
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1.5">
              Nível
            </span>
            <div className="grid grid-cols-3 gap-2">
              {NIVEIS.map((n) => (
                <button
                  key={n.valor}
                  type="button"
                  onClick={() => setNivel(n.valor)}
                  aria-pressed={nivel === n.valor}
                  className={`min-h-[44px] rounded-lg border text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                    nivel === n.valor
                      ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                      : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:bg-[#262626]'
                  }`}
                >
                  {n.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Campo rotulo="Peso (kg)" valor={peso} onChange={setPeso} placeholder="72" />
            <div>
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
                Gênero
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[['male', 'M'], ['female', 'F'], ['other', 'Outro']].map(([v, r]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGenero(genero === v ? '' : v)}
                    aria-pressed={genero === v}
                    className={`min-h-[48px] rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                      genero === v
                        ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                        : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:bg-[#262626]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <span className="text-[9px] text-[#737373] block leading-relaxed">
            Peso e gênero entram no cálculo da FC máxima estimada. Sem eles, as zonas do atleta ficam
            menos precisas até ele fazer um teste de campo.
          </span>

          <button
            type="button"
            onClick={enviarCadastro}
            disabled={gestao.isSaving || lotado}
            className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">person_add</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
              {gestao.isSaving ? 'Cadastrando…' : 'Cadastrar atleta'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
