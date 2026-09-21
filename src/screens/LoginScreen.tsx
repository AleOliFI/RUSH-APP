// ============================================================
// RUSH RUNNING — Entrada e cadastro
// ------------------------------------------------------------
// Redesenhado no design system novo (Anton/Manrope, #FF5500),
// preservando todo o comportamento anterior: login, cadastro,
// recuperação de senha em três passos e as contas de demonstração.
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../api';
import { RushLogo } from '../components/rush/RushLogo';

interface LoginScreenProps {
  mode?: 'login' | 'register';
  onLogin: (email: string, password: string) => Promise<any>;
  onRegister: (payload: { email: string; password: string; name: string; username: string }) => Promise<any>;
}

const DEMO_ACCOUNTS = [
  { role: 'Owner', email: 'alessandro@rush.com' },
  { role: 'Coach', email: 'coach@rush.com' },
  { role: 'Atleta 10K', email: 'maria@email.com' },
  { role: 'Atleta 21K', email: 'pedro@email.com' },
];

type RecoveryStep = 'closed' | 'request' | 'reset' | 'done';

export const LoginScreen: React.FC<LoginScreenProps> = ({ mode: initialMode = 'login', onLogin, onRegister }) => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Recuperação de senha
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('closed');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const goAfterAuth = (user: any) => {
    navigate(user?.has_onboarding ? '/' : '/onboarding');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        goAfterAuth(await onLogin(email, password));
      } else {
        goAfterAuth(await onRegister({ email, password, name, username }));
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError('');
    setRecoveryNotice('');

    try {
      const res = await authApi.forgotPassword(recoveryEmail.trim());
      // Em ambiente local o backend devolve o código para facilitar o teste.
      setRecoveryNotice(
        res?.code
          ? `Código gerado: ${res.code}. Em produção ele é enviado por email.`
          : 'Código enviado para o seu email.',
      );
      setRecoveryStep('reset');
    } catch (err: any) {
      setRecoveryError(err?.message || 'Não foi possível gerar o código.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError('');

    if (recoveryNewPassword.length < 6) {
      setRecoveryError('A nova senha deve ter pelo menos 6 caracteres.');
      setRecoveryLoading(false);
      return;
    }

    try {
      const res = await authApi.resetPassword({
        email: recoveryEmail.trim(),
        code: recoveryCode.trim(),
        new_password: recoveryNewPassword,
      });
      setRecoveryStep('done');
      setRecoveryNotice(res?.message || 'Senha redefinida com sucesso!');
      setEmail(recoveryEmail.trim());
      setPassword('');
    } catch (err: any) {
      setRecoveryError(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const closeRecovery = () => {
    setRecoveryStep('closed');
    setRecoveryCode('');
    setRecoveryNewPassword('');
    setRecoveryError('');
    setRecoveryNotice('');
  };

  const inputClass =
    'w-full h-12 rounded-xl bg-[#101010] border border-[#262626] px-4 text-sm text-[#F7F5F3] placeholder-[#525252] focus:outline-none focus:border-[#FF5500] transition-colors';
  const labelClass = 'font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1.5';

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#e5e2e1] flex flex-col items-center justify-center px-5 py-10 selection:bg-[#FF5500] selection:text-[#0D0D0D]">
      <div className="w-full max-w-md space-y-6">
        {/* Marca */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse" />
            <span className="font-label-sm text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold">
              Nº 01 / AUTENTICAÇÃO
            </span>
          </div>

          <div className="flex items-center justify-center">
            <RushLogo className="h-14 w-auto" />
          </div>

          <p className="font-telemetry text-[11px] text-[#A1A1AA] uppercase tracking-[0.24em]">
            SPORT PERFORMANCE
          </p>
          <p className="font-body text-sm text-[#737373] pt-1">
            {mode === 'login'
              ? 'Treine mais forte quando seu corpo permitir.'
              : 'Junte-se à corrida guiada por variabilidade cardíaca.'}
          </p>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1.5 bg-[#1C1C1C] p-1 rounded-xl border border-[#262626]">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setError('');
              }}
              className={`flex-1 min-h-[44px] py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                mode === tab ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md' : 'text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              {tab === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className={labelClass} htmlFor="register-name">
                  Nome completo
                </label>
                <input
                  id="register-name"
                  className={inputClass}
                  type="text"
                  placeholder="Ex.: Alessandro Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="register-username">
                  Nome de usuário
                </label>
                <input
                  id="register-username"
                  className={`${inputClass} font-telemetry`}
                  type="text"
                  placeholder="alessandro_run"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className={labelClass} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className={inputClass}
              type="email"
              placeholder="atleta@rush.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="login-password">
              Senha de acesso
            </label>
            <div className="relative">
              <input
                id="login-password"
                className={`${inputClass} pr-12`}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#F7F5F3] flex items-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPw ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(email);
                  setRecoveryStep('request');
                }}
                className="font-telemetry text-[11px] text-[#FF5500] hover:underline cursor-pointer"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3 flex items-center gap-2.5"
            >
              <span className="material-symbols-outlined text-[#EF4444] text-[18px] shrink-0">error</span>
              <span className="text-xs text-[#e5e2e1]">{error}</span>
            </div>
          )}

          <button
            type="submit"
            id="login-submit"
            disabled={loading}
            className="w-full min-h-[54px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait active:scale-[0.99] text-[#0D0D0D] font-headline text-lg uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,85,0,0.35)] transition-all cursor-pointer"
          >
            <span>
              {loading ? 'Acessando…' : mode === 'login' ? 'Entrar na plataforma' : 'Concluir cadastro'}
            </span>
            <span className="material-symbols-outlined text-[22px]">
              {mode === 'login' ? 'arrow_forward' : 'bolt'}
            </span>
          </button>
        </form>

        {/* Contas de demonstração */}
        {mode === 'login' && (
          <div className="bg-[#141414] rounded-2xl border border-[#262626] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
                Nº 01 / CONTAS DE DEMONSTRAÇÃO
              </span>
              <span className="material-symbols-outlined text-[#FF5500] text-[16px]">verified_user</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('123456');
                    setError('');
                  }}
                  className="bg-[#1C1C1C] border border-[#262626] hover:border-[#FF5500] rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer"
                >
                  <span className="block text-[11px] font-extrabold text-[#FF5500]">{acc.role}</span>
                  <span className="block text-[10px] text-[#A1A1AA] truncate font-telemetry">{acc.email}</span>
                </button>
              ))}
            </div>

            <p className="font-telemetry text-[10px] text-[#737373] text-center">
              SENHA PADRÃO: <span className="text-[#F7F5F3]">123456</span>
            </p>
          </div>
        )}
      </div>

      {/* Recuperação de senha */}
      {recoveryStep !== 'closed' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovery-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/90 backdrop-blur-md"
        >
          <div className="w-full max-w-sm bg-[#0D0D0D] rounded-3xl border border-[#FF5500]/50 p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-label-sm text-[10px] text-[#FF5500] uppercase tracking-widest block">
                  RECUPERAÇÃO DE ACESSO
                </span>
                <h2 id="recovery-title" className="font-headline text-xl text-[#F7F5F3] uppercase">
                  {recoveryStep === 'request'
                    ? 'Redefinir senha'
                    : recoveryStep === 'reset'
                      ? 'Informe o código'
                      : 'Senha alterada'}
                </h2>
              </div>
              <button
                onClick={closeRecovery}
                aria-label="Fechar recuperação de senha"
                className="w-9 h-9 shrink-0 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {recoveryNotice && (
              <p className="text-xs text-[#22C55E] leading-relaxed bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl px-3 py-2.5">
                {recoveryNotice}
              </p>
            )}
            {recoveryError && (
              <p className="text-xs text-[#EF4444] font-bold" role="alert">
                {recoveryError}
              </p>
            )}

            {recoveryStep === 'request' && (
              <form onSubmit={handleRequestCode} className="space-y-3">
                <div>
                  <label className={labelClass} htmlFor="recovery-email">
                    Email da conta
                  </label>
                  <input
                    id="recovery-email"
                    className={inputClass}
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full h-12 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 text-[#0D0D0D] font-headline text-sm uppercase tracking-wider cursor-pointer"
                >
                  {recoveryLoading ? 'Gerando…' : 'Gerar código'}
                </button>
              </form>
            )}

            {recoveryStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className={labelClass} htmlFor="recovery-code">
                    Código de 6 dígitos
                  </label>
                  <input
                    id="recovery-code"
                    className={`${inputClass} font-telemetry tracking-[0.3em]`}
                    inputMode="numeric"
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="recovery-password">
                    Nova senha
                  </label>
                  <input
                    id="recovery-password"
                    className={inputClass}
                    type="password"
                    minLength={6}
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full h-12 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 text-[#0D0D0D] font-headline text-sm uppercase tracking-wider cursor-pointer"
                >
                  {recoveryLoading ? 'Salvando…' : 'Redefinir senha'}
                </button>
              </form>
            )}

            {recoveryStep === 'done' && (
              <button
                onClick={closeRecovery}
                className="w-full h-12 rounded-xl bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] font-headline text-sm uppercase tracking-wider cursor-pointer"
              >
                Voltar para o login
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
