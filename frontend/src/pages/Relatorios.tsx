import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Layout } from '../components/Layout'
import { Aviso, Campo, Carregando, Cartao, Indicador, Tabela } from '../components/ui'
import { api, baixarArquivo } from '../lib/api'
import type { RankingLinha, RelatorioMovimento } from '../lib/tipos'
import { dataBR, hojeISO, numero, primeiroDiaDoMesISO } from '../lib/util'

function TabelaRanking({
  titulo,
  linhas,
  rotuloColuna,
  vazio,
}: {
  titulo: string
  linhas: RankingLinha[]
  rotuloColuna: string
  vazio: string
}) {
  return (
    <Cartao titulo={titulo}>
      <Tabela colunas={[rotuloColuna, 'Quantidade']} vazio={vazio}>
        {linhas.slice(0, 12).map((l) => (
          <tr key={l.rotulo}>
            <td>{l.rotulo}</td>
            <td className="num">{numero(l.valor)}</td>
          </tr>
        ))}
      </Tabela>
    </Cartao>
  )
}

export function Relatorios() {
  const [inicio, setInicio] = useState(primeiroDiaDoMesISO())
  const [fim, setFim] = useState(hojeISO())
  const [dados, setDados] = useState<RelatorioMovimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro('')
    api<RelatorioMovimento>(`/api/relatorios/movimento?inicio=${inicio}&fim=${fim}`)
      .then(setDados)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao gerar o relatório.'))
      .finally(() => setCarregando(false))
  }, [inicio, fim])

  useEffect(() => {
    carregar()
  }, [carregar])

  const saldoPeriodo = dados ? dados.entradas_total - dados.saidas_total - dados.perdas_total : 0
  const percentualPerda =
    dados && dados.entradas_total > 0 ? (dados.perdas_total / dados.entradas_total) * 100 : 0

  return (
    <Layout
      titulo="Relatórios"
      descricao="Números do período para prestação de contas ao doador, à instituição e à comunidade."
      acoes={
        <>
          <button
            className="botao botao-secundario"
            onClick={() =>
              baixarArquivo(
                `/api/relatorios/doacoes.csv?inicio=${inicio}&fim=${fim}`,
                `doacoes-${inicio}-a-${fim}.csv`,
              ).catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao exportar.'))
            }
          >
            Exportar doações (CSV)
          </button>
          <button className="botao botao-secundario" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <Cartao>
        <div className="barra-filtros">
          <Campo rotulo="Início do período">
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Fim do período">
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </Campo>
          <button className="botao" onClick={carregar} style={{ marginBottom: 1 }}>
            Gerar relatório
          </button>
        </div>
      </Cartao>

      {carregando && <Carregando texto="Gerando relatório..." />}

      {dados && !carregando && (
        <>
          <Cartao titulo={`Período de ${dataBR(dados.inicio)} a ${dataBR(dados.fim)}`}>
            <div className="grade grade-indicadores">
              <Indicador
                rotulo="Itens recebidos"
                valor={numero(dados.entradas_total)}
                detalhe="entradas no período"
                tom="bom"
              />
              <Indicador
                rotulo="Itens entregues"
                valor={numero(dados.saidas_total)}
                detalhe={`para ${dados.destinacoes_por_beneficiario.length} beneficiários`}
                tom="neutro"
              />
              <Indicador
                rotulo="Perdas"
                valor={numero(dados.perdas_total)}
                detalhe={`${percentualPerda.toFixed(1)}% do que foi recebido`}
                tom={percentualPerda > 5 ? 'critico' : percentualPerda > 0 ? 'alerta' : 'bom'}
              />
              <Indicador
                rotulo="Saldo do período"
                valor={numero(saldoPeriodo)}
                detalhe="recebido − entregue − perdido"
                tom={saldoPeriodo >= 0 ? 'bom' : 'alerta'}
              />
            </div>
          </Cartao>

          {dados.entradas_por_categoria.length > 0 && (
            <Cartao titulo="Itens recebidos por categoria">
              <div className="grafico-caixa">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dados.entradas_por_categoria}
                    margin={{ top: 8, right: 8, left: -12, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ece9" vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => `${numero(v)} itens`}
                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    />
                    <Bar dataKey="valor" name="Recebido" fill="#0f6b4f" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          )}

          <div className="grade grade-2">
            <TabelaRanking
              titulo="Itens mais recebidos"
              linhas={dados.entradas_por_item}
              rotuloColuna="Item"
              vazio="Nenhuma doação no período."
            />
            <TabelaRanking
              titulo="Itens menos recebidos"
              linhas={dados.itens_menos_doados}
              rotuloColuna="Item"
              vazio="Nenhuma doação no período."
            />
          </div>

          <div className="grade grade-2">
            <TabelaRanking
              titulo="Destinação dos donativos"
              linhas={dados.destinacoes_por_beneficiario}
              rotuloColuna="Beneficiário"
              vazio="Nenhuma entrega no período."
            />
            <TabelaRanking
              titulo="Maiores doadores do período"
              linhas={dados.top_doadores}
              rotuloColuna="Doador"
              vazio="Nenhuma doação identificada no período."
            />
          </div>

          <TabelaRanking
            titulo="Itens entregues à comunidade"
            linhas={dados.saidas_por_item}
            rotuloColuna="Item"
            vazio="Nenhuma entrega no período."
          />
        </>
      )}
    </Layout>
  )
}
