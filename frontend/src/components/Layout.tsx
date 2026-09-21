/** Estrutura das telas internas: menu lateral + cabecalho da pagina. */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { api } from '../lib/api'
import { useSessao } from '../lib/sessao'
import type { Indicadores } from '../lib/tipos'

interface LinkMenu {
  para: string
  rotulo: string
  icone: string
  somenteAdmin?: boolean
}

const GRUPOS: { titulo: string; links: LinkMenu[] }[] = [
  {
    titulo: 'Operação',
    links: [
      { para: '/painel', rotulo: 'Painel', icone: '▤' },
      { para: '/doacoes', rotulo: 'Doações recebidas', icone: '↓' },
      { para: '/destinacoes', rotulo: 'Destinações', icone: '↑' },
      { para: '/estoque', rotulo: 'Estoque', icone: '▦' },
      { para: '/intencoes', rotulo: 'Quero doar', icone: '✉' },
    ],
  },
  {
    titulo: 'Cadastros',
    links: [
      { para: '/doadores', rotulo: 'Doadores', icone: '☺' },
      { para: '/catalogo', rotulo: 'Catálogo de itens', icone: '☰' },
      { para: '/usuarios', rotulo: 'Voluntários', icone: '⚑', somenteAdmin: true },
    ],
  },
  {
    titulo: 'Gestão',
    links: [
      { para: '/relatorios', rotulo: 'Relatórios', icone: '▥' },
      { para: '/divulgacao', rotulo: 'Divulgação e QR Code', icone: '◫' },
      { para: '/manual', rotulo: 'Manual de uso', icone: '?' },
    ],
  },
]

export function Layout({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string
  descricao?: string
  acoes?: ReactNode
  children: ReactNode
}) {
  const { usuario, sair, ehAdmin } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)
  const [pendentes, setPendentes] = useState(0)

  // O contador de intencoes pendentes acompanha o usuario pelo menu inteiro.
  useEffect(() => {
    let cancelado = false
    api<Indicadores>('/api/relatorios/indicadores')
      .then((i) => {
        if (!cancelado) setPendentes(i.intencoes_pendentes)
      })
      .catch(() => setPendentes(0))
    return () => {
      cancelado = true
    }
  }, [titulo])

  return (
    <div className="app">
      <aside className={`menu-lateral ${menuAberto ? 'aberto' : ''}`}>
        <div className="menu-marca">
          <div>
            <strong>Doa+</strong>
            <span>Gestão de doações</span>
          </div>
          <button
            type="button"
            className="botao-menu"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
          >
            {menuAberto ? 'Fechar' : 'Menu'}
          </button>
        </div>

        <nav className="menu-navegacao">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <div className="menu-grupo">{grupo.titulo}</div>
              {grupo.links
                .filter((l) => !l.somenteAdmin || ehAdmin)
                .map((link) => (
                  <NavLink
                    key={link.para}
                    to={link.para}
                    className={({ isActive }) => `menu-item ${isActive ? 'ativo' : ''}`}
                    onClick={() => setMenuAberto(false)}
                  >
                    <span aria-hidden="true">{link.icone}</span>
                    {link.rotulo}
                    {link.para === '/intencoes' && pendentes > 0 && (
                      <span className="distintivo">{pendentes}</span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        <div className="menu-rodape">
          <span className="menu-usuario">{usuario?.nome}</span>
          <span className="menu-papel">
            {usuario?.papel === 'admin' ? 'Administrador' : 'Voluntário(a)'}
          </span>
          <button type="button" className="botao botao-secundario botao-pequeno" onClick={sair}>
            Sair do sistema
          </button>
        </div>
      </aside>

      <main className="conteudo">
        <header className="conteudo-topo">
          <div>
            <h1>{titulo}</h1>
            {descricao && <p>{descricao}</p>}
          </div>
          {acoes && <div className="conteudo-topo-acoes">{acoes}</div>}
        </header>
        <div className="conteudo-corpo">{children}</div>
      </main>
    </div>
  )
}
