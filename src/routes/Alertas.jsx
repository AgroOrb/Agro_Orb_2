import { useState, useEffect } from 'react'
import { ESTADOS_BR, getCidadesPorUf, getLocalizacaoPorUfCidade } from '../data/localizacoes.js'

const TIPOS_ALERTA = [
  { id: 'seca',          label: 'Seca / estiagem' },
  { id: 'chuvas',        label: 'Chuvas intensas' },
  { id: 'temperatura',   label: 'Temperatura extrema' },
  { id: 'pragas',        label: 'Pragas e doenças' },
]

const STORAGE_KEY = 'agroorb-cadastros'

export default function Alertas() {
  const [form, setForm] = useState({
    nome: '',
    estado: '',
    cidade: '',
    telefone: '',
    tipos: [],
  })
  const [errors, setErrors] = useState({})
  const [cadastros, setCadastros] = useState([])
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Carregar cadastros do localStorage ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (Array.isArray(data)) setCadastros(data)
      }
    } catch (e) {
      console.warn('Não foi possível ler cadastros do localStorage', e)
    }
  }, [])

  // Último nome cadastrado — usado pra mostrar "Bem-vindo de volta"
  const ultimoCadastro = cadastros.length > 0 ? cadastros[cadastros.length - 1] : null
  const ultimoNome = ultimoCadastro ? ultimoCadastro.nome : null
  const cidadesDisponiveis = form.estado ? getCidadesPorUf(form.estado) : []

  function toggleTipo(tipoId) {
    setForm((f) => ({
      ...f,
      tipos: f.tipos.includes(tipoId)
        ? f.tipos.filter(t => t !== tipoId)
        : [...f.tipos, tipoId]
    }))
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => {
      if (name === 'estado') {
        return { ...f, estado: value, cidade: '' }
      }
      return { ...f, [name]: value }
    })
    if (errors[name]) setErrors((er) => ({ ...er, [name]: null }))
  }

  function validate() {
    const er = {}
    if (!form.nome.trim() || form.nome.trim().length < 2) er.nome = 'Informe seu nome (mínimo 2 caracteres).'
    if (!form.estado) er.estado = 'Selecione seu estado.'
    if (!form.cidade) er.cidade = 'Selecione sua cidade.'
    if (!form.telefone.trim() || form.telefone.replace(/\D/g, '').length < 10) er.telefone = 'Telefone inválido (mínimo 10 dígitos).'
    if (form.tipos.length === 0) er.tipos = 'Escolha pelo menos um tipo de alerta.'
    return er
  }

  function handleSubmit(e) {
    e.preventDefault()
    const er = validate()
    if (Object.keys(er).length > 0) {
      setErrors(er)
      return
    }

    const novo = {
      ...form,
      nome: form.nome.trim(),
      estado: ESTADOS_BR.find((item) => item.uf === form.estado)?.estado ?? form.estado,
      uf: form.estado,
      cidade: form.cidade,
      telefone: form.telefone.trim(),
      criadoEm: new Date().toISOString(),
      localizacao: getLocalizacaoPorUfCidade(form.estado, form.cidade),
    }

    const novos = [...cadastros, novo]
    setCadastros(novos)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novos))
    } catch (e) {
      console.warn('Não foi possível salvar no localStorage', e)
    }

    // Reset form
    setForm({ nome: '', estado: '', cidade: '', telefone: '', tipos: [] })
    setErrors({})

    // Toast
    setToastMsg(`Cadastro realizado com sucesso, ${novo.nome.split(' ')[0]}!`) 
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 4000)
  }

  function formatTelefone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  function handleTelefone(e) {
    const formatted = formatTelefone(e.target.value)
    setForm((f) => ({ ...f, telefone: formatted }))
    if (errors.telefone) setErrors((er) => ({ ...er, telefone: null }))
  }

  return (
    <main className="container">
      {/* ===== Hero ===== */}
      <section className="page-hero">
        <span className="eyebrow">Central de Alertas</span>
        <h1>Receba <em>antes</em><br />de virar problema.</h1>
        <p>
          Cadastre suas preferências e receba alertas no celular quando algum risco for detectado
          pelos satélites na sua região. Sem custo, sem complicação.
        </p>
      </section>

      {/* ===== Layout: form + lista ===== */}
      <section className="alerts-page section--compact">
        {/* FORM */}
        <div className="form-card">
          {ultimoNome && (
            <div className="welcome-back">
              <span className="welcome-back__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <p>
                Bem-vindo de volta, <strong>{ultimoNome.split(' ')[0]}</strong>!{' '}
                Você já tem {cadastros.length} cadastro{cadastros.length > 1 ? 's' : ''} salvo{cadastros.length > 1 ? 's' : ''}.
              </p>
            </div>
          )}

          <h3>Novo cadastro</h3>
          <p className="form-card__sub">Preencha os campos para começar a receber alertas.</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Nome */}
            <div className="field">
              <label className="field__label" htmlFor="nome">Nome completo</label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex: José da Silva"
                className={errors.nome ? 'error' : ''}
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? 'err-nome' : undefined}
              />
              {errors.nome && <div id="err-nome" className="field__error">▸ {errors.nome}</div>}
            </div>

            {/* Estado */}
            <div className="field">
              <label className="field__label" htmlFor="estado">Estado</label>
              <select
                id="estado"
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className={errors.estado ? 'error' : ''}
                aria-invalid={!!errors.estado}
                aria-describedby={errors.estado ? 'err-estado' : undefined}
              >
                <option value="">Selecione seu estado...</option>
                {ESTADOS_BR.map((item) => (
                  <option key={item.uf} value={item.uf}>{item.estado} ({item.uf})</option>
                ))}
              </select>
              {errors.estado && <div id="err-estado" className="field__error">▸ {errors.estado}</div>}
            </div>

            {/* Cidade */}
            <div className="field">
              <label className="field__label" htmlFor="cidade">Cidade</label>
              <select
                id="cidade"
                name="cidade"
                value={form.cidade}
                onChange={handleChange}
                className={errors.cidade ? 'error' : ''}
                aria-invalid={!!errors.cidade}
                aria-describedby={errors.cidade ? 'err-cidade' : undefined}
                disabled={!form.estado}
              >
                <option value="">{form.estado ? 'Selecione sua cidade...' : 'Selecione um estado primeiro'}</option>
                {cidadesDisponiveis.map((item) => (
                  <option key={item.cidade} value={item.cidade}>{item.cidade}</option>
                ))}
              </select>
              {errors.cidade && <div id="err-cidade" className="field__error">▸ {errors.cidade}</div>}
            </div>

            {/* Telefone */}
            <div className="field">
              <label className="field__label" htmlFor="telefone">Telefone (com DDD)</label>
              <input
                type="tel"
                id="telefone"
                name="telefone"
                value={form.telefone}
                onChange={handleTelefone}
                placeholder="(11) 99999-9999"
                className={errors.telefone ? 'error' : ''}
                aria-invalid={!!errors.telefone}
                aria-describedby={errors.telefone ? 'err-tel' : undefined}
              />
              {errors.telefone && <div id="err-tel" className="field__error">▸ {errors.telefone}</div>}
            </div>

            {/* Tipos de alerta */}
            <div className="field">
              <label className="field__label">Tipos de alerta</label>
              <div className="checkbox-group" role="group" aria-label="Tipos de alerta">
                {TIPOS_ALERTA.map((tipo) => (
                  <label
                    key={tipo.id}
                    className={`checkbox-item ${form.tipos.includes(tipo.id) ? 'checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.tipos.includes(tipo.id)}
                      onChange={() => toggleTipo(tipo.id)}
                    />
                    <span className="checkbox-item__box" aria-hidden="true"></span>
                    {tipo.label}
                  </label>
                ))}
              </div>
              {errors.tipos && <div className="field__error" style={{ marginTop: '0.5rem' }}>▸ {errors.tipos}</div>}
            </div>

            <button type="submit" className="btn btn--primary form-submit">
              Cadastrar
              <svg className="btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        </div>

        {/* LISTA */}
        <aside className="saved-list">
          <h3>Cadastros salvos</h3>
          <p className="saved-list__sub">{cadastros.length} cadastro{cadastros.length !== 1 ? 's' : ''} no dispositivo</p>

          {cadastros.length === 0 && (
            <p className="empty-state">
              Nenhum cadastro ainda.<br />
              Preencha o formulário ao lado para começar.
            </p>
          )}

          {cadastros.slice().reverse().map((c, i) => (
            <div key={i} className="saved-item">
              <div className="saved-item__name">{c.nome}</div>
              <div className="saved-item__details">
                ▸ {c.cidade && c.estado ? `${c.cidade} · ${c.estado}${c.uf ? ` (${c.uf})` : ''}` : c.regiao || 'Local não informado'} · {c.telefone}
              </div>
              <div className="saved-item__alerts">
                {c.tipos.map((tipoId) => {
                  const tipo = TIPOS_ALERTA.find(t => t.id === tipoId)
                  return tipo ? (
                    <span key={tipoId} className="saved-item__tag">{tipo.label}</span>
                  ) : null
                })}
              </div>
            </div>
          ))}

          {cadastros.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Tem certeza que quer apagar todos os cadastros?')) {
                  setCadastros([])
                  try { localStorage.removeItem(STORAGE_KEY) } catch {}
                }
              }}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                color: 'var(--text-faint)',
                cursor: 'pointer',
              }}
            >
              ▸ APAGAR CADASTROS
            </button>
          )}
        </aside>
      </section>

      {/* ===== Toast ===== */}
      <div className={`toast ${toastVisible ? 'show' : ''}`} role="status" aria-live="polite">
        <span className="toast__icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
        <span>{toastMsg}</span>
      </div>
    </main>
  )
}
