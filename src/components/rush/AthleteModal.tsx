// ============================================================
// RUSH RUNNING — Passaporte biométrico e edição de perfil
// ------------------------------------------------------------
// Substitui o seletor de contas do protótipo: existe um único
// atleta autenticado, então aqui ele edita os próprios dados
// (nome, usuário, bio, local, peso, altura e foto) e sai da conta.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { AthleteProfile, ImageViewerItem } from '../../types';
import { downloadImageToDevice } from '../../utils/imageDownload';
import { prepareImageForUpload } from '../../utils/imageUpload';
import { users } from '../../api';

interface AthleteModalProps {
  currentAthlete: AthleteProfile;
  isOpen: boolean;
  /** Perfil cru vindo de GET /api/users/profile, com peso e altura. */
  profile: any;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onLogout: () => void;
  onViewImage?: (item: ImageViewerItem) => void;
}

export const AthleteModal: React.FC<AthleteModalProps> = ({
  currentAthlete,
  isOpen,
  profile,
  onClose,
  onSaved,
  onLogout,
  onViewImage,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    username: '',
    bio: '',
    location: '',
    weight_kg: '',
    height_cm: '',
    avatar_url: '' as string | null,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setError(null);
      return;
    }
    setForm({
      name: profile?.name || currentAthlete.name || '',
      username: profile?.username || currentAthlete.handle.replace('@', ''),
      bio: profile?.bio || '',
      location: profile?.location || '',
      weight_kg: profile?.weight_kg != null ? String(profile.weight_kg) : '',
      height_cm: profile?.height_cm != null ? String(profile.height_cm) : '',
      avatar_url: profile?.avatar_url || currentAthlete.avatarUrl || null,
    });
  }, [isOpen, profile, currentAthlete]);

  if (!isOpen) return null;

  const handleDownloadPhoto = async (e: React.MouseEvent, athlete: AthleteProfile) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(athlete.id);
    const filename = `rush-running-atleta-${athlete.name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`;
    await downloadImageToDevice(athlete.avatarUrl, filename);
    setDownloadingId(null);
  };

  const handleViewPhoto = (e: React.MouseEvent, athlete: AthleteProfile) => {
    e.stopPropagation();
    if (onViewImage) {
      onViewImage({
        url: athlete.avatarUrl,
        title: `${athlete.name} (${athlete.category})`,
        subtitle: athlete.quote,
        category: 'PASSAPORTE BIOMÉTRICO DO ATLETA',
        filename: `rush-running-atleta-${athlete.name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.png`,
        description: `VO2 Máx: ${athlete.vo2Max} mL/kg/min, Frequência de Repouso: ${athlete.restingHR} BPM, Limiar: ${athlete.thresholdPace}.`,
      });
    }
  };

  const handlePickAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setForm((prev) => ({ ...prev, avatar_url: prepared.dataUrl }));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível preparar a imagem.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('O nome não pode ficar vazio.');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/i.test(form.username.trim())) {
      setError('O usuário deve ter de 3 a 30 caracteres, apenas letras, números ou _.');
      return;
    }
    const weight = form.weight_kg ? Number(form.weight_kg) : null;
    const height = form.height_cm ? Number(form.height_cm) : null;
    if (weight != null && (!isFinite(weight) || weight < 30 || weight > 250)) {
      setError('O peso deve ficar entre 30 e 250 kg.');
      return;
    }
    if (height != null && (!isFinite(height) || height < 100 || height > 250)) {
      setError('A altura deve ficar entre 100 e 250 cm.');
      return;
    }

    setIsSaving(true);
    try {
      await users.updateProfile({
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim() || null,
        location: form.location.trim() || null,
        weight_kg: weight,
        height_cm: height,
        avatar_url: form.avatar_url,
      });
      await onSaved();
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1C1C1C] border border-[#262626] w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#FF5500] text-[22px]">badge</span>
            <div>
              <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
                PERFIL DO ATLETA
              </span>
              <h2 className="font-headline-sm text-[#F7F5F3] uppercase">
                PASSAPORTE BIOMÉTRICO
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#101010] text-[#737373] hover:text-[#FF5500] flex items-center justify-center cursor-pointer border border-[#262626]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Current Active Athlete Showcase */}
        <div className="bg-[#101010] p-4 rounded-xl border border-[#FF5500]/40 flex flex-col space-y-3">
          <div className="flex items-center space-x-4">
            <div 
              className="relative flex-shrink-0 cursor-pointer group"
              onClick={(e) => handleViewPhoto(e, currentAthlete)}
              title="Clique para visualizar em alta resolução"
            >
              <img
                alt={currentAthlete.name}
                className="w-16 h-16 rounded-xl object-cover ring-2 ring-[#FF5500] shadow-[0_0_12px_rgba(255,85,0,0.4)] group-hover:brightness-110 transition-all"
                src={currentAthlete.avatarUrl}
              />
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="material-symbols-outlined text-white text-[20px]">zoom_in</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#22C55E] ring-2 ring-[#101010]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-headline-sm text-[#F7F5F3] truncate">{currentAthlete.name}</span>
                <span className="px-1.5 py-0.2 bg-[#FF5500] text-[#0D0D0D] font-telemetry text-[10px] rounded uppercase font-extrabold">
                  {currentAthlete.category}
                </span>
              </div>
              <p className="font-body text-xs text-[#737373] mt-0.5">{currentAthlete.quote}</p>
              <span className="font-telemetry text-[11px] text-[#22C55E] font-bold mt-1 inline-block">
                {currentAthlete.statusText}
              </span>
            </div>
          </div>

          {/* Action buttons for Active Athlete's Photo */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#202020]">
            <button
              onClick={(e) => handleViewPhoto(e, currentAthlete)}
              className="flex-1 h-8 rounded bg-[#1C1C1C] hover:bg-[#262626] border border-[#333] text-[#F7F5F3] text-[11px] font-label-caps uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-[#FF5500]">visibility</span>
              <span>Visualizar Foto</span>
            </button>
            <button
              onClick={(e) => handleDownloadPhoto(e, currentAthlete)}
              disabled={downloadingId === currentAthlete.id}
              className="flex-1 h-8 rounded bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] text-[11px] font-label-caps font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Salvar foto deste atleta no seu dispositivo"
            >
              <span className="material-symbols-outlined text-[15px]">
                {downloadingId === currentAthlete.id ? 'progress_activity' : 'download'}
              </span>
              <span>
                {downloadingId === currentAthlete.id ? 'Baixando...' : 'Baixar Foto'}
              </span>
            </button>
          </div>
        </div>

        {/* Athlete Biometric Baseline Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[#141414] p-3 rounded-lg border border-[#262626] text-center">
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">VO2 MÁX</span>
            <div className="font-headline-sm text-[#F7F5F3] mt-0.5">{currentAthlete.vo2Max}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">mL/kg/min</span>
          </div>
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">RHR REPOUSO</span>
            <div className="font-headline-sm text-[#FF5500] mt-0.5">{currentAthlete.restingHR}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">BPM</span>
          </div>
          <div>
            <span className="font-label-caps text-[9px] text-[#737373] uppercase font-bold">LIMIAR PACE</span>
            <div className="font-headline-sm text-[#22C55E] mt-0.5">{currentAthlete.thresholdPace}</div>
            <span className="font-label-sm text-[9px] text-[#737373]">min/km</span>
          </div>
        </div>

        {/* Edição do perfil */}
        {!isEditing ? (
          <div className="space-y-2 pt-1">
            <button
              onClick={() => setIsEditing(true)}
              className="w-full h-11 rounded-lg bg-[#101010] hover:bg-[#1C1C1C] border border-[#333] text-[#F7F5F3] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#FF5500]">edit</span>
              <span>Editar meus dados</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full h-11 rounded-lg bg-transparent hover:bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Sair da conta</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3 pt-1">
            <span className="font-label-caps text-[10px] text-[#737373] uppercase font-bold tracking-wider block">
              EDITAR PERFIL
            </span>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickAvatar} className="hidden" />

            <div className="flex items-center gap-3">
              <img
                src={form.avatar_url || currentAthlete.avatarUrl}
                alt="Foto do perfil"
                className="w-14 h-14 rounded-xl object-cover border border-[#333]"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 h-10 rounded-lg bg-[#101010] hover:bg-[#1C1C1C] border border-[#333] text-[#F7F5F3] text-[11px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Trocar foto
              </button>
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-name" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                Nome
              </label>
              <input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-username" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                Usuário
              </label>
              <input
                id="profile-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-bio" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                Bio
              </label>
              <textarea
                id="profile-bio"
                rows={2}
                maxLength={280}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full rounded-lg bg-[#101010] border border-[#262626] p-3 text-xs text-[#F7F5F3] resize-none focus:outline-none focus:border-[#FF5500]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-location" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                Local
              </label>
              <input
                id="profile-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Cidade, UF"
                className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] focus:outline-none focus:border-[#FF5500]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="profile-weight" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                  Peso (kg)
                </label>
                <input
                  id="profile-weight"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={form.weight_kg}
                  onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                  className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="profile-height" className="font-label-sm text-[10px] text-[#737373] uppercase block">
                  Altura (cm)
                </label>
                <input
                  id="profile-height"
                  type="number"
                  inputMode="numeric"
                  value={form.height_cm}
                  onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                  className="w-full h-10 rounded-lg bg-[#101010] border border-[#262626] px-3 text-xs text-[#F7F5F3] font-telemetry focus:outline-none focus:border-[#FF5500]"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#EF4444] font-bold" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-11 px-4 rounded-lg bg-[#101010] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3] text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 h-11 rounded-lg bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait text-[#0D0D0D] text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                {isSaving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full h-12 bg-[#262626] hover:bg-[#333] text-[#F7F5F3] font-headline-sm text-xs uppercase rounded-lg transition-colors cursor-pointer"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
};
