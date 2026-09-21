/** Tipos espelhando os contratos da API (backend/app/schemas.py). */

export type Papel = 'admin' | 'voluntario'
export type TipoDoador = 'pessoa_fisica' | 'pessoa_juridica' | 'anonimo'
export type StatusIntencao = 'pendente' | 'em_contato' | 'recebida' | 'cancelada'

export interface Usuario {
  id: number
  nome: string
  email: string
  papel: Papel
  ativo: boolean
  criado_em: string
}

export interface Sessao {
  access_token: string
  token_type: string
  usuario: Usuario
}

export interface Categoria {
  id: number
  nome: string
  descricao: string | null
  perecivel: boolean
}

export interface Item {
  id: number
  nome: string
  categoria_id: number
  unidade: string
  estoque_minimo: number
  ativo: boolean
  categoria: Categoria | null
}

export interface Doador {
  id: number
  nome: string
  tipo: TipoDoador
  documento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  ativo: boolean
  criado_em: string
}

export interface DoadorResumo {
  id: number
  nome: string
  tipo: TipoDoador
  telefone: string | null
  email: string | null
  total_doacoes: number
  total_itens: number
  ultima_doacao: string | null
}

export interface DoacaoItem {
  id: number
  item_id: number
  quantidade: number
  validade: string | null
  item: Item | null
}

export interface Doacao {
  id: number
  doador_id: number | null
  data_recebimento: string
  campanha: string | null
  observacoes: string | null
  criado_em: string
  doador: Doador | null
  recebido_por: Usuario | null
  itens: DoacaoItem[]
}

export interface DestinacaoItem {
  id: number
  item_id: number
  quantidade: number
  item: Item | null
}

export interface Destinacao {
  id: number
  beneficiario: string
  tipo_beneficiario: string
  data: string
  observacoes: string | null
  criado_em: string
  responsavel: Usuario | null
  itens: DestinacaoItem[]
}

export interface EstoqueLinha {
  item_id: number
  item: string
  categoria: string
  unidade: string
  saldo: number
  estoque_minimo: number
  em_falta: boolean
  falta_quantidade: number
  proxima_validade: string | null
  quantidade_vencendo: number
  quantidade_vencida: number
}

export interface Lote {
  id: number
  item_id: number
  validade: string | null
  quantidade_atual: number
  quantidade_inicial: number
}

export interface Perda {
  id: number
  item_id: number
  quantidade: number
  motivo: string
  data: string
  observacoes: string | null
  item: Item | null
}

export interface IntencaoItem {
  id: number
  item_id: number
  quantidade: number
  item: Item | null
}

export interface Intencao {
  id: number
  nome: string
  telefone: string | null
  email: string | null
  mensagem: string | null
  status: StatusIntencao
  criado_em: string
  itens: IntencaoItem[]
}

export interface Necessidade {
  item_id: number
  item: string
  categoria: string
  unidade: string
  falta_quantidade: number
  prioridade: 'urgente' | 'alta' | 'media'
}

export interface Transparencia {
  instituicao: string
  cidade: string
  total_itens_recebidos: number
  total_itens_destinados: number
  total_doacoes: number
  total_beneficiarios: number
  itens_em_falta: number
  atualizado_em: string
}

export interface SerieMes {
  periodo: string
  entradas: number
  saidas: number
}

export interface RankingLinha {
  rotulo: string
  valor: number
}

export interface Indicadores {
  total_itens_estoque: number
  itens_distintos: number
  itens_em_falta: number
  lotes_vencendo: number
  lotes_vencidos: number
  doacoes_mes: number
  itens_recebidos_mes: number
  itens_destinados_mes: number
  doadores_ativos: number
  intencoes_pendentes: number
  serie: SerieMes[]
  top_itens: RankingLinha[]
  por_categoria: RankingLinha[]
}

export interface RelatorioMovimento {
  inicio: string
  fim: string
  entradas_total: number
  saidas_total: number
  perdas_total: number
  entradas_por_item: RankingLinha[]
  saidas_por_item: RankingLinha[]
  entradas_por_categoria: RankingLinha[]
  destinacoes_por_beneficiario: RankingLinha[]
  top_doadores: RankingLinha[]
  itens_menos_doados: RankingLinha[]
}

export interface InfoPublica {
  instituicao: string
  cidade: string
  url_publica: string
}
