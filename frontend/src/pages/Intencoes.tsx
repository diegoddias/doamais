import { useCallback, useEffect, useState } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Carregando, Cartao, Etiqueta, Tabela } from '../components/ui'
import { api } from '../lib/api'
import type { Intencao, StatusIntencao } from '../lib/tipos'
import { ROTULO_STATUS_INTENCAO, dataHoraBR, numero } from '../lib/util'

const TOM: Record<StatusIntencao, 'alerta' | 'info' | 'bom' | 'neutro'> = {
  pendente: 'alerta',
  em_contato: 'info',
  recebida: 'bom',
  cancelada: 'neutro',
}

export function Intencoes() {
  const [intencoes, setIntencoes] = useState<Intencao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [filtro, setFiltro] = useState<StatusIntencao | ''>('')

  const carregar = useCallback(() => {
    setCarregando(true)
    api<Intencao[]>(`/api/intencoes${filtro ? `?status=${filtro}` : ''}`)
      .then(setIntencoes)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setCarregando(false))
  }, [filtro])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function mudarStatus(intencao: Intencao, status: StatusIntencao) {
    try {
      await api(`/api/intencoes/${intencao.id}/status`, { metodo: 'PUT', corpo: { status } })
      setSucesso(`Oferta de ${intencao.nome} marcada como "${ROTULO_STATUS_INTENCAO[status]}".`)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar.')
    }
  }

  const pendentes = intencoes.filter((i) => i.status === 'pendente').length

  return (
    <Layout
      titulo="Quero doar"
      descricao="Ofertas enviadas pela comunidade através do formulário público (QR Code)."
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      {pendentes > 0 && (
        <Aviso tipo="info">
          Há <strong>{pendentes}</strong> oferta(s) aguardando contato. Ligue ou mande mensagem
          para combinar a entrega e marque como <em>Em contato</em>.
        </Aviso>
      )}

      <Cartao>
        <div className="barra-filtros">
          <label className="campo" style={{ minWidth: 200 }}>
            <span className="campo-rotulo">Situação</span>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as StatusIntencao | '')}
            >
              <option value="">Todas</option>
              {Object.entries(ROTULO_STATUS_INTENCAO).map(([valor, rotulo]) => (
                <option value={valor} key={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <div style={{ marginLeft: 'auto' }} className="texto-suave">
            <strong>{intencoes.length}</strong> registros
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={['Recebido em', 'Doador', 'Contato', 'Itens oferecidos', 'Recado', 'Situação', 'Ação']}
            vazio="Nenhuma oferta recebida ainda. Divulgue o QR Code para a comunidade."
          >
            {intencoes.map((i) => (
              <tr key={i.id} className={i.status === 'pendente' ? 'linha-alerta' : ''}>
                <td className="texto-suave">{dataHoraBR(i.criado_em)}</td>
                <td>
                  <strong>{i.nome}</strong>
                </td>
                <td className="texto-suave">
                  {i.telefone && <div>{i.telefone}</div>}
                  {i.email && <div>{i.email}</div>}
                </td>
                <td>
                  {i.itens.map((li) => (
                    <div key={li.id} style={{ fontSize: '0.86rem' }}>
                      {numero(li.quantidade)} {li.item?.unidade} · {li.item?.nome}
                    </div>
                  ))}
                </td>
                <td className="texto-suave" style={{ maxWidth: 220 }}>
                  {i.mensagem ?? '—'}
                </td>
                <td>
                  <Etiqueta tom={TOM[i.status]}>{ROTULO_STATUS_INTENCAO[i.status]}</Etiqueta>
                </td>
                <td>
                  <select
                    value={i.status}
                    onChange={(e) => mudarStatus(i, e.target.value as StatusIntencao)}
                    style={{ minWidth: 130 }}
                  >
                    {Object.entries(ROTULO_STATUS_INTENCAO).map(([valor, rotulo]) => (
                      <option value={valor} key={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
        <p className="texto-suave" style={{ marginBottom: 0 }}>
          Quando a doação chegar de fato, marque a oferta como <em>Recebida</em> e registre-a em{' '}
          <strong>Doações recebidas</strong> — é o registro da doação que atualiza o estoque.
        </p>
      </Cartao>
    </Layout>
  )
}
