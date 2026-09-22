import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Aviso, Campo } from '../components/ui'
import { useSessao } from '../lib/sessao'

export function Login() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email.trim(), senha)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela-login">
      <section className="login-apresentacao">
        <h1>
          Doa<em>+</em>
        </h1>
        <p>
          Gestão digital das doações comunitárias: registre o que entra, saiba o que há em
          estoque, acompanhe validades e mostre ao doador para onde cada item foi.
        </p>
        <ul>
          <li>Cadastro de doações com controle de validade</li>
          <li>Estoque sempre atualizado, com alerta do que está em falta</li>
          <li>Histórico por doador, para agradecer e fidelizar</li>
          <li>Relatórios prontos para prestação de contas</li>
          <li>Canal público de doação acessível por QR Code</li>
        </ul>
        <p className="texto-suave" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Projeto de Extensão · Análise e Desenvolvimento de Sistemas
        </p>
      </section>

      <section className="login-formulario">
        <form className="login-caixa" onSubmit={aoEnviar}>
          <h2>Entrar no sistema</h2>
          <Aviso tipo="erro">{erro}</Aviso>

          <Campo rotulo="E-mail" obrigatorio>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="seu.email@exemplo.com"
              required
              autoFocus
            />
          </Campo>

          <Campo rotulo="Senha" obrigatorio>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Campo>

          <button className="botao" type="submit" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="texto-suave" style={{ textAlign: 'center' }}>
            Quer doar? <Link to="/doar">Veja o que a instituição precisa</Link>
          </p>
        </form>
      </section>
    </div>
  )
}
