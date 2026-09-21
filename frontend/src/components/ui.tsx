/** Componentes de interface reaproveitados por todas as telas. */
import { useEffect } from 'react'
import type { ReactNode } from 'react'

export function Cartao({
  titulo,
  acoes,
  children,
  className = '',
}: {
  titulo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`cartao ${className}`}>
      {(titulo || acoes) && (
        <header className="cartao-topo">
          {titulo && <h2>{titulo}</h2>}
          {acoes && <div className="cartao-acoes">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: ReactNode
  detalhe?: string
  tom?: 'neutro' | 'bom' | 'alerta' | 'critico'
}) {
  return (
    <div className={`indicador indicador-${tom}`}>
      <span className="indicador-rotulo">{rotulo}</span>
      <strong className="indicador-valor">{valor}</strong>
      {detalhe && <span className="indicador-detalhe">{detalhe}</span>}
    </div>
  )
}

export function Etiqueta({
  children,
  tom = 'neutro',
}: {
  children: ReactNode
  tom?: 'neutro' | 'bom' | 'alerta' | 'critico' | 'info'
}) {
  return <span className={`etiqueta etiqueta-${tom}`}>{children}</span>
}

export function Aviso({
  tipo = 'erro',
  children,
}: {
  tipo?: 'erro' | 'sucesso' | 'info'
  children: ReactNode
}) {
  if (!children) return null
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="girador" aria-hidden="true" />
      {texto}
    </div>
  )
}

export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <p>{texto}</p>
      {children}
    </div>
  )
}

export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
  largura = 640,
}: {
  titulo: string
  aberto: boolean
  aoFechar: () => void
  children: ReactNode
  largura?: number
}) {
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = ''
    }
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div
        className="modal"
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-topo">
          <h2>{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            &times;
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  )
}

export function Campo({
  rotulo,
  children,
  dica,
  obrigatorio = false,
}: {
  rotulo: string
  children: ReactNode
  dica?: string
  obrigatorio?: boolean
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && <em className="campo-obrigatorio"> *</em>}
      </span>
      {children}
      {dica && <small className="campo-dica">{dica}</small>}
    </label>
  )
}

export function Tabela({
  colunas,
  children,
  vazio,
}: {
  colunas: string[]
  children: ReactNode
  vazio?: string
}) {
  const semLinhas = Array.isArray(children) ? children.flat().length === 0 : !children
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semLinhas ? (
            <tr>
              <td colSpan={colunas.length} className="tabela-vazia">
                {vazio ?? 'Nenhum registro encontrado.'}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
