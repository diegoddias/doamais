import { useEffect, useState } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Cartao, Etiqueta, Tabela } from '../components/ui'
import { api } from '../lib/api'
import type { InfoPublica, Necessidade } from '../lib/tipos'
import { numero } from '../lib/util'

const TOM_PRIORIDADE = { urgente: 'critico', alta: 'alerta', media: 'info' } as const

export function Divulgacao() {
  const [info, setInfo] = useState<InfoPublica | null>(null)
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    Promise.all([
      api<InfoPublica>('/api/publico/info', { publico: true }),
      api<Necessidade[]>('/api/publico/necessidades', { publico: true }),
    ])
      .then(([i, n]) => {
        setInfo(i)
        setNecessidades(n)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
  }, [])

  // O QR Code do backend aponta para a URL configurada no servidor (PUBLIC_BASE_URL).
  const urlPublica = info?.url_publica ?? `${window.location.origin}/doar`

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(urlPublica)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não foi possível copiar. Selecione o endereço e copie manualmente.')
    }
  }

  return (
    <Layout
      titulo="Divulgação e QR Code"
      descricao="Material para levar o canal público de doação até a comunidade."
      acoes={
        <button className="botao botao-secundario" onClick={() => window.print()}>
          Imprimir cartaz
        </button>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>

      <Cartao titulo="QR Code do canal público">
        <div className="qr-area">
          <img src="/api/publico/qrcode.png?tamanho=12" alt="QR Code do canal público de doação" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <p>
              Quem apontar a câmera do celular para este código vê <strong>o que a instituição
              precisa agora</strong> e pode registrar o que pretende doar — sem instalar nada e sem
              precisar de senha.
            </p>
            <p className="texto-suave" style={{ wordBreak: 'break-all' }}>
              <strong>Endereço:</strong> {urlPublica}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} className="sem-impressao">
              <button className="botao botao-secundario" onClick={copiarLink}>
                {copiado ? 'Copiado!' : 'Copiar endereço'}
              </button>
              <a
                className="botao botao-secundario"
                href="/api/publico/qrcode.png?tamanho=20"
                download="doamais-qrcode.png"
              >
                Baixar QR Code
              </a>
              <a className="botao botao-secundario" href="/doar" target="_blank" rel="noreferrer">
                Abrir a página pública
              </a>
            </div>
          </div>
        </div>
      </Cartao>

      <Cartao titulo="O que a comunidade vê agora">
        <p className="texto-suave">
          Esta lista é montada automaticamente: sempre que o saldo de um item fica abaixo do
          estoque mínimo definido no catálogo, ele aparece aqui e na página pública.
        </p>
        <Tabela
          colunas={['Item', 'Categoria', 'Quantidade necessária', 'Prioridade']}
          vazio="Nenhum item em falta no momento. A página pública mostra os números de transparência."
        >
          {necessidades.map((n) => (
            <tr key={n.item_id}>
              <td>
                <strong>{n.item}</strong>
              </td>
              <td className="texto-suave">{n.categoria}</td>
              <td className="num">
                {numero(n.falta_quantidade)} {n.unidade}
              </td>
              <td>
                <Etiqueta tom={TOM_PRIORIDADE[n.prioridade]}>{n.prioridade}</Etiqueta>
              </td>
            </tr>
          ))}
        </Tabela>
      </Cartao>

      <Cartao titulo="Como usar na prática" className="sem-impressao">
        <ol>
          <li>
            Baixe o QR Code e cole-o em um cartaz na recepção, no mural e nos pontos de coleta.
          </li>
          <li>
            Publique o mesmo código nas redes sociais e nos grupos de WhatsApp da instituição.
          </li>
          <li>
            Mantenha o <strong>estoque mínimo</strong> de cada item atualizado no catálogo: é ele
            que decide o que a comunidade vê como necessidade.
          </li>
          <li>
            Acompanhe as ofertas em <strong>Quero doar</strong> e entre em contato com quem se
            ofereceu.
          </li>
        </ol>
      </Cartao>
    </Layout>
  )
}
