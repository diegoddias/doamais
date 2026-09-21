import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api } from '../lib/api'
import type { Doacao, Doador, DoadorResumo, TipoDoador } from '../lib/tipos'
import { ROTULO_TIPO_DOADOR, dataBR, numero } from '../lib/util'

const VAZIO = {
  nome: '',
  tipo: 'pessoa_fisica' as TipoDoador,
  documento: '',
  telefone: '',
  email: '',
  endereco: '',
  observacoes: '',
}

export function Doadores() {
  const [doadores, setDoadores] = useState<DoadorResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [busca, setBusca] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...VAZIO })
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const [historico, setHistorico] = useState<{ doador: DoadorResumo; doacoes: Doacao[] } | null>(
    null,
  )

  const carregar = useCallback(() => {
    setCarregando(true)
    api<DoadorResumo[]>('/api/doadores')
      .then(setDoadores)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar doadores.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirNovo() {
    setEditandoId(null)
    setForm({ ...VAZIO })
    setErroForm('')
    setModalAberto(true)
  }

  async function abrirEdicao(id: number) {
    setErroForm('')
    try {
      const doador = await api<Doador>(`/api/doadores/${id}`)
      setEditandoId(id)
      setForm({
        nome: doador.nome,
        tipo: doador.tipo,
        documento: doador.documento ?? '',
        telefone: doador.telefone ?? '',
        email: doador.email ?? '',
        endereco: doador.endereco ?? '',
        observacoes: doador.observacoes ?? '',
      })
      setModalAberto(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir o doador.')
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')
    setEnviando(true)

    const corpo = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      documento: form.documento.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      endereco: form.endereco.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }

    try {
      if (editandoId) {
        await api(`/api/doadores/${editandoId}`, { metodo: 'PUT', corpo })
        setSucesso('Doador atualizado.')
      } else {
        await api('/api/doadores', { metodo: 'POST', corpo })
        setSucesso('Doador cadastrado.')
      }
      setModalAberto(false)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setEnviando(false)
    }
  }

  async function verHistorico(doador: DoadorResumo) {
    try {
      const doacoes = await api<Doacao[]>(`/api/doadores/${doador.id}/doacoes`)
      setHistorico({ doador, doacoes })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o histórico.')
    }
  }

  async function desativar(doador: DoadorResumo) {
    if (!window.confirm(`Remover ${doador.nome} da lista de doadores ativos?`)) return
    try {
      await api(`/api/doadores/${doador.id}`, { metodo: 'DELETE' })
      setSucesso(`${doador.nome} foi desativado. O histórico de doações foi preservado.`)
      carregar()
      window.setTimeout(() => setSucesso(''), 6000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível desativar.')
    }
  }

  const visiveis = busca
    ? doadores.filter((d) => d.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : doadores

  return (
    <Layout
      titulo="Doadores"
      descricao="Quem doa, quanto já doou e quando doou pela última vez — base para agradecer e fidelizar."
      acoes={
        <button className="botao" onClick={abrirNovo}>
          + Cadastrar doador
        </button>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      <Cartao>
        <div className="barra-filtros">
          <Campo rotulo="Buscar">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do doador..."
            />
          </Campo>
          <div style={{ marginLeft: 'auto' }} className="texto-suave">
            <strong>{visiveis.length}</strong> doadores cadastrados
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={['Nome', 'Tipo', 'Contato', 'Doações', 'Itens doados', 'Última doação', '']}
            vazio="Nenhum doador cadastrado ainda."
          >
            {visiveis.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.nome}</strong>
                </td>
                <td>
                  <Etiqueta tom={d.tipo === 'pessoa_juridica' ? 'info' : 'neutro'}>
                    {ROTULO_TIPO_DOADOR[d.tipo]}
                  </Etiqueta>
                </td>
                <td className="texto-suave">
                  {d.telefone && <div>{d.telefone}</div>}
                  {d.email && <div>{d.email}</div>}
                  {!d.telefone && !d.email && '—'}
                </td>
                <td className="num">{d.total_doacoes}</td>
                <td className="num">{numero(d.total_itens)}</td>
                <td>{d.ultima_doacao ? dataBR(d.ultima_doacao) : <span className="texto-suave">—</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => verHistorico(d)}
                  >
                    Histórico
                  </button>{' '}
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => abrirEdicao(d.id)}
                  >
                    Editar
                  </button>{' '}
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => desativar(d)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Modal
        titulo={editandoId ? 'Editar doador' : 'Cadastrar doador'}
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
      >
        <form className="formulario" onSubmit={salvar}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          <div className="linha-campos">
            <Campo rotulo="Nome completo / Razão social" obrigatorio>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                maxLength={160}
                autoFocus
              />
            </Campo>
            <Campo rotulo="Tipo">
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoDoador })}
              >
                {Object.entries(ROTULO_TIPO_DOADOR).map(([valor, rotulo]) => (
                  <option value={valor} key={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="linha-campos">
            <Campo rotulo="CPF / CNPJ">
              <input
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                maxLength={30}
              />
            </Campo>
            <Campo rotulo="Telefone / WhatsApp">
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                maxLength={30}
                placeholder="(51) 90000-0000"
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={180}
              />
            </Campo>
          </div>

          <Campo rotulo="Endereço">
            <input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              maxLength={255}
            />
          </Campo>

          <Campo rotulo="Observações">
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Preferências de contato, tipo de doação habitual..."
            />
          </Campo>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="botao botao-secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        titulo={historico ? `Histórico de ${historico.doador.nome}` : 'Histórico'}
        aberto={historico !== null}
        aoFechar={() => setHistorico(null)}
        largura={720}
      >
        {historico && (
          <>
            <p className="texto-suave">
              {historico.doador.total_doacoes} doações · {numero(historico.doador.total_itens)}{' '}
              itens no total.
            </p>
            <Tabela colunas={['Data', 'Itens', 'Total', 'Campanha']} vazio="Sem doações registradas.">
              {historico.doacoes.map((d) => (
                <tr key={d.id}>
                  <td>{dataBR(d.data_recebimento)}</td>
                  <td>
                    {d.itens.map((i) => (
                      <div key={i.id} style={{ fontSize: '0.86rem' }}>
                        {numero(i.quantidade)} {i.item?.unidade} · {i.item?.nome}
                      </div>
                    ))}
                  </td>
                  <td className="num">{numero(d.itens.reduce((s, i) => s + i.quantidade, 0))}</td>
                  <td className="texto-suave">{d.campanha ?? '—'}</td>
                </tr>
              ))}
            </Tabela>
          </>
        )}
      </Modal>
    </Layout>
  )
}
