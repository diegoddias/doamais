"""Indicadores do painel e relatorios de movimentacao."""
import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    Categoria,
    Destinacao,
    DestinacaoItem,
    Doacao,
    DoacaoItem,
    Doador,
    IntencaoDoacao,
    Item,
    Lote,
    Perda,
    StatusIntencao,
)
from ..schemas import Indicadores, RankingLinha, RelatorioMovimento, SerieMes
from ..security import usuario_atual
from ..services import linhas_de_estoque

router = APIRouter(
    prefix="/api/relatorios", tags=["Relatorios"], dependencies=[Depends(usuario_atual)]
)


def _primeiro_dia(referencia: date) -> date:
    return referencia.replace(day=1)


def _mes_anterior(referencia: date) -> date:
    return (referencia.replace(day=1) - timedelta(days=1)).replace(day=1)


def _ranking(linhas) -> list[RankingLinha]:
    return [RankingLinha(rotulo=str(r[0]), valor=round(float(r[1] or 0), 2)) for r in linhas]


@router.get("/indicadores", response_model=Indicadores, summary="Indicadores do painel inicial")
def indicadores(db: Session = Depends(get_db)) -> Indicadores:
    hoje = date.today()
    inicio_mes = _primeiro_dia(hoje)
    limite_alerta = hoje + timedelta(days=settings.dias_alerta_validade)

    estoque = linhas_de_estoque(db)
    total_estoque = round(sum(linha["saldo"] for linha in estoque), 2)
    itens_distintos = sum(1 for linha in estoque if linha["saldo"] > 0)
    itens_em_falta = sum(1 for linha in estoque if linha["em_falta"])

    lotes_vencendo = (
        db.scalar(
            select(func.count(Lote.id)).where(
                Lote.quantidade_atual > 0,
                Lote.validade.is_not(None),
                Lote.validade >= hoje,
                Lote.validade <= limite_alerta,
            )
        )
        or 0
    )
    lotes_vencidos = (
        db.scalar(
            select(func.count(Lote.id)).where(
                Lote.quantidade_atual > 0, Lote.validade.is_not(None), Lote.validade < hoje
            )
        )
        or 0
    )

    doacoes_mes = (
        db.scalar(select(func.count(Doacao.id)).where(Doacao.data_recebimento >= inicio_mes)) or 0
    )
    itens_recebidos_mes = (
        db.scalar(
            select(func.coalesce(func.sum(DoacaoItem.quantidade), 0.0))
            .join(Doacao, Doacao.id == DoacaoItem.doacao_id)
            .where(Doacao.data_recebimento >= inicio_mes)
        )
        or 0.0
    )
    itens_destinados_mes = (
        db.scalar(
            select(func.coalesce(func.sum(DestinacaoItem.quantidade), 0.0))
            .join(Destinacao, Destinacao.id == DestinacaoItem.destinacao_id)
            .where(Destinacao.data >= inicio_mes)
        )
        or 0.0
    )

    doadores_ativos = db.scalar(select(func.count(Doador.id)).where(Doador.ativo.is_(True))) or 0
    intencoes_pendentes = (
        db.scalar(
            select(func.count(IntencaoDoacao.id)).where(
                IntencaoDoacao.status == StatusIntencao.pendente
            )
        )
        or 0
    )

    # Serie dos ultimos 6 meses, montada em Python para nao depender de
    # funcoes de data especificas de cada banco.
    meses: list[date] = []
    cursor = inicio_mes
    for _ in range(6):
        meses.append(cursor)
        cursor = _mes_anterior(cursor)
    meses.reverse()

    serie: list[SerieMes] = []
    for inicio in meses:
        fim = (inicio + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        entradas = (
            db.scalar(
                select(func.coalesce(func.sum(DoacaoItem.quantidade), 0.0))
                .join(Doacao, Doacao.id == DoacaoItem.doacao_id)
                .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
            )
            or 0.0
        )
        saidas = (
            db.scalar(
                select(func.coalesce(func.sum(DestinacaoItem.quantidade), 0.0))
                .join(Destinacao, Destinacao.id == DestinacaoItem.destinacao_id)
                .where(Destinacao.data >= inicio, Destinacao.data <= fim)
            )
            or 0.0
        )
        serie.append(
            SerieMes(
                periodo=inicio.strftime("%m/%Y"),
                entradas=round(float(entradas), 2),
                saidas=round(float(saidas), 2),
            )
        )

    top_itens = _ranking(
        db.execute(
            select(Item.nome, func.sum(DoacaoItem.quantidade))
            .join(DoacaoItem, DoacaoItem.item_id == Item.id)
            .group_by(Item.nome)
            .order_by(func.sum(DoacaoItem.quantidade).desc())
            .limit(8)
        ).all()
    )

    por_categoria = [
        RankingLinha(rotulo=nome, valor=round(valor, 2))
        for nome, valor in sorted(
            _agrupar_estoque_por_categoria(estoque).items(), key=lambda kv: -kv[1]
        )
    ]

    return Indicadores(
        total_itens_estoque=total_estoque,
        itens_distintos=itens_distintos,
        itens_em_falta=itens_em_falta,
        lotes_vencendo=int(lotes_vencendo),
        lotes_vencidos=int(lotes_vencidos),
        doacoes_mes=int(doacoes_mes),
        itens_recebidos_mes=round(float(itens_recebidos_mes), 2),
        itens_destinados_mes=round(float(itens_destinados_mes), 2),
        doadores_ativos=int(doadores_ativos),
        intencoes_pendentes=int(intencoes_pendentes),
        serie=serie,
        top_itens=top_itens,
        por_categoria=por_categoria,
    )


def _agrupar_estoque_por_categoria(estoque: list[dict]) -> dict[str, float]:
    agrupado: dict[str, float] = {}
    for linha in estoque:
        if linha["saldo"] <= 0:
            continue
        agrupado[linha["categoria"]] = agrupado.get(linha["categoria"], 0.0) + linha["saldo"]
    return agrupado


@router.get(
    "/movimento",
    response_model=RelatorioMovimento,
    summary="Entradas, saidas e destinacoes de um periodo",
)
def movimento(
    db: Session = Depends(get_db),
    inicio: date = Query(...),
    fim: date = Query(...),
) -> RelatorioMovimento:
    entradas_total = (
        db.scalar(
            select(func.coalesce(func.sum(DoacaoItem.quantidade), 0.0))
            .join(Doacao, Doacao.id == DoacaoItem.doacao_id)
            .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
        )
        or 0.0
    )
    saidas_total = (
        db.scalar(
            select(func.coalesce(func.sum(DestinacaoItem.quantidade), 0.0))
            .join(Destinacao, Destinacao.id == DestinacaoItem.destinacao_id)
            .where(Destinacao.data >= inicio, Destinacao.data <= fim)
        )
        or 0.0
    )
    perdas_total = (
        db.scalar(
            select(func.coalesce(func.sum(Perda.quantidade), 0.0)).where(
                Perda.data >= inicio, Perda.data <= fim
            )
        )
        or 0.0
    )

    entradas_por_item = _ranking(
        db.execute(
            select(Item.nome, func.sum(DoacaoItem.quantidade))
            .join(DoacaoItem, DoacaoItem.item_id == Item.id)
            .join(Doacao, Doacao.id == DoacaoItem.doacao_id)
            .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
            .group_by(Item.nome)
            .order_by(func.sum(DoacaoItem.quantidade).desc())
        ).all()
    )
    saidas_por_item = _ranking(
        db.execute(
            select(Item.nome, func.sum(DestinacaoItem.quantidade))
            .join(DestinacaoItem, DestinacaoItem.item_id == Item.id)
            .join(Destinacao, Destinacao.id == DestinacaoItem.destinacao_id)
            .where(Destinacao.data >= inicio, Destinacao.data <= fim)
            .group_by(Item.nome)
            .order_by(func.sum(DestinacaoItem.quantidade).desc())
        ).all()
    )
    entradas_por_categoria = _ranking(
        db.execute(
            select(Categoria.nome, func.sum(DoacaoItem.quantidade))
            .join(Item, Item.categoria_id == Categoria.id)
            .join(DoacaoItem, DoacaoItem.item_id == Item.id)
            .join(Doacao, Doacao.id == DoacaoItem.doacao_id)
            .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
            .group_by(Categoria.nome)
            .order_by(func.sum(DoacaoItem.quantidade).desc())
        ).all()
    )
    destinacoes_por_beneficiario = _ranking(
        db.execute(
            select(Destinacao.beneficiario, func.sum(DestinacaoItem.quantidade))
            .join(DestinacaoItem, DestinacaoItem.destinacao_id == Destinacao.id)
            .where(Destinacao.data >= inicio, Destinacao.data <= fim)
            .group_by(Destinacao.beneficiario)
            .order_by(func.sum(DestinacaoItem.quantidade).desc())
        ).all()
    )
    top_doadores = _ranking(
        db.execute(
            select(Doador.nome, func.sum(DoacaoItem.quantidade))
            .join(Doacao, Doacao.doador_id == Doador.id)
            .join(DoacaoItem, DoacaoItem.doacao_id == Doacao.id)
            .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
            .group_by(Doador.nome)
            .order_by(func.sum(DoacaoItem.quantidade).desc())
            .limit(10)
        ).all()
    )

    return RelatorioMovimento(
        inicio=inicio,
        fim=fim,
        entradas_total=round(float(entradas_total), 2),
        saidas_total=round(float(saidas_total), 2),
        perdas_total=round(float(perdas_total), 2),
        entradas_por_item=entradas_por_item,
        saidas_por_item=saidas_por_item,
        entradas_por_categoria=entradas_por_categoria,
        destinacoes_por_beneficiario=destinacoes_por_beneficiario,
        top_doadores=top_doadores,
        itens_menos_doados=list(reversed(entradas_por_item))[:10],
    )


@router.get("/estoque.csv", summary="Exporta o estoque atual em CSV")
def estoque_csv(db: Session = Depends(get_db)) -> StreamingResponse:
    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=";")
    escritor.writerow(
        [
            "Item",
            "Categoria",
            "Unidade",
            "Saldo",
            "Estoque minimo",
            "Em falta",
            "Falta",
            "Proxima validade",
            "Vencendo",
            "Vencido",
        ]
    )
    for linha in linhas_de_estoque(db):
        escritor.writerow(
            [
                linha["item"],
                linha["categoria"],
                linha["unidade"],
                f"{linha['saldo']:.2f}".replace(".", ","),
                f"{linha['estoque_minimo']:.2f}".replace(".", ","),
                "SIM" if linha["em_falta"] else "NAO",
                f"{linha['falta_quantidade']:.2f}".replace(".", ","),
                linha["proxima_validade"].strftime("%d/%m/%Y")
                if linha["proxima_validade"]
                else "",
                f"{linha['quantidade_vencendo']:.2f}".replace(".", ","),
                f"{linha['quantidade_vencida']:.2f}".replace(".", ","),
            ]
        )

    buffer.seek(0)
    nome = f"estoque-doamais-{date.today():%Y-%m-%d}.csv"
    return StreamingResponse(
        iter([buffer.getvalue().encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )


@router.get("/doacoes.csv", summary="Exporta as doacoes de um periodo em CSV")
def doacoes_csv(
    db: Session = Depends(get_db),
    inicio: date = Query(...),
    fim: date = Query(...),
) -> StreamingResponse:
    consulta = (
        select(
            Doacao.id,
            Doacao.data_recebimento,
            Doador.nome,
            Item.nome,
            DoacaoItem.quantidade,
            Item.unidade,
            DoacaoItem.validade,
            Doacao.campanha,
        )
        .join(DoacaoItem, DoacaoItem.doacao_id == Doacao.id)
        .join(Item, Item.id == DoacaoItem.item_id)
        .outerjoin(Doador, Doador.id == Doacao.doador_id)
        .where(Doacao.data_recebimento >= inicio, Doacao.data_recebimento <= fim)
        .order_by(Doacao.data_recebimento, Doacao.id)
    )

    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=";")
    escritor.writerow(
        ["Doacao", "Data", "Doador", "Item", "Quantidade", "Unidade", "Validade", "Campanha"]
    )
    for doacao_id, data, doador, item, qtd, unidade, validade, campanha in db.execute(
        consulta
    ).all():
        escritor.writerow(
            [
                doacao_id,
                data.strftime("%d/%m/%Y"),
                doador or "Anonimo",
                item,
                f"{float(qtd):.2f}".replace(".", ","),
                unidade,
                validade.strftime("%d/%m/%Y") if validade else "",
                campanha or "",
            ]
        )

    buffer.seek(0)
    nome = f"doacoes-{inicio:%Y%m%d}-a-{fim:%Y%m%d}.csv"
    return StreamingResponse(
        iter([buffer.getvalue().encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )
