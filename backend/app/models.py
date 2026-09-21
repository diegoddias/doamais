"""Modelo de dados do Doa+.

O controle de estoque e feito por lotes: cada item recebido em uma doacao
gera um lote com sua propria validade. As saidas consomem os lotes pela
regra FEFO (first expire, first out), o que permite entregar tanto o saldo
por item quanto o alerta de vencimento exigidos pelo projeto.
"""
from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def agora() -> datetime:
    return datetime.now(timezone.utc)


class Papel(str, enum.Enum):
    admin = "admin"
    voluntario = "voluntario"


class TipoDoador(str, enum.Enum):
    pessoa_fisica = "pessoa_fisica"
    pessoa_juridica = "pessoa_juridica"
    anonimo = "anonimo"


class StatusIntencao(str, enum.Enum):
    pendente = "pendente"
    em_contato = "em_contato"
    recebida = "recebida"
    cancelada = "cancelada"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    papel: Mapped[Papel] = mapped_column(Enum(Papel), default=Papel.voluntario, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(255))
    perecivel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    itens: Mapped[list["Item"]] = relationship(back_populates="categoria")


class Item(Base):
    """Item do catalogo. Nao guarda quantidade; o saldo vem dos lotes."""

    __tablename__ = "itens"
    __table_args__ = (UniqueConstraint("nome", "categoria_id", name="uq_item_nome_categoria"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), nullable=False)
    unidade: Mapped[str] = mapped_column(String(20), default="un", nullable=False)
    estoque_minimo: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    categoria: Mapped["Categoria"] = relationship(back_populates="itens")
    lotes: Mapped[list["Lote"]] = relationship(back_populates="item")


class Doador(Base):
    __tablename__ = "doadores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    tipo: Mapped[TipoDoador] = mapped_column(Enum(TipoDoador), default=TipoDoador.pessoa_fisica)
    documento: Mapped[str | None] = mapped_column(String(30))
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(180))
    endereco: Mapped[str | None] = mapped_column(String(255))
    observacoes: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    doacoes: Mapped[list["Doacao"]] = relationship(back_populates="doador")


class Doacao(Base):
    """Entrada de donativos."""

    __tablename__ = "doacoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    doador_id: Mapped[int | None] = mapped_column(ForeignKey("doadores.id"))
    data_recebimento: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    recebido_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    campanha: Mapped[str | None] = mapped_column(String(120))
    observacoes: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    doador: Mapped["Doador | None"] = relationship(back_populates="doacoes")
    recebido_por: Mapped["Usuario | None"] = relationship()
    itens: Mapped[list["DoacaoItem"]] = relationship(
        back_populates="doacao", cascade="all, delete-orphan"
    )


class DoacaoItem(Base):
    __tablename__ = "doacao_itens"

    id: Mapped[int] = mapped_column(primary_key=True)
    doacao_id: Mapped[int] = mapped_column(ForeignKey("doacoes.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id"), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)
    validade: Mapped[date | None] = mapped_column(Date)

    doacao: Mapped["Doacao"] = relationship(back_populates="itens")
    item: Mapped["Item"] = relationship()


class Lote(Base):
    """Saldo fisico disponivel, segmentado por validade."""

    __tablename__ = "lotes"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id"), nullable=False, index=True)
    doacao_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("doacao_itens.id", ondelete="CASCADE")
    )
    validade: Mapped[date | None] = mapped_column(Date, index=True)
    quantidade_inicial: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)
    quantidade_atual: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    item: Mapped["Item"] = relationship(back_populates="lotes")


class Destinacao(Base):
    """Saida de donativos para uma familia ou entidade assistencial."""

    __tablename__ = "destinacoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    beneficiario: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    tipo_beneficiario: Mapped[str] = mapped_column(String(40), default="familia")
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    responsavel: Mapped["Usuario | None"] = relationship()
    itens: Mapped[list["DestinacaoItem"]] = relationship(
        back_populates="destinacao", cascade="all, delete-orphan"
    )


class DestinacaoItem(Base):
    __tablename__ = "destinacao_itens"

    id: Mapped[int] = mapped_column(primary_key=True)
    destinacao_id: Mapped[int] = mapped_column(ForeignKey("destinacoes.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id"), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)

    destinacao: Mapped["Destinacao"] = relationship(back_populates="itens")
    item: Mapped["Item"] = relationship()


class IntencaoDoacao(Base):
    """Registro vindo do formulario publico acessado por QR Code."""

    __tablename__ = "intencoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(180))
    mensagem: Mapped[str | None] = mapped_column(Text)
    status: Mapped[StatusIntencao] = mapped_column(
        Enum(StatusIntencao), default=StatusIntencao.pendente, nullable=False, index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=agora)

    itens: Mapped[list["IntencaoItem"]] = relationship(
        back_populates="intencao", cascade="all, delete-orphan"
    )


class IntencaoItem(Base):
    __tablename__ = "intencao_itens"

    id: Mapped[int] = mapped_column(primary_key=True)
    intencao_id: Mapped[int] = mapped_column(ForeignKey("intencoes.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id"), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)

    intencao: Mapped["IntencaoDoacao"] = relationship(back_populates="itens")
    item: Mapped["Item"] = relationship()


class Perda(Base):
    """Baixa de itens por vencimento ou avaria, para o indicador de perdas."""

    __tablename__ = "perdas"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id"), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 2, asdecimal=False), nullable=False)
    motivo: Mapped[str] = mapped_column(String(40), default="vencimento")
    data: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    registrado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    observacoes: Mapped[str | None] = mapped_column(Text)

    item: Mapped["Item"] = relationship()
