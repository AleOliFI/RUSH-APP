// ============================================================
// RUSH PERFORMANCE — Scientific Warm-up & Running Drills Guide
//
// Protocolo de Aquecimento Dinâmico e Educativos de Corrida
// Baseado em evidências científicas:
// - Fradkin et al. (2010): Efeitos positivos do aquecimento dinâmico em 79% dos estudos.
// - Simic et al. (2013): Alongamento estático pré-corrida inibe força elástica em -5.4%.
// - Behm & Chaouachi (2011): Aumento de temperatura intramuscular e taxa de disparo neuromuscular.
// ============================================================

import { useState } from 'react';
import { X, ShieldAlert, Sparkles, Flame, Activity, Zap, CheckCircle2, Info } from 'lucide-react';

const WARMUP_PHASES = [
  {
    id: 'mobility',
    number: '01',
    title: 'Mobilidade Articular Dinâmica (2 a 3 min)',
    desc: 'Lubrificação das articulações sinoviais e expansão da amplitude de movimento sem perda de rigidez elástica.',
    exercises: [
      {
        name: 'Círculos de Tornozelo & Mobilidade no Chão',
        reps: '10 rotações para cada lado por perna',
        cue: 'Mantenha o calcanhar apoiado e projete o joelho para frente sem descolar o calcanhar.',
        benefit: 'Previne canelite (MTSS) e fascite plantar.',
      },
      {
        name: 'Balanço de Perna Ântero-Posterior & Lateral (Leg Swings)',
        reps: '12 repetições controladas por perna',
        cue: 'Balanço suave como um pêndulo, aumentando a amplitude progressivamente.',
        benefit: 'Soltura da cápsula do quadril e isquiotibiais.',
      },
      {
        name: 'Abertura de Quadril em Avanço (Lunge Dinâmico com Rotação)',
        reps: '6 passos alternados para cada lado',
        cue: 'Passo largo à frente, flexione o joelho a 90° e gire o tronco para o lado da perna dianteira.',
        benefit: 'Ativação do psoas, glúteos e mobilidade torácica.',
      },
    ],
  },
  {
    id: 'activation',
    number: '02',
    title: 'Ativação Muscular Específica (2 a 3 min)',
    desc: 'Despertar dos estabilizadores pélvicos e extensores de quadril para absorção de impacto.',
    exercises: [
      {
        name: 'Ponte de Glúteos Unilateral Dinâmica',
        reps: '10 repetições por perna',
        cue: 'Deite-se, eleve o quadril pressionando o calcanhar no solo. Segure 1 segundo no topo.',
        benefit: 'Ativação do glúteo máximo (motor primário da propulsão).',
      },
      {
        name: 'Caminhada Monstro / Ativação de Glúteo Médio',
        reps: '15 passos laterais para cada lado',
        cue: 'Pés paralelos apontados para frente, joelhos levemente flexionados.',
        benefit: 'Evita a queda pélvica (valgo dinâmico) e lesões na banda iliotibial.',
      },
      {
        name: 'Elevação de Panturrilha em 1 Pé (Calf Raises)',
        reps: '12 repetições por perna',
        cue: 'Suba na ponta do pé com controle, enfatizando a primeira articulação do dedão.',
        benefit: 'Prepara o complexo gastrocnêmio-sóleo para as forças de reação do solo (2.5x o peso corporal).',
      },
    ],
  },
  {
    id: 'drills',
    number: '03',
    title: 'Educativos Técnicos de Corrida (Drills) (3 a 4 min)',
    desc: 'Treinamento da mecânica de passada, tempo de contato com o solo e rigidez elástica de tendão (Stiffness).',
    exercises: [
      {
        name: 'Skipping Baixo & Alto (Marcha Skips)',
        reps: '2 séries de 20 metros',
        cue: 'Tronco ereto, elevação de joelho a 90° com tornozelo dorsifletido. Braços coordenados em 90°.',
        benefit: 'Melhora a cadência e a tripla extensão de tornozelo-joelho-quadril.',
      },
      {
        name: 'Anfersen / Calcanhar no Glúteo',
        reps: '2 séries de 20 metros',
        cue: 'Joelho aponta para o solo enquanto o calcanhar sobe rapidamente em direção ao ísquio.',
        benefit: 'Otimiza o ciclo anterior da perna livre e reduz o braço de alavanca.',
      },
      {
        name: 'Drible de Tornozelo / Saltitos de Mola (Stiffness)',
        reps: '2 séries de 15 metros',
        cue: 'Apoio na planta do pé (antepé/médiope), joelhos firmes, ressaltando rapidamente como uma mola.',
        benefit: 'Reduz o tempo de contato com o solo (GCT) e aumenta a economia de corrida.',
      },
      {
        name: 'Soldadinho / Chute Dinâmico (Straight Leg Bound)',
        reps: '2 séries de 20 metros',
        cue: 'Pernas estendidas à frente, puxando o solo ativamente para trás no momento do contato.',
        benefit: 'Potência da cadeia posterior e pré-ativação dos isquiotibiais.',
      },
      {
        name: 'Acelerações Progressivas (Strides)',
        reps: '3 tiros de 60 metros (80% a 90% da velocidade)',
        cue: 'Comece suave e acelere com técnica perfeita. Caminhe de volta para recuperar.',
        benefit: 'Prepara o sistema neuromuscular e cardiovascular para o ritmo do treino.',
      },
    ],
  },
];

export default function WarmupGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('mobility');

  if (!isOpen) return null;

  const currentPhase = WARMUP_PHASES.find((p) => p.id === activeTab) || WARMUP_PHASES[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--warmup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 06 / PREVENÇÃO DE LESÕES</span>
            <h3 className="modal-title">Aquecimento Dinâmico & Educativos</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Scientific Warning Card */}
        <div className="zones-science-tip" style={{ marginBottom: 16 }}>
          <ShieldAlert size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Por que NUNCA fazer alongamento estático antes de correr?</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Estudos comprovaram que alongar parado antes do treino diminui a rigidez elástica do tendão em <strong>-5.4%</strong> (Simic et al., 2013), reduzindo a velocidade e aumentando o risco de entorse. O <strong>aquecimento dinâmico</strong> é o padrão-ouro científico.
            </p>
          </div>
        </div>

        {/* Phase Pill Navigation */}
        <div className="tab-pill-group" style={{ marginBottom: 16 }}>
          {WARMUP_PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tab-pill ${activeTab === p.id ? 'tab-pill--active' : ''}`}
              onClick={() => setActiveTab(p.id)}
            >
              {p.number}. {p.id === 'mobility' ? 'Mobilidade' : p.id === 'activation' ? 'Ativação' : 'Educativos'}
            </button>
          ))}
        </div>

        {/* Active Phase Content */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {currentPhase.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {currentPhase.desc}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentPhase.exercises.map((ex, idx) => (
              <div key={idx} className="card-surface" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--color-primary)' }}>
                    {idx + 1}. {ex.name}
                  </span>
                  <span className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {ex.reps}
                  </span>
                </div>

                <p style={{ margin: '0 0 6px', fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.35 }}>
                  💡 <strong>Execução:</strong> {ex.cue}
                </p>

                <span style={{ fontSize: '0.7rem', color: 'var(--status-favorable)', fontWeight: 600 }}>
                  ✓ Benefício: {ex.benefit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Action */}
        <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={onClose}>
          <CheckCircle2 size={16} /> Entendido, Pronto para Aquecer
        </button>
      </div>
    </div>
  );
}
