import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SETORES, ALERTAS_RECENTES } from '../data/setores.js'
import {
  LOCALIZACAO_PADRAO,
  getLocalizacaoPorUfCidade,
} from '../data/localizacoes.js'

const STORAGE_KEY = 'agroorb-cadastros'
const NASA_POWER_PARAMETERS = 'T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN,PRECTOTCORR,RH2M'

function toYYYYMMDD(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function formatDDMM(dateKey) {
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6)) - 1
  const day = Number(dateKey.slice(6, 8))
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(Date.UTC(year, month, day)))
}

function buildNasaPowerUrl({ latitude, longitude, start, end }) {
  const params = new URLSearchParams({
    community: 'AG',
    latitude: String(latitude),
    longitude: String(longitude),
    parameters: NASA_POWER_PARAMETERS,
    start,
    end,
    format: 'JSON',
    'time-standard': 'UTC',
  })

  return `https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`
}

function extractPowerSeries(payload) {
  const parameters = payload?.properties?.parameter ?? {}
  const dates = Object.keys(parameters.T2M_MAX ?? {}).sort()

  return dates.map((date) => ({
    date,
    tmax: Number(parameters.T2M_MAX?.[date] ?? 0),
    tmin: Number(parameters.T2M_MIN?.[date] ?? 0),
    radiation: Number(parameters.ALLSKY_SFC_SW_DWN?.[date] ?? 0),
    rain: Number(parameters.PRECTOTCORR?.[date] ?? 0),
    humidity: Number(parameters.RH2M?.[date] ?? 0),
  }))
}

