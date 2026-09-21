/** Formatacao e pequenos utilitarios compartilhados pelas telas. */

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return dataBR(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '0'
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function hojeISO(): string {
  const agora = new Date()
  const fuso = agora.getTimezoneOffset() * 60000
  return new Date(agora.getTime() - fuso).toISOString().slice(0, 10)
}

export function primeiroDiaDoMesISO(): string {
  const hoje = hojeISO()
  return `${hoje.slice(0, 7)}-01`
}

export function diasAte(iso: string | null): number | null {
  if (!iso) return null
  const alvo = new Date(`${iso}T00:00:00`)
  const hoje = new Date(`${hojeISO()}T00:00:00`)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

export const ROTULO_TIPO_DOADOR: Record<string, string> = {
  pessoa_fisica: 'Pessoa física',
  pessoa_juridica: 'Empresa/Entidade',
  anonimo: 'Anônimo',
}

export const ROTULO_STATUS_INTENCAO: Record<string, string> = {
  pendente: 'Pendente',
  em_contato: 'Em contato',
  recebida: 'Recebida',
  cancelada: 'Cancelada',
}

export const ROTULO_TIPO_BENEFICIARIO: Record<string, string> = {
  familia: 'Família',
  entidade: 'Entidade assistencial',
  campanha: 'Campanha/Evento',
  outro: 'Outro',
}

export const ROTULO_MOTIVO_PERDA: Record<string, string> = {
  vencimento: 'Vencimento',
  avaria: 'Avaria / mau estado',
  ajuste: 'Ajuste de inventário',
}

/** Paleta usada nos graficos, coerente com a identidade visual do sistema. */
export const CORES_GRAFICO = [
  '#0f6b4f',
  '#f5b700',
  '#2b7fd4',
  '#c1440e',
  '#6a4c93',
  '#1b998b',
  '#e07a5f',
  '#4a5859',
]
