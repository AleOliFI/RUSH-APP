// ============================================================
// RUSH PERFORMANCE — Login & Register Page
// Editorial sports aesthetic matching rushperformance.com.br
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function Login({ mode: initialMode = 'login' }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password);
        if (loggedUser?.has_onboarding) {
          navigate('/');
        } else {
          navigate('/onboarding');
        }
      } else {
        const newUser = await register({ email, password, name, username });
        if (newUser?.has_onboarding) {
          navigate('/');
        } else {
          navigate('/onboarding');
        }
      }
    } catch (err) {
      setError(err.message || 'Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  const selectTestAccount = (accEmail) => {
    setEmail(accEmail);
    setPassword('123456');
    setError('');
  };

  return (
    <div className="onboarding">
      <div className="onboarding-content">
        {/* Brand Editorial Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div className="flex items-center justify-center gap-sm mb-sm">
            <span className="live-dot" />
            <span className="label-mono">№ 01 / AUTHENTICATION</span>
          </div>

          <h1 className="display-massive text-gradient" style={{ marginBottom: 2 }}>
            RUSH
          </h1>
          <p className="label-mono" style={{ letterSpacing: '0.24em', color: 'var(--text-secondary)' }}>
            SPORT PERFORMANCE
          </p>
          <p className="text-body" style={{ marginTop: 12, fontSize: '0.88rem' }}>
            {mode === 'login'
              ? 'Treine mais forte quando seu corpo permitir.'
              : 'Junte-se à elite da corrida guiada por VFC.'}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={`tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Criar Conta
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <label className="input-label" htmlFor="register-name">Nome Completo</label>
                <input
                  id="register-name"
                  className="input"
                  type="text"
                  placeholder="Ex: Alessandro Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="register-username">Nome de Usuário (@)</label>
                <input
                  id="register-username"
                  className="input"
                  type="text"
                  placeholder="alessandro_run"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="atleta@rush.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="login-password">Senha de Acesso</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Ocultar senha' : 'Exibir senha'}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--status-recovery-bg)',
                border: '1px solid rgba(255, 59, 92, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--status-recovery)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            id="login-submit"
            style={{ marginTop: 6 }}
          >
            {loading ? (
              'Acessando...'
            ) : mode === 'login' ? (
              <>
                Entrar na Plataforma <ArrowRight size={18} />
              </>
            ) : (
              <>
                Concluir Cadastro <Zap size={18} />
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Editorial Box */}
        {mode === 'login' && (
          <div
            className="card"
            style={{
              marginTop: 26,
              padding: '16px 18px',
              background: 'linear-gradient(180deg, #181818 0%, #121212 100%)',
            }}
          >
            <div className="flex items-center justify-between mb-sm">
              <span className="label-mono">№ 01 / CONTAS DE TESTE (DEMO)</span>
              <ShieldCheck size={14} color="var(--accent-primary)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {[
                { role: 'Owner', email: 'alessandro@rush.com' },
                { role: 'Coach', email: 'coach@rush.com' },
                { role: 'Atleta (10K)', email: 'maria@email.com' },
                { role: 'Atleta (21K)', email: 'pedro@email.com' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => selectTestAccount(acc.email)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {acc.role}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.email}
                  </div>
                </button>
              ))}
            </div>

            <p className="label-mono" style={{ marginTop: 10, fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              SENHA PADRÃO: <span style={{ color: 'var(--text-primary)' }}>123456</span>
            </p>
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onResetSuccess={(res) => {
          if (res?.user?.has_onboarding) {
            navigate('/');
          } else {
            navigate('/onboarding');
          }
        }}
      />
    </div>
  );
}
