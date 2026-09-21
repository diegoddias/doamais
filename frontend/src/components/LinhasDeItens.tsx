/** Editor das linhas de item usado ao registrar uma doacao ou uma entrega. */
import { Campo } from './ui'
import type { Item } from '../lib/tipos'

export interface LinhaItem {
  item_id: number | ''
  quantidade: string
  validade: string
}

export function linhaVazia(): LinhaItem {
  return { item_id: '', quantidade: '', validade: '' }
}

export function LinhasDeItens({
  linhas,
  itens,
  aoMudar,
  comValidade = false,
  saldos,
}: {
  linhas: LinhaItem[]
  itens: Item[]
  aoMudar: (linhas: LinhaItem[]) => void
  comValidade?: boolean
  /** Saldo disponivel por item, exibido como dica ao dar baixa. */
  saldos?: Record<number, { saldo: number; unidade: string }>
}) {
  function atualizar(indice: number, campo: keyof LinhaItem, valor: string) {
    const copia = linhas.map((l, i) =>
      i === indice ? { ...l, [campo]: campo === 'item_id' ? (valor === '' ? '' : Number(valor)) : valor } : l,
    )
    aoMudar(copia as LinhaItem[])
  }

  function remover(indice: number) {
    aoMudar(linhas.length === 1 ? [linhaVazia()] : linhas.filter((_, i) => i !== indice))
  }

  const porCategoria = itens.reduce<Record<string, Item[]>>((acc, item) => {
    const chave = item.categoria?.nome ?? 'Outros'
    ;(acc[chave] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="itens-editaveis">
      {linhas.map((linha, indice) => {
        const item = itens.find((i) => i.id === linha.item_id)
        const saldo = typeof linha.item_id === 'number' ? saldos?.[linha.item_id] : undefined
        return (
          <div className="item-editavel" key={indice}>
            <Campo rotulo={indice === 0 ? 'Item' : ''} obrigatorio={indice === 0}>
              <select
                value={linha.item_id}
                onChange={(e) => atualizar(indice, 'item_id', e.target.value)}
                required
              >
                <option value="">Selecione o item...</option>
                {Object.entries(porCategoria).map(([categoria, lista]) => (
                  <optgroup label={categoria} key={categoria}>
                    {lista.map((i) => (
                      <option value={i.id} key={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Campo>

            <Campo
              rotulo={indice === 0 ? 'Quantidade' : ''}
              obrigatorio={indice === 0}
              dica={
                saldo
                  ? `Disponível: ${saldo.saldo} ${saldo.unidade}`
                  : item
                    ? `em ${item.unidade}`
                    : undefined
              }
            >
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={linha.quantidade}
                onChange={(e) => atualizar(indice, 'quantidade', e.target.value)}
                placeholder="0"
                required
              />
            </Campo>

            {comValidade ? (
              <Campo
                rotulo={indice === 0 ? 'Validade' : ''}
                dica={indice === 0 ? 'Deixe vazio se não tiver' : undefined}
              >
                <input
                  type="date"
                  value={linha.validade}
                  onChange={(e) => atualizar(indice, 'validade', e.target.value)}
                />
              </Campo>
            ) : (
              <div />
            )}

            <button
              type="button"
              className="botao botao-secundario botao-pequeno"
              onClick={() => remover(indice)}
              aria-label="Remover este item"
            >
              Remover
            </button>
          </div>
        )
      })}

      <div>
        <button
          type="button"
          className="botao botao-secundario botao-pequeno"
          onClick={() => aoMudar([...linhas, linhaVazia()])}
        >
          + Adicionar outro item
        </button>
      </div>
    </div>
  )
}

/** Converte as linhas do formulario no formato aceito pela API. */
export function prepararLinhas(linhas: LinhaItem[], comValidade: boolean) {
  const validas = linhas.filter((l) => l.item_id !== '' && Number(l.quantidade) > 0)
  return validas.map((l) => ({
    item_id: Number(l.item_id),
    quantidade: Number(l.quantidade),
    ...(comValidade && l.validade ? { validade: l.validade } : {}),
  }))
}
