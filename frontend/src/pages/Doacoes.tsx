import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Layout } from '../components/Layout'
import { LinhasDeItens, linhaVazia, prepararLinhas } from '../components/LinhasDeItens'
import type { LinhaItem } from '../components/LinhasDeItens'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api } from '../lib/api'
import { useSessao } from '../lib/sessao'
import type { Doacao, DoadorResumo, Item } from '../lib/tipos'
import { dataBR, hojeISO, numero, primeiroDiaDoMesISO } from '../lib/util'

export function Doacoes() {
  const { ehAdmin } = useSessao()
  const [parametros, setParametros] = useSearchParams()

  const [doacoes, setDoacoes] = useState<Doacao[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [doadores, setDoadores] = useState<DoadorResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [inicio, setInicio] = useState(primeiroDiaDoMesISO())
  const [fim, setFim] = useState(hojeISO())

  const [modalAberto, setModalAberto] = useState(parametros.get('nova') === '1')
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const [doadorId, setDoadorId] = useState('')
  const [data, setData] = useState(hojeISO())
  const [campanha, setCampanha] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [linhas, setLinhas] = useState<LinhaItem[]>([linhaVazia()])

  const carregar = useCallback(() => {
    setCarregando(true)
    api<Doacao[]>(`/api/doacoes?inicio=${inicio}&fim=${fim}`)
      .then(setDoacoes)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar as doações.'))
      .finally(() => setCarregando(false))
  }, [inicio, fim])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    Promise.all([
      api<Item[]>('/api/itens'),
      api<DoadorResumo[]>('/api/doadores'),
    ])
      .then(([i, d]) => {
        setItens(i)
        setDoadores(d)
      })
      .catch(() => undefined)
  }, [])

  function abrirModal() {
    setErroForm('')
    setDoadorId('')
    setData(hojeISO())
    setCampanha('')
    setObservacoes('')
    setLinhas([linhaVazia()])
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    if (parametros.get('nova')) {
      parametros.delete('nova')
      setParametros(parametros, { replace: true })
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')

    const itensPreparados = prepararLinhas(linhas, true)
    if (itensPreparados.length === 0) {
      setErroForm('Informe ao menos um item com quantidade maior que zero.')
      return
    }

    setEnviando(true)
    try {
      await api('/api/doacoes', {
        metodo: 'POST',
        corpo: {
          doador_id: doadorId ? Number(doadorId) : null,
          data_recebimento: data,
          campanha: campanha.trim() || null,
          observacoes: observacoes.trim() || null,
          itens: itensPreparados,
        },
      })
      setSucesso('Doação registrada e estoque atualizado.')
      fecharModal()
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível registrar a doação.')
    } finally {
      setEnviando(false)
    }
  }

  async function estornar(doacao: Doacao) {
    const totalItens = doacao.itens.reduce((s, i) => s + i.quantidade, 0)
    const confirmado = window.confirm(
      `Estornar a doação #${doacao.id}?\n\n` +
        `${doacao.doador?.nome ?? 'Doador anônimo'} · ${numero(totalItens)} itens\n\n` +
        'Os itens serão removidos do estoque e o registro apagado. Esta ação não pode ser desfeita.',
    )
    if (!confirmado) return

    try {
      await api(`/api/doacoes/${doacao.id}`, { metodo: 'DELETE' })
      setSucesso(`Doação #${doacao.id} estornada.`)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível estornar.')
    }
  }

  const totalPeriodo = doacoes.reduce(
    (soma, d) => soma + d.itens.reduce((s, i) => s + i.quantidade, 0),
    0,
  )

  return (
    <Layout
      titulo="Doações recebidas"
      descricao="Cada entrada registrada aqui atualiza o estoque automaticamente."
      acoes={
        <button className="botao" onClick={abrirModal}>
          + Registrar doação
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
            <strong>{doacoes.length}</strong> doações · <strong>{numero(totalPeriodo)}</strong>{' '}
            itens no período
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={['#', 'Data', 'Doador', 'Itens', 'Total', 'Campanha', 'Registrado por', '']}
            vazio="Nenhuma doação registrada neste período."
          >
            {doacoes.map((doacao) => (
              <tr key={doacao.id}>
                <td className="num">{doacao.id}</td>
                <td>{dataBR(doacao.data_recebimento)}</td>
                <td>
                  {doacao.doador ? (
                    doacao.doador.nome
                  ) : (
                    <span className="texto-suave">Anônimo</span>
                  )}
                </td>
                <td>
                  {doacao.itens.map((i) => (
                    <div key={i.id} style={{ fontSize: '0.86rem' }}>
                      {numero(i.quantidade)} {i.item?.unidade} · {i.item?.nome}
                      {i.validade && (
                        <span className="texto-suave"> (val. {dataBR(i.validade)})</span>
                      )}
                    </div>
                  ))}
                </td>
                <td className="num">
                  {numero(doacao.itens.reduce((s, i) => s + i.quantidade, 0))}
                </td>
                <td>
                  {doacao.campanha ? (
                    <Etiqueta tom="info">{doacao.campanha}</Etiqueta>
                  ) : (
                    <span className="texto-suave">—</span>
                  )}
                </td>
                <td className="texto-suave">{doacao.recebido_por?.nome ?? '—'}</td>
                <td>
                  {ehAdmin && (
                    <button
                      className="botao botao-secundario botao-pequeno"
                      onClick={() => estornar(doacao)}
                    >
                      Estornar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Modal titulo="Registrar doação recebida" aberto={modalAberto} aoFechar={fecharModal} largura={760}>
        <form className="formulario" onSubmit={salvar}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          <div className="linha-campos">
            <Campo rotulo="Data do recebimento" obrigatorio>
              <input
                type="date"
                value={data}
                max={hojeISO()}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </Campo>
            <Campo rotulo="Doador" dica="Deixe em branco para doação anônima">
              <select value={doadorId} onChange={(e) => setDoadorId(e.target.value)}>
                <option value="">Doador anônimo</option>
                {doadores.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Campanha" dica="Ex.: Campanha do Agasalho">
              <input
                value={campanha}
                onChange={(e) => setCampanha(e.target.value)}
                placeholder="Opcional"
                maxLength={120}
              />
            </Campo>
          </div>

          <div>
            <span className="campo-rotulo">Itens recebidos</span>
            <LinhasDeItens linhas={linhas} itens={itens} aoMudar={setLinhas} comValidade />
          </div>

          <Campo rotulo="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Estado dos itens, quem entregou, combinações feitas..."
            />
          </Campo>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="botao botao-secundario" onClick={fecharModal}>
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar doação'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
