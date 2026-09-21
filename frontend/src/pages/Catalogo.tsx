import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { Layout } from '../components/Layout'
import { Aviso, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../components/ui'
import { api } from '../lib/api'
import { useSessao } from '../lib/sessao'
import type { Categoria, Item } from '../lib/tipos'
import { numero } from '../lib/util'

export function Catalogo() {
  const { ehAdmin } = useSessao()
  const [itens, setItens] = useState<Item[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const [modalItem, setModalItem] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState({ nome: '', categoria_id: '', unidade: 'un', estoque_minimo: '0' })
  const [erroForm, setErroForm] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [modalCategoria, setModalCategoria] = useState(false)
  const [formCat, setFormCat] = useState({ nome: '', descricao: '', perecivel: false })

  const carregar = useCallback(() => {
    setCarregando(true)
    Promise.all([
      api<Item[]>(`/api/itens?apenas_ativos=false${filtroCategoria ? `&categoria_id=${filtroCategoria}` : ''}`),
      api<Categoria[]>('/api/categorias'),
    ])
      .then(([i, c]) => {
        setItens(i)
        setCategorias(c)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar o catálogo.'))
      .finally(() => setCarregando(false))
  }, [filtroCategoria])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirNovoItem() {
    setEditandoId(null)
    setForm({
      nome: '',
      categoria_id: categorias[0] ? String(categorias[0].id) : '',
      unidade: 'un',
      estoque_minimo: '0',
    })
    setErroForm('')
    setModalItem(true)
  }

  function abrirEdicaoItem(item: Item) {
    setEditandoId(item.id)
    setForm({
      nome: item.nome,
      categoria_id: String(item.categoria_id),
      unidade: item.unidade,
      estoque_minimo: String(item.estoque_minimo),
    })
    setErroForm('')
    setModalItem(true)
  }

  async function salvarItem(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')
    setEnviando(true)

    const corpo = {
      nome: form.nome.trim(),
      categoria_id: Number(form.categoria_id),
      unidade: form.unidade.trim() || 'un',
      estoque_minimo: Number(form.estoque_minimo) || 0,
    }

    try {
      if (editandoId) {
        await api(`/api/itens/${editandoId}`, { metodo: 'PUT', corpo })
        setSucesso('Item atualizado.')
      } else {
        await api('/api/itens', { metodo: 'POST', corpo })
        setSucesso('Item adicionado ao catálogo.')
      }
      setModalItem(false)
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível salvar o item.')
    } finally {
      setEnviando(false)
    }
  }

  async function salvarCategoria(evento: FormEvent) {
    evento.preventDefault()
    setErroForm('')
    setEnviando(true)
    try {
      await api('/api/categorias', {
        metodo: 'POST',
        corpo: {
          nome: formCat.nome.trim(),
          descricao: formCat.descricao.trim() || null,
          perecivel: formCat.perecivel,
        },
      })
      setSucesso('Categoria criada.')
      setModalCategoria(false)
      setFormCat({ nome: '', descricao: '', perecivel: false })
      carregar()
      window.setTimeout(() => setSucesso(''), 5000)
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Não foi possível criar a categoria.')
    } finally {
      setEnviando(false)
    }
  }

  async function alternarAtivo(item: Item) {
    try {
      await api(`/api/itens/${item.id}`, { metodo: 'PUT', corpo: { ativo: !item.ativo } })
      carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o item.')
    }
  }

  return (
    <Layout
      titulo="Catálogo de itens"
      descricao="O que a instituição recebe e qual o estoque mínimo desejado de cada item. O mínimo define o que aparece como 'em falta' no canal público."
      acoes={
        <>
          {ehAdmin && (
            <button
              className="botao botao-secundario"
              onClick={() => {
                setErroForm('')
                setModalCategoria(true)
              }}
            >
              + Categoria
            </button>
          )}
          <button className="botao" onClick={abrirNovoItem} disabled={categorias.length === 0}>
            + Item
          </button>
        </>
      }
    >
      <Aviso tipo="erro">{erro}</Aviso>
      <Aviso tipo="sucesso">{sucesso}</Aviso>

      <Cartao>
        <div className="barra-filtros">
          <Campo rotulo="Categoria">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          <div style={{ marginLeft: 'auto' }} className="texto-suave">
            <strong>{itens.length}</strong> itens em <strong>{categorias.length}</strong>{' '}
            categorias
          </div>
        </div>
      </Cartao>

      <Cartao>
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={['Item', 'Categoria', 'Unidade', 'Estoque mínimo', 'Situação', '']}
            vazio="Nenhum item cadastrado."
          >
            {itens.map((item) => (
              <tr key={item.id} style={{ opacity: item.ativo ? 1 : 0.55 }}>
                <td>
                  <strong>{item.nome}</strong>
                </td>
                <td className="texto-suave">
                  {item.categoria?.nome}
                  {item.categoria?.perecivel && (
                    <>
                      {' '}
                      <Etiqueta tom="alerta">perecível</Etiqueta>
                    </>
                  )}
                </td>
                <td>{item.unidade}</td>
                <td className="num">{numero(item.estoque_minimo)}</td>
                <td>
                  {item.ativo ? (
                    <Etiqueta tom="bom">Ativo</Etiqueta>
                  ) : (
                    <Etiqueta tom="neutro">Inativo</Etiqueta>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => abrirEdicaoItem(item)}
                  >
                    Editar
                  </button>{' '}
                  <button
                    className="botao botao-secundario botao-pequeno"
                    onClick={() => alternarAtivo(item)}
                  >
                    {item.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>

      <Modal
        titulo={editandoId ? 'Editar item' : 'Novo item do catálogo'}
        aberto={modalItem}
        aoFechar={() => setModalItem(false)}
      >
        <form className="formulario" onSubmit={salvarItem}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          <Campo rotulo="Nome do item" obrigatorio>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Arroz 5kg"
              required
              maxLength={120}
              autoFocus
            />
          </Campo>

          <div className="linha-campos">
            <Campo rotulo="Categoria" obrigatorio>
              <select
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                required
              >
                {categorias.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Unidade" dica="pacote, unidade, peça, par, kg...">
              <input
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                maxLength={20}
              />
            </Campo>
            <Campo
              rotulo="Estoque mínimo"
              dica="Abaixo disso o item entra na lista pública de necessidades"
            >
              <input
                type="number"
                min="0"
                step="1"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
              />
            </Campo>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="botao botao-secundario" onClick={() => setModalItem(false)}>
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        titulo="Nova categoria"
        aberto={modalCategoria}
        aoFechar={() => setModalCategoria(false)}
        largura={520}
      >
        <form className="formulario" onSubmit={salvarCategoria}>
          <Aviso tipo="erro">{erroForm}</Aviso>

          <Campo rotulo="Nome da categoria" obrigatorio>
            <input
              value={formCat.nome}
              onChange={(e) => setFormCat({ ...formCat, nome: e.target.value })}
              required
              maxLength={80}
              autoFocus
            />
          </Campo>

          <Campo rotulo="Descrição">
            <input
              value={formCat.descricao}
              onChange={(e) => setFormCat({ ...formCat, descricao: e.target.value })}
              maxLength={255}
            />
          </Campo>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={formCat.perecivel}
              onChange={(e) => setFormCat({ ...formCat, perecivel: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span>Os itens desta categoria têm prazo de validade</span>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => setModalCategoria(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Criar categoria'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  )
}