function createPowerChartSvg({ locationLabel, series, sourceLabel }) {
  const width = 1200
  const height = 720
  const padding = { top: 96, right: 52, bottom: 108, left: 84 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const safeSeries = series.length > 0 ? series : [
    { date: '20260601', tmax: 28, tmin: 18, radiation: 19, rain: 2, humidity: 55 },
  ]
  const maxTemp = Math.max(42, ...safeSeries.map((item) => item.tmax))
  const minTemp = Math.min(8, ...safeSeries.map((item) => item.tmin))
  const rainfallMax = Math.max(1, ...safeSeries.map((item) => item.rain))
  const radiationMax = Math.max(1, ...safeSeries.map((item) => item.radiation))
  const horizontalStep = chartWidth / Math.max(safeSeries.length - 1, 1)

  function scaleTemp(value) {
    return padding.top + chartHeight - ((value - minTemp) / (maxTemp - minTemp || 1)) * chartHeight
  }

  function pointPath(key) {
    return safeSeries
      .map((item, index) => {
        const x = padding.left + index * horizontalStep
        const y = scaleTemp(item[key])
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }

  const tmaxPath = pointPath('tmax')
  const tminPath = pointPath('tmin')
  const latest = safeSeries[safeSeries.length - 1]
  const period = `${formatDDMM(safeSeries[0].date)} - ${formatDDMM(safeSeries[safeSeries.length - 1].date)}`
  const avgMax = (safeSeries.reduce((sum, item) => sum + item.tmax, 0) / safeSeries.length).toFixed(1)
  const avgMin = (safeSeries.reduce((sum, item) => sum + item.tmin, 0) / safeSeries.length).toFixed(1)
  const avgRad = (safeSeries.reduce((sum, item) => sum + item.radiation, 0) / safeSeries.length).toFixed(1)
  const totalRain = safeSeries.reduce((sum, item) => sum + item.rain, 0).toFixed(1)
  const avgHumidity = (safeSeries.reduce((sum, item) => sum + item.humidity, 0) / safeSeries.length).toFixed(1)

  const tempPoints = safeSeries.map((item, index) => {
    const x = padding.left + index * horizontalStep
    const maxY = scaleTemp(item.tmax)
    const minY = scaleTemp(item.tmin)
    const rainHeight = (item.rain / rainfallMax) * 90
    const radHeight = (item.radiation / radiationMax) * 72
    return `
      <g>
        <line x1="${x}" y1="${padding.top + chartHeight}" x2="${x}" y2="${padding.top + chartHeight - rainHeight}" stroke="#FACC15" stroke-opacity="0.35" stroke-width="8" stroke-linecap="round" />
        <line x1="${x + 12}" y1="${padding.top + chartHeight}" x2="${x + 12}" y2="${padding.top + chartHeight - radHeight}" stroke="#3B82F6" stroke-opacity="0.28" stroke-width="6" stroke-linecap="round" />
        <circle cx="${x}" cy="${maxY}" r="6" fill="#00FF88" />
        <circle cx="${x}" cy="${minY}" r="6" fill="#3B82F6" />
        <text x="${x}" y="${height - 58}" text-anchor="middle" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="18">${formatDDMM(item.date)}</text>
        <text x="${x}" y="${maxY - 14}" text-anchor="middle" fill="#F5F7FA" font-family="JetBrains Mono, monospace" font-size="20">${Math.round(item.tmax)}°</text>
      </g>
    `
  }).join('')

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
      <title id="title">NASA POWER · ${locationLabel}</title>
      <desc id="desc">Gráfico técnico com temperatura máxima, temperatura mínima, radiação solar, chuva e umidade média para o período consultado.</desc>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#081026" />
          <stop offset="100%" stop-color="#11182F" />
        </linearGradient>
        <linearGradient id="maxLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#00FF88" />
          <stop offset="100%" stop-color="#22C55E" />
        </linearGradient>
        <linearGradient id="minLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3B82F6" />
          <stop offset="100%" stop-color="#8EC5FF" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="32" fill="url(#bg)" />
      <circle cx="1030" cy="118" r="160" fill="#00FF88" opacity="0.08" />
      <circle cx="1080" cy="470" r="200" fill="#3B82F6" opacity="0.09" />
      <text x="72" y="56" fill="#00FF88" font-family="JetBrains Mono, monospace" font-size="22" letter-spacing="5">NASA POWER · DAILY GRID</text>
      <text x="72" y="96" fill="#F5F7FA" font-family="Instrument Serif, Georgia, serif" font-size="44">${locationLabel}</text>
      <text x="72" y="132" fill="#98A2B3" font-family="Inter, Arial, sans-serif" font-size="20">${sourceLabel}</text>
      <g opacity="0.18">
        <line x1="72" y1="${padding.top}" x2="${width - 52}" y2="${padding.top}" stroke="#FFFFFF" stroke-width="1" />
        <line x1="72" y1="${padding.top + chartHeight / 4}" x2="${width - 52}" y2="${padding.top + chartHeight / 4}" stroke="#FFFFFF" stroke-width="1" />
        <line x1="72" y1="${padding.top + chartHeight / 2}" x2="${width - 52}" y2="${padding.top + chartHeight / 2}" stroke="#FFFFFF" stroke-width="1" />
        <line x1="72" y1="${padding.top + (chartHeight * 3) / 4}" x2="${width - 52}" y2="${padding.top + (chartHeight * 3) / 4}" stroke="#FFFFFF" stroke-width="1" />
      </g>
      <path d="${tmaxPath}" fill="none" stroke="url(#maxLine)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${tminPath}" fill="none" stroke="url(#minLine)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      ${tempPoints}
      <g>
        <rect x="72" y="158" width="228" height="102" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
        <rect x="316" y="158" width="228" height="102" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
        <rect x="560" y="158" width="228" height="102" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
        <rect x="804" y="158" width="228" height="102" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" />
      </g>
      <g>
        <text x="96" y="198" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="16">Tmax média</text>
        <text x="96" y="236" fill="#F5F7FA" font-family="Instrument Serif, Georgia, serif" font-size="42">${avgMax}°C</text>
        <text x="340" y="198" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="16">Tmin média</text>
        <text x="340" y="236" fill="#F5F7FA" font-family="Instrument Serif, Georgia, serif" font-size="42">${avgMin}°C</text>
        <text x="584" y="198" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="16">Radiação média</text>
        <text x="584" y="236" fill="#F5F7FA" font-family="Instrument Serif, Georgia, serif" font-size="42">${avgRad}</text>
        <text x="828" y="198" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="16">Chuva acumulada</text>
        <text x="828" y="236" fill="#F5F7FA" font-family="Instrument Serif, Georgia, serif" font-size="42">${totalRain} mm</text>
      </g>
      <g>
        <rect x="72" y="602" width="216" height="42" rx="21" fill="#00FF88" fill-opacity="0.12" stroke="#00FF88" stroke-opacity="0.25" />
        <rect x="298" y="602" width="216" height="42" rx="21" fill="#3B82F6" fill-opacity="0.12" stroke="#3B82F6" stroke-opacity="0.25" />
        <rect x="524" y="602" width="216" height="42" rx="21" fill="#FACC15" fill-opacity="0.12" stroke="#FACC15" stroke-opacity="0.25" />
        <rect x="750" y="602" width="216" height="42" rx="21" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.16" />
        <text x="180" y="629" text-anchor="middle" fill="#00FF88" font-family="JetBrains Mono, monospace" font-size="15">Tmax</text>
        <text x="406" y="629" text-anchor="middle" fill="#3B82F6" font-family="JetBrains Mono, monospace" font-size="15">Tmin</text>
        <text x="632" y="629" text-anchor="middle" fill="#FACC15" font-family="JetBrains Mono, monospace" font-size="15">Chuva / radiação</text>
        <text x="858" y="629" text-anchor="middle" fill="#98A2B3" font-family="JetBrains Mono, monospace" font-size="15">Umidade ${avgHumidity}%</text>
      </g>
      <text x="72" y="688" fill="#667085" font-family="Inter, Arial, sans-serif" font-size="18">Período ${period} · Última leitura ${formatDDMM(latest.date)}</text>
    </svg>
  `)}`
}

function buildOpenStreetMapEmbedUrl(location) {
  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)
  const delta = 0.05
  const bbox = [
    (longitude - delta).toFixed(4),
    (latitude - delta).toFixed(4),
    (longitude + delta).toFixed(4),
    (latitude + delta).toFixed(4),
  ].join('%2C')

  const params = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker: `${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`,
  })

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`
}

function buildPlainWeatherSummary(summary) {
  if (!summary) {
    return {
      title: 'Resumo do tempo',
      message: 'Os dados ainda estão sendo carregados para este local.',
      advice: 'Assim que aparecerem, você vai ver o que esperar da lavoura nos próximos dias.',
    }
  }

  const tempAlta = Number(summary.tmax) >= 32
  const tempBaixa = Number(summary.tmin) <= 15
  const chuvaBoa = Number(summary.rain) >= 10
  const climaSeco = Number(summary.humidity) <= 45

  if (tempAlta && climaSeco) {
    return {
      title: 'Calor forte e ar seco',
      message: 'O tempo está puxado para a planta: muito calor e pouca umidade no ar.',
      advice: 'Vale reforçar a observação da lavoura e checar se a água está chegando no tempo certo.',
    }
  }

  if (tempAlta && chuvaBoa) {
    return {
      title: 'Calor com chuva no período',
      message: 'Teve calor, mas também apareceu chuva para ajudar o solo.',
      advice: 'É um cenário misto: acompanhe o solo para não faltar nem sobrar água.',
    }
  }

  if (tempBaixa) {
    return {
      title: 'Tempo mais frio',
      message: 'As madrugadas ficaram mais geladas que o normal.',
      advice: 'Fique de olho nas culturas mais sensíveis ao frio, principalmente no começo do dia.',
    }
  }

  if (chuvaBoa) {
    return {
      title: 'Chuva ajudando o solo',
      message: 'Teve chuva suficiente para dar uma boa ajuda à terra.',
      advice: 'Pode ser um bom momento para reduzir irrigação e observar o encharcamento.',
    }
  }

  if (climaSeco) {
    return {
      title: 'Tempo seco',
      message: 'O ar está mais seco e isso faz a terra perder água mais rápido.',
      advice: 'Se a lavoura pedir, pense em antecipar a irrigação e observar o solo mais de perto.',
    }
  }

  return {
    title: 'Tempo estável',
    message: 'Os números mostram um tempo sem extremos fortes neste período.',
    advice: 'É um cenário mais tranquilo, bom para manter o manejo de rotina.',
  }
}

function resolveSavedLocation() {
  if (typeof window === 'undefined') {
    return LOCALIZACAO_PADRAO
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return LOCALIZACAO_PADRAO
    }

    const cadastros = JSON.parse(raw)
    if (!Array.isArray(cadastros) || cadastros.length === 0) {
      return LOCALIZACAO_PADRAO
    }

    const lastCadastro = [...cadastros].reverse().find((item) => item && item.uf && item.cidade)
    if (!lastCadastro) {
      return LOCALIZACAO_PADRAO
    }

    const localizacao = getLocalizacaoPorUfCidade(lastCadastro.uf, lastCadastro.cidade)
    return localizacao ?? LOCALIZACAO_PADRAO
  } catch {
    return LOCALIZACAO_PADRAO
  }
}

export default function Painel() {
  const [setorAtivo, setSetorAtivo] = useState(null)
  const [dashboardLocation, setDashboardLocation] = useState(LOCALIZACAO_PADRAO)
  const [openStreetMapUrl, setOpenStreetMapUrl] = useState('')
  const [nasaPower, setNasaPower] = useState({
    loading: true,
    error: '',
    preview: '',
    raw: null,
    summary: null,
    updatedAt: '',
    period: '',
  })

  const setor = useMemo(
    () => (setorAtivo ? SETORES.find((item) => item.id === setorAtivo) : null),
    [setorAtivo]
  )

  const locationLabel = `${dashboardLocation.cidade} · ${dashboardLocation.estado}`

  useEffect(() => {
    setDashboardLocation(resolveSavedLocation())
  }, [])

  useEffect(() => {
    setOpenStreetMapUrl(buildOpenStreetMapEmbedUrl(dashboardLocation))
  }, [dashboardLocation])

  useEffect(() => {
    const controller = new AbortController()

    async function loadNasaPower() {
      const endDate = new Date()
      const startDate = new Date(endDate)
      startDate.setUTCDate(startDate.getUTCDate() - 6)

      setNasaPower((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const url = buildNasaPowerUrl({
          latitude: dashboardLocation.latitude,
          longitude: dashboardLocation.longitude,
          start: toYYYYMMDD(startDate),
          end: toYYYYMMDD(endDate),
        })

        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Falha ao consultar NASA POWER (${response.status})`)
        }

        const payload = await response.json()
        const series = extractPowerSeries(payload)

        if (series.length === 0) {
          throw new Error('NASA POWER sem dados para o período consultado.')
        }

        const days = series.length
        const summary = series.reduce((acc, item) => ({
          tmax: acc.tmax + item.tmax,
          tmin: acc.tmin + item.tmin,
          radiation: acc.radiation + item.radiation,
          rain: acc.rain + item.rain,
          humidity: acc.humidity + item.humidity,
        }), { tmax: 0, tmin: 0, radiation: 0, rain: 0, humidity: 0 })

        const preview = createPowerChartSvg({
          locationLabel,
          series,
          sourceLabel: 'Leitura diária convertida em gráfico técnico com dados brutos e indicadores agregados',
        })

        setNasaPower({
          loading: false,
          error: '',
          preview,
          raw: payload?.properties?.parameter ?? null,
          updatedAt: new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date()),
          period: `${formatDDMM(series[0].date)} - ${formatDDMM(series[series.length - 1].date)}`,
          summary: {
            tmax: (summary.tmax / days).toFixed(1),
            tmin: (summary.tmin / days).toFixed(1),
            radiation: (summary.radiation / days).toFixed(1),
            rain: summary.rain.toFixed(1),
            humidity: (summary.humidity / days).toFixed(1),
          },
        })
      } catch (error) {
        if (error?.name === 'AbortError') {
          return
        }

        setNasaPower({
          loading: false,
          error: 'Não foi possível carregar a NASA POWER agora. O painel continua funcional com os dados locais.',
          preview: '',
          raw: null,
          updatedAt: '',
          period: '',
          summary: null,
        })
      }
    }

    loadNasaPower()

    return () => controller.abort()
  }, [dashboardLocation.latitude, dashboardLocation.longitude, dashboardLocation.cidade, dashboardLocation.estado, locationLabel])

  const kpis = useMemo(() => {
    if (setor) {
      return {
        saude: setor.indiceFazenda,
        temp: setor.temperatura,
        umidade: setor.umidade,
        areas: 4,
      }
    }

    const media = (key) => Math.round(SETORES.reduce((sum, item) => sum + item[key], 0) / SETORES.length)
    return {
      saude: media('indiceFazenda'),
      temp: media('temperatura'),
      umidade: media('umidade'),
      areas: 4,
    }
  }, [setor])

  const saudeKpiClass = kpis.saude >= 80 ? 'kpi--safe' : kpis.saude >= 65 ? 'kpi--warn' : 'kpi--critical'

  return (
    <main className="container">
      <section className="page-hero">
        <span className="eyebrow">Painel · Monitoramento em tempo real</span>
        <h1>
          Bem-vindo ao Centro de<br /><em>Monitoramento AgroOrb</em>.
        </h1>
        <p>
          {setor
            ? <>Visualizando dados de <strong style={{ color: 'var(--text)' }}>{setor.nome}</strong>. Clique em outro setor abaixo para mudar.</>
            : `Os indicadores abaixo mostram a média da fazenda. A localização ativa vem do cadastro do usuário: ${locationLabel}.`
          }
        </p>
      </section>

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

      <section className="dashboard section--compact">
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
            {SETORES.map((item) => (
              <button
                key={item.id}
                className={`setor setor--${item.status} ${setorAtivo === item.id ? 'active' : ''}`}
                onClick={() => setSetorAtivo(setorAtivo === item.id ? null : item.id)}
                aria-pressed={setorAtivo === item.id}
                aria-label={`${item.nome}: ${item.statusLabel}. ${item.mensagem}`}
              >
                <div className="setor__head">
                  <div>
                    <div className="setor__name">{item.nome}</div>
                    <div className="setor__status">{item.statusLabel}</div>
                  </div>
                  <span className="setor__indicator" aria-hidden="true"></span>
                </div>
                <div className="setor__metric">
                  {item.cultura} · {item.umidade}% umidade
                </div>
              </button>
            ))}
          </div>
        </article>

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

          <div className="location-card">
            <div className="location-card__head">
              <div>
                <h3>Imagem do local</h3>
                <p className="location-card__sub">OpenStreetMap sem chave, baseado no endereço selecionado no cadastro</p>
              </div>
              <span className="location-card__badge">OpenStreetMap</span>
            </div>

            <div className="location-card__meta">
              <strong>{locationLabel}</strong>
              <span>Lat {dashboardLocation.latitude.toFixed(4)} · Lon {dashboardLocation.longitude.toFixed(4)}</span>
            </div>

            {openStreetMapUrl ? (
              <iframe
                className="location-card__image"
                title={`Mapa do local selecionado: ${locationLabel}`}
                src={openStreetMapUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="location-card__placeholder">
                <p>O mapa será exibido assim que a localização do cadastro for carregada.</p>
                <span>OpenStreetMap embed</span>
              </div>
            )}
          </div>

          <div className="nasa-card">
            <div className="nasa-card__head">
              <div>
                <h3>Como esteve o tempo</h3>
                <p className="nasa-card__sub">Leitura da semana em palavras simples para o produtor</p>
              </div>
              <span className="nasa-card__badge">Resumo simples</span>
            </div>

            {nasaPower.loading && (
              <div className="nasa-card__state">
                <div className="nasa-card__placeholder nasa-card__placeholder--pulse" aria-hidden="true"></div>
                <p>Buscando o tempo de {locationLabel}...</p>
              </div>
            )}

            {!nasaPower.loading && nasaPower.error && (
              <div className="nasa-card__state nasa-card__state--error">
                <p>{nasaPower.error}</p>
                <div className="nasa-card__fallback">
                  <span>Local monitorado</span>
                  <strong>{locationLabel}</strong>
                </div>
              </div>
            )}

            {!nasaPower.loading && !nasaPower.error && nasaPower.preview && (
              <>
                <div className="nasa-card__image-wrap">
                  <img
                    className="nasa-card__image"
                    src={nasaPower.preview}
                    alt={`Gráfico simples do tempo da semana para ${locationLabel}`}
                  />
                </div>

                <div className="nasa-card__plain-summary">
                  <h4>{buildPlainWeatherSummary(nasaPower.summary).title}</h4>
                  <p>{buildPlainWeatherSummary(nasaPower.summary).message}</p>
                  <strong>{buildPlainWeatherSummary(nasaPower.summary).advice}</strong>
                </div>

                <div className="nasa-card__meta">
                  <div className="nasa-card__meta-item">
                    <span>Semana observada</span>
                    <strong>{nasaPower.period}</strong>
                  </div>
                  <div className="nasa-card__meta-item">
                    <span>Última leitura</span>
                    <strong>{nasaPower.updatedAt}</strong>
                  </div>
                  <div className="nasa-card__meta-item">
                    <span>Local escolhido</span>
                    <strong>{locationLabel}</strong>
                  </div>
                </div>

                <div className="nasa-card__stats">
                  <div className="nasa-card__stat">
                    <span>Dia mais quente</span>
                    <strong>{nasaPower.summary.tmax}°C</strong>
                  </div>
                  <div className="nasa-card__stat">
                    <span>Dia mais frio</span>
                    <strong>{nasaPower.summary.tmin}°C</strong>
                  </div>
                  <div className="nasa-card__stat">
                    <span>Sol batendo</span>
                    <strong>{nasaPower.summary.radiation} kWh/m²/dia</strong>
                  </div>
                  <div className="nasa-card__stat">
                    <span>Chuva da semana</span>
                    <strong>{nasaPower.summary.rain} mm</strong>
                  </div>
                  <div className="nasa-card__stat nasa-card__stat--full">
                    <span>Ar mais seco ou úmido</span>
                    <strong>{nasaPower.summary.humidity}%</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="nasa-raw-card">
            <div className="nasa-raw-card__head">
              <div>
                <h3>Números da semana</h3>
                <p className="nasa-raw-card__sub">Os mesmos dados, mostrados dia a dia de forma simples</p>
              </div>
            </div>

            {nasaPower.raw ? (
              <>
                <div className="raw-table-wrap">
                  <table className="raw-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Mais quente</th>
                        <th>Mais frio</th>
                        <th>Sol</th>
                        <th>Chuva</th>
                        <th>Umidade do ar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(nasaPower.raw.T2M_MAX ?? {})
                        .sort()
                        .slice(-7)
                        .map((dateKey) => (
                          <tr key={dateKey}>
                            <td>{formatDDMM(dateKey)}</td>
                            <td>{Number(nasaPower.raw.T2M_MAX?.[dateKey] ?? 0).toFixed(1)}°C</td>
                            <td>{Number(nasaPower.raw.T2M_MIN?.[dateKey] ?? 0).toFixed(1)}°C</td>
                            <td>{Number(nasaPower.raw.ALLSKY_SFC_SW_DWN?.[dateKey] ?? 0).toFixed(1)}</td>
                            <td>{Number(nasaPower.raw.PRECTOTCORR?.[dateKey] ?? 0).toFixed(1)}</td>
                            <td>{Number(nasaPower.raw.RH2M?.[dateKey] ?? 0).toFixed(1)}%</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <details className="raw-details">
                  <summary>Ver números completos</summary>
                  <pre>{JSON.stringify(nasaPower.raw, null, 2)}</pre>
                </details>
              </>
            ) : (
              <div className="nasa-raw-card__empty">
                <p>Os números completos aparecem aqui assim que a API responde com sucesso.</p>
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
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  )
}
