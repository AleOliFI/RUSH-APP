// ============================================================
// RUSH PERFORMANCE — Forgot Password & Reset Modal
//
// Fluxo completo de recuperação de senha com código de verificação
// ============================================================

import { useState } from 'react';
import { auth } from '../api';
import { X, Mail, KeyRound, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

export default function ForgotPasswordModal({ isOpen, onClose, onResetSuccess }) {
  const [step, setStep] = useState(1); // 1: Email, 2: Code & New Password, 3: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  if (!isOpen) return null;

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await auth.forgotPassword(email);
      if (res.code) {
        setCode(res.code); // Preenche automaticamente o código gerado para o usuário
        setSuccessInfo(`Código de verificação: ${res.code}`);
      }
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao enviar código de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await auth.resetPassword({
        email,
        code,
        new_password: newPassword,
      });

      setStep(3);
      if (onResetSuccess && res.token) {
        setTimeout(() => {
          onResetSuccess(res);
          onClose();
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Código inválido ou expirado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--auth" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 09 / SEGURANÇA</span>
            <h3 className="modal-title">
              {step === 1 ? 'Recuperar Senha' : step === 2 ? 'Definir Nova Senha' : 'Senha Redefinida!'}
            </h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="auth-error-banner" style={{ marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="text-body" style={{ fontSize: '0.82rem', margin: '0 0 6px' }}>
              Digite seu email de cadastro para receber o código de recuperação.
            </p>

            <div className="input-group">
              <label className="label-mono">SEU EMAIL</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="atleta@rushperformance.com.br"
                  className="input-field"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
              <ArrowRight size={16} />
              <span>{loading ? 'Verificando...' : 'Enviar Código'}</span>
            </button>
          </form>
        )}

        {/* STEP 2: Enter Verification Code and New Password */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {successInfo && (
              <div style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--status-favorable)' }}>
                ✅ {successInfo}
              </div>
            )}

            <div className="input-group">
              <label className="label-mono">CÓDIGO DE 6 DÍGITOS</label>
              <input
                type="text"
                required
                maxLength="6"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', textAlign: 'center', letterSpacing: 4 }}
              />
            </div>

            <div className="input-group">
              <label className="label-mono">NOVA SENHA</label>
              <div className="input-wrapper">
                <KeyRound size={16} className="input-icon" />
                <input
                  type="password"
                  required
                  minLength="6"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input-field"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
              <Sparkles size={16} />
              <span>{loading ? 'Redefinindo...' : 'Salvar Nova Senha'}</span>
            </button>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} color="var(--status-favorable)" style={{ margin: '0 auto 12px' }} />
            <h4 className="heading-md" style={{ margin: '0 0 8px' }}>Senha Atualizada!</h4>
            <p className="text-body" style={{ fontSize: '0.82rem', margin: 0 }}>
              Você já está autenticado e será redirecionado para o painel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
