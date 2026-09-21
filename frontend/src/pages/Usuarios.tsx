import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api } from '../lib/api'
import { useSessao } from '../lib/sessao'
import type { Papel, Usuario } from '../lib/tipos'
import { dataBR } from '../lib/util'

export function Usuarios() {
  const { usuario: eu } = useSessao()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    papel: 'voluntario' as Papel,
  })
  const [erroForm, setErroForm] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    api<Usuario[]>('/api/usuarios')
      .then(setUsuarios)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirNovo() {
    setEditandoId(null)
    setForm({ nome: '', email: '', senha: '', papel: 'voluntario' })
    setErroForm('')
    setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setEditandoId(u.id)
    setForm({ nome: u.nome, email: u.email, senha: '', papel: u.papel })
    setErroForm('')
    setModalAberto(true)
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')
    setEnviando(true)
    try {
      if (editandoId) {
        const corpo: Record<string, unknown> = {
          nome: form.nome.trim(),
          email: form.email.trim(),
          papel: form.papel,
        }
        if (form.senha) corpo.senha = form.senha
        await api(`/api/usuarios/${editandoId}`, { metodo: 'PUT', corpo })
        setSucesso('Dados atualizados.')
      } else {
        await api('/api/usuarios', {
          metodo: 'POST',
          corpo: {
            nome: form.nome.trim(),
            email: form.email.trim(),
            senha: form.senha,
            papel: form.papel,
          },
        })
        setSucesso('Voluntário cadastrado. Informe a senha a ele para o primeiro acesso.')
      }
      setModalAberto(false)
      carregar()
      window.setTimeout(() => setSucesso(''), 6000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setEnviando(false)
    }
  }

  async function desativar(u: Usuario) {
    if (!window.confirm(`Desativar o acesso de ${u.nome}?`)) return
    try {
      await api(`/api/usuarios/${u.id}`, { metodo: 'DELETE' })
      setSucesso(`${u.nome} não tem mais acesso ao sistema.`)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível desativar.')
    }
  }

  return (
    <Layout
      titulo="Voluntários"
      descricao="Quem pode entrar no sistema. Administradores gerenciam cadastros e estornos; voluntários registram doações e entregas."
      acoes={
        <button className="botao" onClick={abrirNovo}>
          + Cadastrar voluntário
        </button>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela colunas={['Nome', 'E-mail', 'Perfil', 'Situação', 'Cadastrado em', '']}>
            {usuarios.map((u) => (
              <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.55 }}>
                <td>
                  <strong>{u.nome}</strong>
                  {u.id === eu?.id && <span className="texto-suave"> (você)</span>}
                </td>
                <td className="texto-suave">{u.email}</td>
                <td>
                  <Etiqueta tom={u.papel === 'admin' ? 'info' : 'neutro'}>
                    {u.papel === 'admin' ? 'Administrador' : 'Voluntário(a)'}
                  </Etiqueta>
                </td>
                <td>
                  {u.ativo ? <Etiqueta tom="bom">Ativo</Etiqueta> : <Etiqueta tom="neutro">Inativo</Etiqueta>}
                </td>
                <td className="texto-suave">{dataBR(u.criado_em)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => abrirEdicao(u)}
                  >
                    Editar
                  </button>{' '}
                  {u.ativo && u.id !== eu?.id && (
                    <button
                      className="botao botao-secundario botao-pequeno"
                      onClick={() => desativar(u)}
                    >
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Modal
        titulo={editandoId ? 'Editar acesso' : 'Cadastrar voluntário'}
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        largura={560}
      >
        <form className="formulario" onSubmit={salvar}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          <Campo rotulo="Nome completo" obrigatorio>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              maxLength={120}
              autoFocus
            />
          </Campo>

          <div className="linha-campos">
            <Campo rotulo="E-mail (usado para entrar)" obrigatorio>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                maxLength={180}
              />
            </Campo>
            <Campo rotulo="Perfil">
              <select
                value={form.papel}
                onChange={(e) => setForm({ ...form, papel: e.target.value as Papel })}
              >
                <option value="voluntario">Voluntário(a)</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
          </div>

          <Campo
            rotulo={editandoId ? 'Nova senha' : 'Senha'}
            obrigatorio={!editandoId}
            dica={
              editandoId
                ? 'Deixe em branco para manter a senha atual'
                : 'Mínimo de 6 caracteres. Informe-a ao voluntário.'
            }
          >
            <input
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              minLength={editandoId && !form.senha ? undefined : 6}
              required={!editandoId}
              autoComplete="new-password"
            />
          </Campo>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="botao botao-secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
