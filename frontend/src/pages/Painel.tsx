import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Layout } from '../components/Layout'
import { Aviso, Carregando, Cartao, Etiqueta, Indicador, Tabela } from '../components/ui'
import { api } from '../lib/api'
import type { EstoqueLinha, Indicadores } from '../lib/tipos'
import { CORES_GRAFICO, dataBR, diasAte, numero } from '../lib/util'

export function Painel() {
  const [dados, setDados] = useState<Indicadores | null>(null)
  const [emFalta, setEmFalta] = useState<EstoqueLinha[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([
      api<Indicadores>('/api/relatorios/indicadores'),
      api<EstoqueLinha[]>('/api/estoque?somente_falta=true'),
    ])
      .then(([indicadores, falta]) => {
        setDados(indicadores)
        setEmFalta(falta)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar o painel.'))
      .finally(() => setCarregando(false))
  }, [])

  const vencendo = dados ? dados.lotes_vencendo : 0
  const vencidos = dados ? dados.lotes_vencidos : 0

  return (
    <Layout
      titulo="Painel"
      descricao="Visão geral das doações, do estoque e dos pontos que precisam de atenção."
      acoes={
        <>
          <Link className="botao botao-secundario" to="/destinacoes">
            Registrar entrega
          </Link>
          <Link className="botao" to="/doacoes?nova=1">
            + Registrar doação
          </Link>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      {carregando && <Carregando texto="Carregando indicadores..." />}

      {dados && (
        <>
          <div className="grade grade-indicadores">
            <Indicador
              rotulo="Itens em estoque"
              valor={numero(dados.total_itens_estoque)}
              detalhe={`${dados.itens_distintos} tipos de item diferentes`}
              tom="bom"
            />
            <Indicador
              rotulo="Doações no mês"
              valor={numero(dados.doacoes_mes)}
              detalhe={`${numero(dados.itens_recebidos_mes)} itens recebidos`}
              tom="neutro"
            />
            <Indicador
              rotulo="Entregues no mês"
              valor={numero(dados.itens_destinados_mes)}
              detalhe="itens destinados à comunidade"
              tom="neutro"
            />
            <Indicador
              rotulo="Itens em falta"
              valor={numero(dados.itens_em_falta)}
              detalhe="abaixo do estoque mínimo"
              tom={dados.itens_em_falta > 0 ? 'alerta' : 'bom'}
            />
            <Indicador
              rotulo="Vencendo em breve"
              valor={numero(vencendo)}
              detalhe={vencidos > 0 ? `${vencidos} lote(s) já vencido(s)` : 'nenhum lote vencido'}
              tom={vencidos > 0 ? 'critico' : vencendo > 0 ? 'alerta' : 'bom'}
            />
            <Indicador
              rotulo="Quero doar"
              valor={numero(dados.intencoes_pendentes)}
              detalhe="ofertas aguardando contato"
              tom={dados.intencoes_pendentes > 0 ? 'alerta' : 'bom'}
            />
          </div>

          <div className="grade grade-2">
            <Cartao titulo="Entradas e saídas nos últimos 6 meses">
              <div className="grafico-caixa">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ece9" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => numero(v)}
                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="entradas" name="Recebido" fill="#0f6b4f" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="saidas" name="Entregue" fill="#f5b700" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            <Cartao titulo="Composição do estoque por categoria">
              {dados.por_categoria.length === 0 ? (
                <p className="texto-suave">Ainda não há itens em estoque.</p>
              ) : (
                <div className="grafico-caixa">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dados.por_categoria}
                        dataKey="valor"
                        nameKey="rotulo"
                        outerRadius={76}
                        label={(e: { rotulo: string }) => e.rotulo}
                        labelLine={false}
                        fontSize={11}
                        isAnimationActive={false}
                      >
                        {dados.por_categoria.map((_, i) => (
                          <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => `${numero(v)} itens`}
                        contentStyle={{ borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Cartao>
          </div>

          <Cartao
            titulo="Itens que precisam de reposição"
            acoes={
              <Link className="botao botao-secundario botao-pequeno" to="/divulgacao">
                Divulgar necessidades
              </Link>
            }
          >
            <Tabela
              colunas={['Item', 'Categoria', 'Em estoque', 'Mínimo', 'Falta', 'Validade mais próxima']}
              vazio="Nenhum item abaixo do estoque mínimo. Estoque saudável."
            >
              {emFalta.slice(0, 12).map((linha) => {
                const dias = diasAte(linha.proxima_validade)
                return (
                  <tr key={linha.item_id} className={linha.saldo === 0 ? 'linha-critica' : ''}>
                    <td>{linha.item}</td>
                    <td>{linha.categoria}</td>
                    <td className="num">
                      {numero(linha.saldo)} {linha.unidade}
                    </td>
                    <td className="num">{numero(linha.estoque_minimo)}</td>
                    <td className="num">
                      <Etiqueta tom={linha.saldo === 0 ? 'critico' : 'alerta'}>
                        {numero(linha.falta_quantidade)}
                      </Etiqueta>
                    </td>
                    <td>
                      {linha.proxima_validade ? (
                        <>
                          {dataBR(linha.proxima_validade)}{' '}
                          {dias !== null && dias < 0 && <Etiqueta tom="critico">vencido</Etiqueta>}
                          {dias !== null && dias >= 0 && dias <= 30 && (
                            <Etiqueta tom="alerta">{dias} dias</Etiqueta>
                          )}
                        </>
                      ) : (
                        <span className="texto-suave">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </Tabela>
          </Cartao>

          <Cartao titulo="Itens mais doados (histórico completo)">
            {dados.top_itens.length === 0 ? (
              <p className="texto-suave">Nenhuma doação registrada ainda.</p>
            ) : (
              <div className="grafico-caixa">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dados.top_itens}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 90, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ece9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="rotulo"
                      tick={{ fontSize: 11 }}
                      width={90}
                      interval={0}
                    />
                    <Tooltip
                      formatter={(v: number) => `${numero(v)} itens`}
                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    />
                    <Bar dataKey="valor" name="Recebido" fill="#0f6b4f" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Cartao>
        </>
      )}
    </Layout>
  )
}
