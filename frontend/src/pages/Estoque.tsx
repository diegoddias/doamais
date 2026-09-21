import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api, baixarArquivo } from '../lib/api'
import type { Categoria, EstoqueLinha, Lote } from '../lib/tipos'
import { ROTULO_MOTIVO_PERDA, dataBR, diasAte, hojeISO, numero } from '../lib/util'

export function Estoque() {
  const [linhas, setLinhas] = useState<EstoqueLinha[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [alertas, setAlertas] = useState<Lote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [categoriaId, setCategoriaId] = useState('')
  const [somenteFalta, setSomenteFalta] = useState(false)
  const [busca, setBusca] = useState('')

  const [perdaItem, setPerdaItem] = useState<EstoqueLinha | null>(null)
  const [perdaQtd, setPerdaQtd] = useState('')
  const [perdaMotivo, setPerdaMotivo] = useState('vencimento')
  const [perdaObs, setPerdaObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  const carregar = useCallback(() => {
    setCarregando(true)
    const params = new URLSearchParams()
    if (categoriaId) params.set('categoria_id', categoriaId)
    if (somenteFalta) params.set('somente_falta', 'true')

    Promise.all([
      api<EstoqueLinha[]>(`/api/estoque?${params.toString()}`),
      api<Lote[]>('/api/estoque/alertas/validade?dias=30'),
    ])
      .then(([e, a]) => {
        setLinhas(e)
        setAlertas(a)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar o estoque.'))
      .finally(() => setCarregando(false))
  }, [categoriaId, somenteFalta])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    api<Categoria[]>('/api/categorias').then(setCategorias).catch(() => undefined)
  }, [])

  async function registrarPerda(evento: FormEvent) {
    evento.preventDefault()
    if (!perdaItem) return
    setErroForm('')
    setEnviando(true)
    try {
      await api('/api/estoque/perdas', {
        metodo: 'POST',
        corpo: {
          item_id: perdaItem.item_id,
          quantidade: Number(perdaQtd),
          motivo: perdaMotivo,
          data: hojeISO(),
          observacoes: perdaObs.trim() || null,
        },
      })
      setSucesso(`Baixa registrada em ${perdaItem.item}.`)
      setPerdaItem(null)
      setPerdaQtd('')
      setPerdaObs('')
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível registrar a baixa.')
    } finally {
      setEnviando(false)
    }
  }

  const visiveis = busca
    ? linhas.filter((l) => l.item.toLowerCase().includes(busca.trim().toLowerCase()))
    : linhas

  const totalItens = visiveis.reduce((s, l) => s + l.saldo, 0)

  return (
    <Layout
      titulo="Estoque"
      descricao="Saldo atual por item, com alerta do que está em falta e do que está para vencer."
      acoes={
        <button
          className="botao botao-secundario"
          onClick={() =>
            baixarArquivo('/api/relatorios/estoque.csv', `estoque-${hojeISO()}.csv`).catch((e) =>
              setErro(e instanceof Error ? e.message : 'Falha ao exportar.'),
            )
          }
        >
          Exportar CSV
        </button>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      {alertas.length > 0 && (
        <Cartao titulo={`Atenção: ${alertas.length} lote(s) vencido(s) ou vencendo em 30 dias`}>
          <Tabela colunas={['Item', 'Validade', 'Situação', 'Quantidade']}>
            {alertas.map((lote) => {
              const dias = diasAte(lote.validade)
              const vencido = dias !== null && dias < 0
              return (
                <tr key={lote.id} className={vencido ? 'linha-critica' : 'linha-alerta'}>
                  <td>{linhas.find((l) => l.item_id === lote.item_id)?.item ?? `Item ${lote.item_id}`}</td>
                  <td>{dataBR(lote.validade)}</td>
                  <td>
                    {vencido ? (
                      <Etiqueta tom="critico">Vencido há {Math.abs(dias!)} dias</Etiqueta>
                    ) : (
                      <Etiqueta tom="alerta">Vence em {dias} dias</Etiqueta>
                    )}
                  </td>
                  <td className="num">{numero(lote.quantidade_atual)}</td>
                </tr>
              )
            })}
          </Tabela>
          <p className="texto-suave" style={{ marginBottom: 0 }}>
            Use estes itens primeiro nas próximas entregas. Se já não servirem, registre a baixa
            pelo botão <em>Dar baixa</em> na tabela abaixo.
          </p>
        </Cartao>
      )}

      <Cartao>
        <div className="barra-filtros">
          <Campo rotulo="Buscar item">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome..."
            />
          </Campo>
          <Campo rotulo="Categoria">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Filtro">
            <select
              value={somenteFalta ? 'falta' : 'todos'}
              onChange={(e) => setSomenteFalta(e.target.value === 'falta')}
            >
              <option value="todos">Todos os itens</option>
              <option value="falta">Somente itens em falta</option>
            </select>
          </Campo>
          <div style={{ marginLeft: 'auto' }} className="texto-suave">
            <strong>{visiveis.length}</strong> itens · <strong>{numero(totalItens)}</strong> em
            estoque
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[
              'Item',
              'Categoria',
              'Saldo',
              'Mínimo',
              'Situação',
              'Próxima validade',
              'Vencendo',
              '',
            ]}
            vazio="Nenhum item encontrado com os filtros escolhidos."
          >
            {visiveis.map((l) => {
              const dias = diasAte(l.proxima_validade)
              return (
                <tr
                  key={l.item_id}
                  className={
                    l.quantidade_vencida > 0 ? 'linha-critica' : l.em_falta ? 'linha-alerta' : ''
                  }
                >
                  <td>
                    <strong>{l.item}</strong>
                  </td>
                  <td className="texto-suave">{l.categoria}</td>
                  <td className="num">
                    {numero(l.saldo)} {l.unidade}
                  </td>
                  <td className="num texto-suave">{numero(l.estoque_minimo)}</td>
                  <td>
                    {l.saldo === 0 ? (
                      <Etiqueta tom="critico">Sem estoque</Etiqueta>
                    ) : l.em_falta ? (
                      <Etiqueta tom="alerta">Faltam {numero(l.falta_quantidade)}</Etiqueta>
                    ) : (
                      <Etiqueta tom="bom">Adequado</Etiqueta>
                    )}
                  </td>
                  <td>
                    {l.proxima_validade ? (
                      <>
                        {dataBR(l.proxima_validade)}
                        {dias !== null && dias < 0 && (
                          <>
                            {' '}
                            <Etiqueta tom="critico">vencido</Etiqueta>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="texto-suave">—</span>
                    )}
                  </td>
                  <td className="num">
                    {l.quantidade_vencida > 0 && (
                      <Etiqueta tom="critico">{numero(l.quantidade_vencida)} venc.</Etiqueta>
                    )}
                    {l.quantidade_vencendo > 0 && (
                      <Etiqueta tom="alerta">{numero(l.quantidade_vencendo)} p/ vencer</Etiqueta>
                    )}
                    {l.quantidade_vencida === 0 && l.quantidade_vencendo === 0 && (
                      <span className="texto-suave">—</span>
                    )}
                  </td>
                  <td>
                    {l.saldo > 0 && (
                      <button
                        className="botao botao-secundario botao-pequeno"
                        onClick={() => {
                          setPerdaItem(l)
                          setPerdaQtd('')
                          setPerdaMotivo('vencimento')
                          setPerdaObs('')
                          setErroForm('')
                        }}
                      >
                        Dar baixa
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </Tabela>
        )}
      </Cartao>

      <Modal
        titulo={perdaItem ? `Dar baixa em ${perdaItem.item}` : 'Dar baixa'}
        aberto={perdaItem !== null}
        aoFechar={() => setPerdaItem(null)}
        largura={520}
      >
        <form className="formulario" onSubmit={registrarPerda}>
          <Aviso tipo="erro">{erroForm}</Aviso>
          <Aviso tipo="info">
            Use esta tela apenas para itens que <strong>não foram entregues</strong> — vencidos,
            estragados ou acerto de contagem. Entregas à comunidade devem ser registradas em
            Destinações.
          </Aviso>

          <div className="linha-campos">
            <Campo
              rotulo="Quantidade"
              obrigatorio
              dica={perdaItem ? `Disponível: ${numero(perdaItem.saldo)} ${perdaItem.unidade}` : ''}
            >
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={perdaItem?.saldo}
                value={perdaQtd}
                onChange={(e) => setPerdaQtd(e.target.value)}
                required
                autoFocus
              />
            </Campo>
            <Campo rotulo="Motivo" obrigatorio>
              <select value={perdaMotivo} onChange={(e) => setPerdaMotivo(e.target.value)}>
                {Object.entries(ROTULO_MOTIVO_PERDA).map(([valor, rotulo]) => (
                  <option value={valor} key={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo rotulo="Observações">
            <textarea value={perdaObs} onChange={(e) => setPerdaObs(e.target.value)} />
          </Campo>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="botao botao-secundario" onClick={() => setPerdaItem(null)}>
              Cancelar
            </button>
            <button type="submit" className="botao botao-perigo" disabled={enviando}>
              {enviando ? 'Registrando...' : 'Confirmar baixa'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
