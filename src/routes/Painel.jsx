import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SETORES, ALERTAS_RECENTES } from '../data/setores.js'

export default function Painel() {
  const [setorAtivo, setSetorAtivo] = useState(null)

  // Setor selecionado (ou null se nada selecionado)
  const setor = useMemo(
    () => setorAtivo ? SETORES.find(s => s.id === setorAtivo) : null,
    [setorAtivo]
  )

  // KPIs agregados — variam conforme setor selecionado ou média
  const kpis = useMemo(() => {
    if (setor) {
      return {
        saude: setor.indiceFazenda,
        temp: setor.temperatura,
        umidade: setor.umidade,
        areas: 4,
      }
    }
    const media = (key) => Math.round(SETORES.reduce((sum, s) => sum + s[key], 0) / SETORES.length)
    return {
      saude: media('indiceFazenda'),
      temp: media('temperatura'),
      umidade: media('umidade'),
      areas: 4,
    }
  }, [setor])

  // Cor do KPI de saúde geral
  const saudeKpiClass = kpis.saude >= 80 ? 'kpi--safe' : kpis.saude >= 65 ? 'kpi--warn' : 'kpi--critical'

  return (
    <main className="container">
      {/* ===== Hero da página ===== */}
      <section className="page-hero">
        <span className="eyebrow">Painel · Monitoramento em tempo real</span>
        <h1>Bem-vindo ao Centro de<br /><em>Monitoramento AgroOrb</em>.</h1>
        <p>
          {setor
            ? <>Visualizando dados de <strong style={{ color: 'var(--text)' }}>{setor.nome}</strong>. Clique em outro setor abaixo para mudar.</>
            : 'Os indicadores abaixo mostram a média da fazenda. Clique em qualquer setor do mapa para ver os dados específicos.'
          }
        </p>
      </section>

      {/* ===== KPIs ===== */}
      <section aria-label="Indicadores gerais">
        <div className="kpi-grid">
          <div className={`kpi ${saudeKpiClass}`}>
            <div className="kpi__label">{setor ? 'Saúde do setor' : 'Saúde geral da fazenda'}</div>
            <div className="kpi__value">{kpis.saude}<span className="kpi__unit">%</span></div>
          </div>
          <div className="kpi">
            <div className="kpi__label">Temperatura</div>
            <div className="kpi__value">{kpis.temp}<span className="kpi__unit">°C</span></div>
          </div>
          <div className="kpi">
            <div className="kpi__label">Umidade do solo</div>
            <div className="kpi__value">{kpis.umidade}<span className="kpi__unit">%</span></div>
          </div>
          <div className="kpi">
            <div className="kpi__label">Áreas monitoradas</div>
            <div className="kpi__value">{kpis.areas}</div>
          </div>
        </div>
      </section>

      {/* ===== Dashboard: mapa + sidebar ===== */}
      <section className="dashboard section--compact">
        {/* Card principal com mapa de setores */}
        <article className="farm-card">
          <div className="farm-card__head">
            <div>
              <h3>Mapa da fazenda</h3>
              <p className="farm-card__sub">62 hectares · 4 setores monitorados</p>
            </div>
            <span className="live">
              <span className="live__dot"></span>
              Sinal ativo
            </span>
          </div>

          <div className="farm-map" role="group" aria-label="Setores da fazenda">
            {SETORES.map((s) => (
              <button
                key={s.id}
                className={`setor setor--${s.status} ${setorAtivo === s.id ? 'active' : ''}`}
                onClick={() => setSetorAtivo(setorAtivo === s.id ? null : s.id)}
                aria-pressed={setorAtivo === s.id}
                aria-label={`${s.nome}: ${s.statusLabel}. ${s.mensagem}`}
              >
                <div className="setor__head">
                  <div>
                    <div className="setor__name">{s.nome}</div>
                    <div className="setor__status">{s.statusLabel}</div>
                  </div>
                  <span className="setor__indicator" aria-hidden="true"></span>
                </div>
                <div className="setor__metric">
                  {s.cultura} · {s.umidade}% umidade
                </div>
              </button>
            ))}
          </div>
        </article>

        {/* Sidebar com info do setor e alertas */}
        <aside className="sidebar">
          <div className="info-card">
            <h3>{setor ? setor.nome : 'Visão geral da fazenda'}</h3>
            <div className="info-card__sub">
              ▸ {setor ? setor.cultura : 'Clique em um setor para ver detalhes'}
            </div>

            {setor && (
              <>
                <span className={`status-pill status-pill--${setor.status}`}>
                  ● {setor.statusLabel}
                </span>

                <p className="info-card__msg">{setor.mensagem}</p>

                <div className="info-card__data">
                  <div className="info-card__data-item">
                    <div className="info-card__data-label">Temperatura</div>
                    <div className="info-card__data-value">{setor.temperatura}°C</div>
                  </div>
                  <div className="info-card__data-item">
                    <div className="info-card__data-label">Umidade</div>
                    <div className="info-card__data-value">{setor.umidade}%</div>
                  </div>
                  <div className="info-card__data-item">
                    <div className="info-card__data-label">NDVI</div>
                    <div className="info-card__data-value">{setor.indiceVegetacao}</div>
                  </div>
                  <div className="info-card__data-item">
                    <div className="info-card__data-label">Atualizado</div>
                    <div className="info-card__data-value" style={{ fontSize: '0.85rem' }}>{setor.atualizacao}</div>
                  </div>
                </div>

                <div className="info-card__rec">
                  <div className="info-card__rec-label">▸ Recomendação</div>
                  <p>{setor.recomendacao}</p>
                </div>

                <p style={{ marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
                  FONTES: {setor.fontes}
                </p>
              </>
            )}

            {!setor && (
              <div className="empty-state">
                <p style={{ fontSize: '0.95rem', color: 'var(--text-mute)', lineHeight: 1.6 }}>
                  Sua fazenda está sendo observada continuamente por satélites.
                  Selecione um setor para ver dados, status e recomendação detalhada.
                </p>
              </div>
            )}
          </div>

          <div className="alerts-widget">
            <h3>Últimos eventos</h3>
            {ALERTAS_RECENTES.map((alerta, i) => (
              <div key={i} className={`alert-item alert-item--${alerta.tipo}`}>
                <span className="alert-item__dot" aria-hidden="true"></span>
                <span className="alert-item__text">{alerta.texto}</span>
                <span className="alert-item__time">{alerta.tempo}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* ===== CTA para alertas ===== */}
      <section className="section--compact" style={{ paddingBottom: '4rem' }}>
        <div className="cta-final" style={{ padding: '2.5rem 2rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            Quer receber esses alertas no seu telefone?
          </h3>
          <p style={{ marginBottom: '1.5rem' }}>
            Cadastre-se na Central de Alertas e seja avisado quando algum setor da sua fazenda
            entrar em estado crítico.
          </p>
          <Link to="/cadastro" className="btn btn--primary">
            Cadastrar alertas
            <svg className="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>
    </main>
  )
}
