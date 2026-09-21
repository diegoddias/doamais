/** Pagina publica de prestacao de contas. Nao exige login. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Aviso, Carregando, Cartao, Indicador } from '../components/ui'
import { api } from '../lib/api'
import type { Transparencia as DadosTransparencia } from '../lib/tipos'
import { dataHoraBR, numero } from '../lib/util'

export function Transparencia() {
  const [dados, setDados] = useState<DadosTransparencia | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api<DadosTransparencia>('/api/publico/transparencia', { publico: true })
      .then(setDados)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.'))
  }, [])

  const emEstoque = dados ? dados.total_itens_recebidos - dados.total_itens_destinados : 0

  return (
    <div className="publico">
      <header className="publico-topo">
        <div className="publico-topo-interno">
          <h1>Prestação de contas</h1>
          <p>
            <strong>{dados?.instituicao ?? ''}</strong>
            {dados?.cidade ? ` · ${dados.cidade}` : ''}
          </p>
          <p>
            Todo donativo recebido é registrado e toda entrega é documentada. Estes números são
            gerados diretamente pelo sistema, sem edição manual.
          </p>
        </div>
      </header>

      <div className="publico-corpo">
        <Aviso tipo="erro">{erro}</Aviso>
        {!dados && !erro && <Carregando />}

        {dados && (
          <>
            <div className="grade grade-indicadores">
              <Indicador
                rotulo="Itens recebidos"
                valor={numero(dados.total_itens_recebidos)}
                detalhe={`em ${dados.total_doacoes} doações registradas`}
                tom="bom"
              />
              <Indicador
                rotulo="Itens entregues"
                valor={numero(dados.total_itens_destinados)}
                detalhe={`para ${dados.total_beneficiarios} famílias e entidades`}
                tom="neutro"
              />
              <Indicador
                rotulo="Disponível em estoque"
                valor={numero(Math.max(0, emEstoque))}
                detalhe="prontos para atendimento"
                tom="bom"
              />
              <Indicador
                rotulo="Itens em falta"
                valor={numero(dados.itens_em_falta)}
                detalhe="tipos abaixo do estoque mínimo"
                tom={dados.itens_em_falta > 0 ? 'alerta' : 'bom'}
              />
            </div>

            <Cartao titulo="O que estes números significam">
              <p>
                <strong>Itens recebidos</strong> é o total de unidades doadas desde o início do
                registro no sistema — alimentos, roupas, itens de higiene, cobertores e demais
                donativos.
              </p>
              <p>
                <strong>Itens entregues</strong> é o que já chegou às famílias e entidades
                assistenciais atendidas. Cada entrega registra quem recebeu, o que recebeu e
                quando.
              </p>
              <p>
                <strong>Itens em falta</strong> mostra quantos tipos de item estão abaixo do
                estoque mínimo definido pela instituição. É essa lista que aparece para quem quer
                doar.
              </p>
              <p className="texto-suave">
                Dados atualizados em {dataHoraBR(dados.atualizado_em)}.
              </p>
            </Cartao>

            <Cartao titulo="Quer ajudar?">
              <p>
                Veja a lista atualizada do que precisamos e registre o que você pode doar. É
                rápido e não precisa de cadastro.
              </p>
              <Link className="botao botao-destaque" to="/doar">
                Quero doar
              </Link>
            </Cartao>
          </>
        )}

        <p className="publico-rodape">
          <Link to="/doar">Página de doação</Link> · <Link to="/entrar">Acesso dos voluntários</Link>
        </p>
      </div>
    </div>
  )
}
