/** Pagina publica acessada pelo QR Code. Nao exige login. */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Aviso, Campo, Carregando, Cartao, Etiqueta } from '../components/ui'
import { api } from '../lib/api'
import type { InfoPublica, Necessidade } from '../lib/tipos'
import { numero } from '../lib/util'

const TOM_PRIORIDADE = { urgente: 'critico', alta: 'alerta', media: 'info' } as const
const TEXTO_PRIORIDADE = {
  urgente: 'Precisamos com urgência',
  alta: 'Muito necessário',
  media: 'Faz falta',
}

export function Doar() {
  const [info, setInfo] = useState<InfoPublica | null>(null)
  const [necessidades, setNecessidades] = useState<Necessidade[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [selecionados, setSelecionados] = useState<Record<number, string>>({})
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroForm, setErroForm] = useState('')

  useEffect(() => {
    Promise.all([
      api<InfoPublica>('/api/publico/info', { publico: true }),
      api<Necessidade[]>('/api/publico/necessidades', { publico: true }),
    ])
      .then(([i, n]) => {
        setInfo(i)
        setNecessidades(n)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar a página.'))
      .finally(() => setCarregando(false))
  }, [])

  function alternar(item: Necessidade) {
    setSelecionados((atual) => {
      const copia = { ...atual }
      if (item.item_id in copia) delete copia[item.item_id]
      else copia[item.item_id] = String(item.falta_quantidade || 1)
      return copia
    })
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')

    const itens = Object.entries(selecionados)
      .map(([id, qtd]) => ({ item_id: Number(id), quantidade: Number(qtd) }))
      .filter((i) => i.quantidade > 0)

    if (itens.length === 0) {
      setErroForm('Escolha pelo menos um item que você pode doar.')
      return
    }
    if (!telefone.trim() && !email.trim()) {
      setErroForm('Informe um telefone ou e-mail para que possamos combinar a entrega.')
      return
    }

    setEnviando(true)
    try {
      await api('/api/publico/intencoes', {
        metodo: 'POST',
        publico: true,
        corpo: {
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          mensagem: mensagem.trim() || null,
          itens,
        },
      })
      setEnviado(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="publico">
      <header className="publico-topo">
        <div className="publico-topo-interno">
          <h1>
            Doa<em>+</em>
          </h1>
          <p>
            <strong>{info?.instituicao ?? 'Campanha de arrecadação'}</strong>
            {info?.cidade ? ` · ${info.cidade}` : ''}
          </p>
          <p>
            Veja o que precisamos neste momento e nos diga o que você pode doar. Entraremos em
            contato para combinar a entrega.
          </p>
        </div>
      </header>

      <div className="publico-corpo">
        <Aviso tipo="erro">{erro}</Aviso>

        {enviado ? (
          <Cartao titulo="Obrigado pela sua doação!">
            <p>
              Sua oferta foi registrada. Um voluntário vai entrar em contato pelo
              {telefone ? ' telefone' : ' e-mail'} informado para combinar quando e onde você pode
              entregar os itens.
            </p>
            <p className="texto-suave">
              Se precisar falar antes, procure a recepção da instituição.
            </p>
            <button
              className="botao"
              onClick={() => {
                setEnviado(false)
                setSelecionados({})
                setNome('')
                setTelefone('')
                setEmail('')
                setMensagem('')
              }}
            >
              Registrar outra doação
            </button>
          </Cartao>
        ) : (
          <>
            <Cartao titulo="O que precisamos agora">
              {carregando ? (
                <Carregando />
              ) : necessidades.length === 0 ? (
                <p>
                  No momento nosso estoque está adequado em todos os itens. Você ainda pode doar —
                  entre em contato com a instituição para combinarmos o que é mais útil agora.
                </p>
              ) : (
                <>
                  <p className="texto-suave">
                    Toque nos itens que você pode doar e ajuste a quantidade.
                  </p>
                  <div className="lista-necessidades">
                    {necessidades.map((n) => {
                      const marcado = n.item_id in selecionados
                      return (
                        <div
                          key={n.item_id}
                          className={`necessidade ${marcado ? 'selecionada' : ''}`}
                          onClick={() => !marcado && alternar(n)}
                        >
                          <div className="necessidade-topo">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(n)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: 'auto', marginTop: 3 }}
                              aria-label={`Doar ${n.item}`}
                            />
                            <div className="necessidade-nome">
                              {n.item}
                              <div className="necessidade-meta">{n.categoria}</div>
                            </div>
                            <Etiqueta tom={TOM_PRIORIDADE[n.prioridade]}>
                              {TEXTO_PRIORIDADE[n.prioridade]}
                            </Etiqueta>
                          </div>
                          <div className="necessidade-meta">
                            Faltam {numero(n.falta_quantidade)} {n.unidade}
                          </div>
                          {marcado && (
                            <div
                              className="necessidade-quantidade"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="necessidade-meta">Vou doar:</span>
                              <input
                                type="number"
                                min="0.01"
                                step="1"
                                value={selecionados[n.item_id]}
                                onChange={(e) =>
                                  setSelecionados({ ...selecionados, [n.item_id]: e.target.value })
                                }
                              />
                              <span className="necessidade-meta">{n.unidade}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Cartao>

            <Cartao titulo="Seus dados para contato">
              <form className="formulario" onSubmit={enviar}>
                <Aviso tipo="erro">{erroForm}</Aviso>

                <Campo rotulo="Seu nome" obrigatorio>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="Como podemos te chamar?"
                  />
                </Campo>

                <div className="linha-campos">
                  <Campo rotulo="Telefone / WhatsApp" dica="Informe telefone ou e-mail">
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      maxLength={30}
                      placeholder="(51) 90000-0000"
                    />
                  </Campo>
                  <Campo rotulo="E-mail">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={180}
                    />
                  </Campo>
                </div>

                <Campo rotulo="Recado (opcional)">
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Ex.: posso entregar no sábado de manhã"
                  />
                </Campo>

                <button className="botao botao-destaque" type="submit" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Quero doar'}
                </button>

                <p className="texto-suave">
                  Seus dados serão usados apenas para combinar esta doação e agradecer. Não serão
                  compartilhados com terceiros.
                </p>
              </form>
            </Cartao>
          </>
        )}

        <p className="publico-rodape">
          <Link to="/transparencia">Ver a prestação de contas da instituição</Link> ·{' '}
          <Link to="/entrar">Acesso dos voluntários</Link>
        </p>
      </div>
    </div>
  )
}
