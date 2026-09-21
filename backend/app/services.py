"""Regras de negocio de estoque.

Concentra aqui a logica que nao pertence a nenhum endpoint em particular:
entrada de lotes, baixa FEFO e calculo do saldo consolidado por item.
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .models import Categoria, DoacaoItem, Item, Lote


def saldo_do_item(db: Session, item_id: int) -> float:
    total = db.scalar(
        select(func.coalesce(func.sum(Lote.quantidade_atual), 0.0)).where(Lote.item_id == item_id)
    )
    return float(total or 0.0)


def entrada_em_lote(db: Session, doacao_item: DoacaoItem) -> Lote:
    """Cria o lote correspondente a um item recebido em uma doacao."""
    lote = Lote(
        item_id=doacao_item.item_id,
        doacao_item_id=doacao_item.id,
        validade=doacao_item.validade,
        quantidade_inicial=float(doacao_item.quantidade),
        quantidade_atual=float(doacao_item.quantidade),
    )
    db.add(lote)
    return lote


def baixar_estoque(db: Session, item_id: int, quantidade: float) -> None:
    """Consome `quantidade` do item pela regra FEFO.

    Lotes com validade mais proxima saem primeiro; lotes sem validade
    (roupas, utensilios) saem por ultimo, na ordem de entrada.
    """
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item {item_id} nao encontrado."
        )

    disponivel = saldo_do_item(db, item_id)
    if quantidade > disponivel + 1e-9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Saldo insuficiente de '{item.nome}': disponivel {disponivel:g} {item.unidade}, "
                f"solicitado {quantidade:g} {item.unidade}."
            ),
        )

    lotes = db.scalars(
        select(Lote)
        .where(Lote.item_id == item_id, Lote.quantidade_atual > 0)
        .order_by(Lote.validade.is_(None), Lote.validade.asc(), Lote.id.asc())
    ).all()

    restante = quantidade
    for lote in lotes:
        if restante <= 1e-9:
            break
        usar = min(float(lote.quantidade_atual), restante)
        lote.quantidade_atual = float(lote.quantidade_atual) - usar
        restante -= usar


def linhas_de_estoque(
    db: Session, *, somente_falta: bool = False, categoria_id: int | None = None
) -> list[dict]:
    """Monta a visao consolidada do estoque, item a item."""
    hoje = date.today()
    limite_alerta = hoje + timedelta(days=settings.dias_alerta_validade)

    consulta = (
        select(Item)
        .options(selectinload(Item.categoria), selectinload(Item.lotes))
        .where(Item.ativo.is_(True))
        .order_by(Item.nome)
    )
    if categoria_id is not None:
        consulta = consulta.where(Item.categoria_id == categoria_id)

    linhas: list[dict] = []
    for item in db.scalars(consulta).all():
        saldo = 0.0
        vencendo = 0.0
        vencida = 0.0
        proxima: date | None = None

        for lote in item.lotes:
            atual = float(lote.quantidade_atual)
            if atual <= 1e-9:
                continue
            saldo += atual
            if lote.validade is None:
                continue
            if lote.validade < hoje:
                vencida += atual
            elif lote.validade <= limite_alerta:
                vencendo += atual
            if proxima is None or lote.validade < proxima:
                proxima = lote.validade

        minimo = float(item.estoque_minimo or 0)
        falta = max(0.0, minimo - saldo)
        em_falta = falta > 1e-9

        if somente_falta and not em_falta:
            continue

        linhas.append(
            {
                "item_id": item.id,
                "item": item.nome,
                "categoria": item.categoria.nome if item.categoria else "",
                "unidade": item.unidade,
                "saldo": round(saldo, 2),
                "estoque_minimo": round(minimo, 2),
                "em_falta": em_falta,
                "falta_quantidade": round(falta, 2),
                "proxima_validade": proxima,
                "quantidade_vencendo": round(vencendo, 2),
                "quantidade_vencida": round(vencida, 2),
            }
        )

    return linhas


def prioridade_da_falta(falta: float, minimo: float) -> str:
    """Traduz o tamanho da falta em um rotulo legivel no canal publico."""
    if minimo <= 0:
        return "media"
    proporcao = falta / minimo
    if proporcao >= 0.75:
        return "urgente"
    if proporcao >= 0.35:
        return "alta"
    return "media"


def garantir_categoria(db: Session, categoria_id: int) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Categoria nao encontrada."
        )
    return categoria


def garantir_item(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")
    return item
