import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Layout } from '../components/Layout'
import { LinhasDeItens, linhaVazia, prepararLinhas } from '../components/LinhasDeItens'
import type { LinhaItem } from '../components/LinhasDeItens'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api } from '../lib/api'
import type { Destinacao, EstoqueLinha, Item } from '../lib/tipos'
import { ROTULO_TIPO_BENEFICIARIO, dataBR, hojeISO, numero, primeiroDiaDoMesISO } from '../lib/util'

export function Destinacoes() {
  const [destinacoes, setDestinacoes] = useState<Destinacao[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [estoque, setEstoque] = useState<EstoqueLinha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [inicio, setInicio] = useState(primeiroDiaDoMesISO())
  const [fim, setFim] = useState(hojeISO())

  const [modalAberto, setModalAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const [beneficiario, setBeneficiario] = useState('')
  const [tipo, setTipo] = useState('familia')
  const [data, setData] = useState(hojeISO())
  const [observacoes, setObservacoes] = useState('')
  const [linhas, setLinhas] = useState<LinhaItem[]>([linhaVazia()])

  const carregar = useCallback(() => {
    setCarregando(true)
    Promise.all([
      api<Destinacao[]>(`/api/destinacoes?inicio=${inicio}&fim=${fim}`),
      api<EstoqueLinha[]>('/api/estoque'),
    ])
      .then(([d, e]) => {
        setDestinacoes(d)
        setEstoque(e)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar as entregas.'))
      .finally(() => setCarregando(false))
  }, [inicio, fim])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    api<Item[]>('/api/itens').then(setItens).catch(() => undefined)
  }, [])

  // So faz sentido oferecer para entrega o que de fato existe em estoque.
  const saldos = useMemo(() => {
    const mapa: Record<number, { saldo: number; unidade: string }> = {}
    estoque.forEach((l) => {
      mapa[l.item_id] = { saldo: l.saldo, unidade: l.unidade }
    })
    return mapa
  }, [estoque])

  const itensComSaldo = useMemo(
    () => itens.filter((i) => (saldos[i.id]?.saldo ?? 0) > 0),
    [itens, saldos],
  )

  function abrirModal() {
    setErroForm('')
    setBeneficiario('')
    setTipo('familia')
    setData(hojeISO())
    setObservacoes('')
    setLinhas([linhaVazia()])
    setModalAberto(true)
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')

    const itensPreparados = prepararLinhas(linhas, false)
    if (itensPreparados.length === 0) {
      setErroForm('Informe ao menos um item com quantidade maior que zero.')
      return
    }

    setEnviando(true)
    try {
      await api('/api/destinacoes', {
        metodo: 'POST',
        corpo: {
          beneficiario: beneficiario.trim(),
          tipo_beneficiario: tipo,
          data,
          observacoes: observacoes.trim() || null,
          itens: itensPreparados,
        },
      })
      setSucesso('Entrega registrada e estoque baixado.')
      setModalAberto(false)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível registrar a entrega.')
    } finally {
      setEnviando(false)
    }
  }

  const totalPeriodo = destinacoes.reduce(
    (soma, d) => soma + d.itens.reduce((s, i) => s + i.quantidade, 0),
    0,
  )

  return (
    <Layout
      titulo="Destinações"
      descricao="Para onde os donativos foram. É esta informação que permite prestar contas ao doador."
      acoes={
        <button className="botao" onClick={abrirModal}>
          + Registrar entrega
        </button>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      <Cartao>
        <div className="barra-filtros">
          <Campo rotulo="De">
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Até">
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </Campo>
          <div style={{ marginLeft: 'auto' }} className="texto-suave">
            <strong>{destinacoes.length}</strong> entregas ·{' '}
            <strong>{numero(totalPeriodo)}</strong> itens no período
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={['#', 'Data', 'Beneficiário', 'Tipo', 'Itens entregues', 'Total', 'Responsável']}
            vazio="Nenhuma entrega registrada neste período."
          >
            {destinacoes.map((d) => (
              <tr key={d.id}>
                <td className="num">{d.id}</td>
                <td>{dataBR(d.data)}</td>
                <td>
                  <strong>{d.beneficiario}</strong>
                  {d.observacoes && (
                    <div className="texto-suave" style={{ fontSize: '0.82rem' }}>
                      {d.observacoes}
                    </div>
                  )}
                </td>
                <td>
                  <Etiqueta tom="info">
                    {ROTULO_TIPO_BENEFICIARIO[d.tipo_beneficiario] ?? d.tipo_beneficiario}
                  </Etiqueta>
                </td>
                <td>
                  {d.itens.map((i) => (
                    <div key={i.id} style={{ fontSize: '0.86rem' }}>
                      {numero(i.quantidade)} {i.item?.unidade} · {i.item?.nome}
                    </div>
                  ))}
                </td>
                <td className="num">{numero(d.itens.reduce((s, i) => s + i.quantidade, 0))}</td>
                <td className="texto-suave">{d.responsavel?.nome ?? '—'}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Modal
        titulo="Registrar entrega de donativos"
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        largura={760}
      >
        <form className="formulario" onSubmit={salvar}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          {itensComSaldo.length === 0 && (
            <Aviso tipo="info">
              Não há itens em estoque para entregar. Registre primeiro uma doação recebida.
            </Aviso>
          )}

          <div className="linha-campos">
            <Campo rotulo="Quem recebeu" obrigatorio dica="Família, entidade ou grupo atendido">
              <input
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                placeholder="Ex.: Família Silva - Rua das Flores, 120"
                required
                maxLength={180}
              />
            </Campo>
            <Campo rotulo="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {Object.entries(ROTULO_TIPO_BENEFICIARIO).map(([valor, rotulo]) => (
                  <option value={valor} key={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Data da entrega" obrigatorio>
              <input
                type="date"
                value={data}
                max={hojeISO()}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </Campo>
          </div>

          <div>
            <span className="campo-rotulo">Itens entregues</span>
            <LinhasDeItens
              linhas={linhas}
              itens={itensComSaldo}
              aoMudar={setLinhas}
              saldos={saldos}
            />
          </div>

          <Campo rotulo="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Motivo do atendimento, encaminhamento, quem acompanhou..."
            />
          </Campo>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => setModalAberto(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando || itensComSaldo.length === 0}>
              {enviando ? 'Salvando...' : 'Salvar entrega'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
