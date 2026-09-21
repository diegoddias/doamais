import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { Carregando } from './components/ui'
import { ProvedorSessao, useSessao } from './lib/sessao'
import { Catalogo } from './pages/Catalogo'
import { Destinacoes } from './pages/Destinacoes'
import { Divulgacao } from './pages/Divulgacao'
import { Doacoes } from './pages/Doacoes'
import { Doadores } from './pages/Doadores'
import { Doar } from './pages/Doar'
import { Estoque } from './pages/Estoque'
import { Intencoes } from './pages/Intencoes'
import { Login } from './pages/Login'
import { Manual } from './pages/Manual'
import { Painel } from './pages/Painel'
import { Relatorios } from './pages/Relatorios'
import { Transparencia } from './pages/Transparencia'
import { Usuarios } from './pages/Usuarios'

function Protegida({ children, somenteAdmin = false }: { children: ReactElement; somenteAdmin?: boolean }) {
  const { usuario, carregando, ehAdmin } = useSessao()
  const local = useLocation()

  if (carregando) return <Carregando texto="Abrindo o sistema..." />
  if (!usuario) return <Navigate to="/entrar" state={{ de: local.pathname }} replace />
  if (somenteAdmin && !ehAdmin) return <Navigate to="/painel" replace />
  return children
}

function RotaLogin() {
  const { usuario, carregando } = useSessao()
  if (carregando) return <Carregando texto="Abrindo o sistema..." />
  if (usuario) return <Navigate to="/painel" replace />
  return <Login />
}

function Rotas() {
  return (
    <Routes>
      {/* Publicas: acessadas pelo QR Code, sem login */}
      <Route path="/doar" element={<Doar />} />
      <Route path="/transparencia" element={<Transparencia />} />
      <Route path="/entrar" element={<RotaLogin />} />

      {/* Internas */}
      <Route path="/painel" element={<Protegida><Painel /></Protegida>} />
      <Route path="/doacoes" element={<Protegida><Doacoes /></Protegida>} />
      <Route path="/destinacoes" element={<Protegida><Destinacoes /></Protegida>} />
      <Route path="/estoque" element={<Protegida><Estoque /></Protegida>} />
      <Route path="/doadores" element={<Protegida><Doadores /></Protegida>} />
      <Route path="/intencoes" element={<Protegida><Intencoes /></Protegida>} />
      <Route path="/catalogo" element={<Protegida><Catalogo /></Protegida>} />
      <Route path="/relatorios" element={<Protegida><Relatorios /></Protegida>} />
      <Route path="/divulgacao" element={<Protegida><Divulgacao /></Protegida>} />
      <Route path="/manual" element={<Protegida><Manual /></Protegida>} />
      <Route
        path="/usuarios"
        element={
          <Protegida somenteAdmin>
            <Usuarios />
          </Protegida>
        }
      />

      <Route path="/" element={<Navigate to="/painel" replace />} />
      <Route path="*" element={<Navigate to="/painel" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ProvedorSessao>
        <Rotas />
      </ProvedorSessao>
    </BrowserRouter>
  )
}
