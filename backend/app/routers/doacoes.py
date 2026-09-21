"""Registro das doacoes recebidas (entradas de estoque)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Doacao, DoacaoItem, Doador, Lote, Usuario
from ..schemas import DoacaoIn, DoacaoOut
from ..security import apenas_admin, usuario_atual
from ..services import entrada_em_lote, garantir_item

router = APIRouter(prefix="/api/doacoes", tags=["Doacoes"], dependencies=[Depends(usuario_atual)])

CARREGAR_TUDO = (
    selectinload(Doacao.itens).selectinload(DoacaoItem.item),
    selectinload(Doacao.doador),
    selectinload(Doacao.recebido_por),
)


@router.get("", response_model=list[DoacaoOut], summary="Lista as doacoes recebidas")
def listar(
    db: Session = Depends(get_db),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    doador_id: int | None = Query(default=None),
    campanha: str | None = Query(default=None),
    limite: int = Query(default=200, ge=1, le=1000),
) -> list[Doacao]:
    consulta = (
        select(Doacao)
        .options(*CARREGAR_TUDO)
        .order_by(Doacao.data_recebimento.desc(), Doacao.id.desc())
        .limit(limite)
    )
    if inicio:
        consulta = consulta.where(Doacao.data_recebimento >= inicio)
    if fim:
        consulta = consulta.where(Doacao.data_recebimento <= fim)
    if doador_id:
        consulta = consulta.where(Doacao.doador_id == doador_id)
    if campanha:
        consulta = consulta.where(Doacao.campanha.ilike(f"%{campanha.strip()}%"))
    return list(db.scalars(consulta).all())


@router.post(
    "",
    response_model=DoacaoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra uma doacao e da entrada no estoque",
)
def criar(
    dados: DoacaoIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
) -> Doacao:
    if dados.doador_id is not None and db.get(Doador, dados.doador_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doador nao encontrado.")
    if dados.data_recebimento > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de recebimento nao pode ser futura.",
        )

    doacao = Doacao(
        doador_id=dados.doador_id,
        data_recebimento=dados.data_recebimento,
        recebido_por_id=usuario.id,
        campanha=(dados.campanha or None),
        observacoes=dados.observacoes,
    )
    db.add(doacao)
    db.flush()

    for linha in dados.itens:
        garantir_item(db, linha.item_id)
        doacao_item = DoacaoItem(
            doacao_id=doacao.id,
            item_id=linha.item_id,
            quantidade=linha.quantidade,
            validade=linha.validade,
        )
        db.add(doacao_item)
        db.flush()
        entrada_em_lote(db, doacao_item)

    db.commit()
    db.refresh(doacao)
    return doacao


@router.get("/{doacao_id}", response_model=DoacaoOut, summary="Detalha uma doacao")
def detalhar(doacao_id: int, db: Session = Depends(get_db)) -> Doacao:
    doacao = db.scalar(select(Doacao).options(*CARREGAR_TUDO).where(Doacao.id == doacao_id))
    if doacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doacao nao encontrada.")
    return doacao


@router.delete(
    "/{doacao_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(apenas_admin)],
    summary="Estorna uma doacao registrada por engano",
)
def estornar(doacao_id: int, db: Session = Depends(get_db)) -> None:
    doacao = db.scalar(
        select(Doacao).options(selectinload(Doacao.itens)).where(Doacao.id == doacao_id)
    )
    if doacao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doacao nao encontrada.")

    # So permite o estorno enquanto os lotes gerados continuam intactos:
    # se parte ja foi destinada, o historico de saida ficaria inconsistente.
    ids_itens = [item.id for item in doacao.itens]
    lotes = (
        list(db.scalars(select(Lote).where(Lote.doacao_item_id.in_(ids_itens))).all())
        if ids_itens
        else []
    )
    for lote in lotes:
        if float(lote.quantidade_atual) < float(lote.quantidade_inicial) - 1e-9:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Esta doacao ja teve itens destinados e nao pode ser estornada. "
                    "Registre um ajuste em Perdas ou uma nova destinacao."
                ),
            )

    for lote in lotes:
        db.delete(lote)
    db.delete(doacao)
    db.commit()
