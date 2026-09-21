/** Contexto de sessao: guarda o usuario autenticado e expoe entrar/sair. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, gravarToken, lerToken } from './api'
import type { Sessao, Usuario } from './tipos'

interface ContextoSessao {
  usuario: Usuario | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
  ehAdmin: boolean
}

const Contexto = createContext<ContextoSessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  const sair = useCallback(() => {
    gravarToken(null)
    setUsuario(null)
  }, [])

  // Revalida o token guardado ao abrir o sistema.
  useEffect(() => {
    let cancelado = false
    if (!lerToken()) {
      setCarregando(false)
      return
    }
    api<Usuario>('/api/auth/eu')
      .then((u) => {
        if (!cancelado) setUsuario(u)
      })
      .catch(() => gravarToken(null))
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  // O cliente HTTP avisa quando a API recusa o token; a sessao cai junto.
  useEffect(() => {
    const aoExpirar = () => setUsuario(null)
    window.addEventListener('doamais:sessao-expirada', aoExpirar)
    return () => window.removeEventListener('doamais:sessao-expirada', aoExpirar)
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = await api<Sessao>('/api/auth/login', {
      metodo: 'POST',
      corpo: { email, senha },
      publico: true,
    })
    gravarToken(sessao.access_token)
    setUsuario(sessao.usuario)
  }, [])

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, sair, ehAdmin: usuario?.papel === 'admin' }),
    [usuario, carregando, entrar, sair],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSessao precisa estar dentro de ProvedorSessao.')
  return contexto
}
