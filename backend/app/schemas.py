"""Contratos de entrada e saida da API (Pydantic v2)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import Papel, StatusIntencao, TipoDoador

ORM = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Autenticacao e usuarios
# --------------------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioOut"


class LoginIn(BaseModel):
    email: str
    senha: str


class UsuarioBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    papel: Papel = Papel.voluntario
    ativo: bool = True


class UsuarioIn(UsuarioBase):
    senha: str = Field(min_length=6, max_length=72)


class UsuarioUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    papel: Papel | None = None
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=6, max_length=72)


class UsuarioOut(UsuarioBase):
    model_config = ORM
    id: int
    criado_em: datetime


# --------------------------------------------------------------------------
# Catalogo
# --------------------------------------------------------------------------
class CategoriaIn(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    descricao: str | None = None
    perecivel: bool = False


class CategoriaOut(CategoriaIn):
    model_config = ORM
    id: int


class ItemIn(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    categoria_id: int
    unidade: str = Field(default="un", max_length=20)
    estoque_minimo: float = Field(default=0, ge=0)
    ativo: bool = True


class ItemUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    categoria_id: int | None = None
    unidade: str | None = Field(default=None, max_length=20)
    estoque_minimo: float | None = Field(default=None, ge=0)
    ativo: bool | None = None


class ItemOut(BaseModel):
    model_config = ORM
    id: int
    nome: str
    categoria_id: int
    unidade: str
    estoque_minimo: float
    ativo: bool
    categoria: CategoriaOut | None = None


# --------------------------------------------------------------------------
# Doadores
# --------------------------------------------------------------------------
class DoadorIn(BaseModel):
    nome: str = Field(min_length=2, max_length=160)
    tipo: TipoDoador = TipoDoador.pessoa_fisica
    documento: str | None = Field(default=None, max_length=30)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=180)
    endereco: str | None = Field(default=None, max_length=255)
    observacoes: str | None = None
    ativo: bool = True


class DoadorUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=160)
    tipo: TipoDoador | None = None
    documento: str | None = None
    telefone: str | None = None
    email: str | None = None
    endereco: str | None = None
    observacoes: str | None = None
    ativo: bool | None = None


class DoadorOut(DoadorIn):
    model_config = ORM
    id: int
    criado_em: datetime


class DoadorResumo(BaseModel):
    model_config = ORM
    id: int
    nome: str
    tipo: TipoDoador
    telefone: str | None = None
    email: str | None = None
    total_doacoes: int = 0
    total_itens: float = 0
    ultima_doacao: date | None = None


# --------------------------------------------------------------------------
# Doacoes (entradas)
# --------------------------------------------------------------------------
class DoacaoItemIn(BaseModel):
    item_id: int
    quantidade: float = Field(gt=0)
    validade: date | None = None


class DoacaoIn(BaseModel):
    doador_id: int | None = None
    data_recebimento: date
    campanha: str | None = Field(default=None, max_length=120)
    observacoes: str | None = None
    itens: list[DoacaoItemIn] = Field(min_length=1)


class DoacaoItemOut(BaseModel):
    model_config = ORM
    id: int
    item_id: int
    quantidade: float
    validade: date | None = None
    item: ItemOut | None = None


class DoacaoOut(BaseModel):
    model_config = ORM
    id: int
    doador_id: int | None
    data_recebimento: date
    campanha: str | None
    observacoes: str | None
    criado_em: datetime
    doador: DoadorOut | None = None
    recebido_por: UsuarioOut | None = None
    itens: list[DoacaoItemOut] = []


# --------------------------------------------------------------------------
# Destinacoes (saidas)
# --------------------------------------------------------------------------
class DestinacaoItemIn(BaseModel):
    item_id: int
    quantidade: float = Field(gt=0)


class DestinacaoIn(BaseModel):
    beneficiario: str = Field(min_length=2, max_length=180)
    tipo_beneficiario: str = Field(default="familia", max_length=40)
    data: date
    observacoes: str | None = None
    itens: list[DestinacaoItemIn] = Field(min_length=1)


class DestinacaoItemOut(BaseModel):
    model_config = ORM
    id: int
    item_id: int
    quantidade: float
    item: ItemOut | None = None


class DestinacaoOut(BaseModel):
    model_config = ORM
    id: int
    beneficiario: str
    tipo_beneficiario: str
    data: date
    observacoes: str | None
    criado_em: datetime
    responsavel: UsuarioOut | None = None
    itens: list[DestinacaoItemOut] = []


# --------------------------------------------------------------------------
# Estoque
# --------------------------------------------------------------------------
class EstoqueLinha(BaseModel):
    item_id: int
    item: str
    categoria: str
    unidade: str
    saldo: float
    estoque_minimo: float
    em_falta: bool
    falta_quantidade: float
    proxima_validade: date | None = None
    quantidade_vencendo: float = 0
    quantidade_vencida: float = 0


class LoteOut(BaseModel):
    model_config = ORM
    id: int
    item_id: int
    validade: date | None
    quantidade_atual: float
    quantidade_inicial: float


class PerdaIn(BaseModel):
    item_id: int
    quantidade: float = Field(gt=0)
    motivo: str = Field(default="vencimento", max_length=40)
    data: date
    observacoes: str | None = None


class PerdaOut(BaseModel):
    model_config = ORM
    id: int
    item_id: int
    quantidade: float
    motivo: str
    data: date
    observacoes: str | None = None
    item: ItemOut | None = None


# --------------------------------------------------------------------------
# Canal publico / intencoes de doacao
# --------------------------------------------------------------------------
class IntencaoItemIn(BaseModel):
    item_id: int
    quantidade: float = Field(gt=0)


class IntencaoIn(BaseModel):
    nome: str = Field(min_length=2, max_length=160)
    telefone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=180)
    mensagem: str | None = None
    itens: list[IntencaoItemIn] = Field(min_length=1)


class IntencaoItemOut(BaseModel):
    model_config = ORM
    id: int
    item_id: int
    quantidade: float
    item: ItemOut | None = None


class IntencaoOut(BaseModel):
    model_config = ORM
    id: int
    nome: str
    telefone: str | None
    email: str | None
    mensagem: str | None
    status: StatusIntencao
    criado_em: datetime
    itens: list[IntencaoItemOut] = []


class IntencaoStatusIn(BaseModel):
    status: StatusIntencao


class NecessidadePublica(BaseModel):
    item_id: int
    item: str
    categoria: str
    unidade: str
    falta_quantidade: float
    prioridade: str


class TransparenciaPublica(BaseModel):
    instituicao: str
    cidade: str
    total_itens_recebidos: float
    total_itens_destinados: float
    total_doacoes: int
    total_beneficiarios: int
    itens_em_falta: int
    atualizado_em: datetime


# --------------------------------------------------------------------------
# Relatorios e indicadores
# --------------------------------------------------------------------------
class SerieMes(BaseModel):
    periodo: str
    entradas: float
    saidas: float


class RankingLinha(BaseModel):
    rotulo: str
    valor: float


class Indicadores(BaseModel):
    total_itens_estoque: float
    itens_distintos: int
    itens_em_falta: int
    lotes_vencendo: int
    lotes_vencidos: int
    doacoes_mes: int
    itens_recebidos_mes: float
    itens_destinados_mes: float
    doadores_ativos: int
    intencoes_pendentes: int
    serie: list[SerieMes] = []
    top_itens: list[RankingLinha] = []
    por_categoria: list[RankingLinha] = []


class RelatorioMovimento(BaseModel):
    inicio: date
    fim: date
    entradas_total: float
    saidas_total: float
    perdas_total: float
    entradas_por_item: list[RankingLinha]
    saidas_por_item: list[RankingLinha]
    entradas_por_categoria: list[RankingLinha]
    destinacoes_por_beneficiario: list[RankingLinha]
    top_doadores: list[RankingLinha]
    itens_menos_doados: list[RankingLinha]


Token.model_rebuild()
