/** Cliente HTTP do Doa+. Anexa o token e traduz erros da API. */

const CHAVE_TOKEN = 'doamais.token'

export function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function gravarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token)
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* navegacao privada: a sessao vale so enquanto a aba estiver aberta */
  }
}

export class ErroApi extends Error {
  status: number
  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.status = status
  }
}

type Opcoes = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  corpo?: unknown
  publico?: boolean
}

async function extrairMensagem(resposta: Response): Promise<string> {
  try {
    const dados = await resposta.json()
    const detalhe = dados?.detail
    if (typeof detalhe === 'string') return detalhe
    if (Array.isArray(detalhe) && detalhe.length) {
      // Erros de validacao do Pydantic vem como lista de objetos.
      return detalhe
        .map((e: { loc?: string[]; msg?: string }) => {
          const campo = e.loc?.filter((p) => p !== 'body').join(' > ')
          return campo ? `${campo}: ${e.msg}` : e.msg
        })
        .join('; ')
    }
  } catch {
    /* resposta sem corpo JSON */
  }
  return `Falha na comunicacao com o servidor (${resposta.status}).`
}

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, publico = false } = opcoes
  const cabecalhos: Record<string, string> = {}

  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  if (!publico) {
    const token = lerToken()
    if (token) cabecalhos['Authorization'] = `Bearer ${token}`
  }

  let resposta: Response
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi('Nao foi possivel falar com o servidor. Verifique sua conexao.', 0)
  }

  if (resposta.status === 401 && !publico) {
    gravarToken(null)
    window.dispatchEvent(new CustomEvent('doamais:sessao-expirada'))
    throw new ErroApi('Sua sessao expirou. Entre novamente.', 401)
  }

  if (!resposta.ok) {
    throw new ErroApi(await extrairMensagem(resposta), resposta.status)
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

/** Baixa um arquivo gerado pela API respeitando o cabecalho de autenticacao. */
export async function baixarArquivo(caminho: string, nomeSugerido: string) {
  const token = lerToken()
  const resposta = await fetch(caminho, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resposta.ok) throw new ErroApi(await extrairMensagem(resposta), resposta.status)

  const blob = await resposta.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeSugerido
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
