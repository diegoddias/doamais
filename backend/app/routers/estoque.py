"""Consulta do estoque, alertas de validade e baixa por perda."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import Lote, Perda, Usuario
from ..schemas import EstoqueLinha, LoteOut, PerdaIn, PerdaOut
from ..security import usuario_atual
from ..services import baixar_estoque, garantir_item, linhas_de_estoque

router = APIRouter(prefix="/api/estoque", tags=["Estoque"], dependencies=[Depends(usuario_atual)])


@router.get("", response_model=list[EstoqueLinha], summary="Saldo consolidado por item")
def consultar(
    db: Session = Depends(get_db),
    categoria_id: int | None = Query(default=None),
    somente_falta: bool = Query(default=False, description="Retorna apenas itens abaixo do minimo"),
) -> list[dict]:
    return linhas_de_estoque(db, somente_falta=somente_falta, categoria_id=categoria_id)


@router.get(
    "/alertas/validade",
    response_model=list[LoteOut],
    summary="Lotes vencidos ou proximos do vencimento",
)
def alertas_validade(
    db: Session = Depends(get_db),
    dias: int = Query(default=settings.dias_alerta_validade, ge=0, le=365),
) -> list[Lote]:
    limite = date.today() + timedelta(days=dias)
    consulta = (
        select(Lote)
        .options(selectinload(Lote.item))
        .where(
            Lote.quantidade_atual > 0,
            Lote.validade.is_not(None),
            Lote.validade <= limite,
        )
        .order_by(Lote.validade.asc())
    )
    return list(db.scalars(consulta).all())


@router.get("/lotes/{item_id}", response_model=list[LoteOut], summary="Lotes abertos de um item")
def lotes_do_item(item_id: int, db: Session = Depends(get_db)) -> list[Lote]:
    garantir_item(db, item_id)
    consulta = (
        select(Lote)
        .where(Lote.item_id == item_id, Lote.quantidade_atual > 0)
        .order_by(Lote.validade.is_(None), Lote.validade.asc(), Lote.id.asc())
    )
    return list(db.scalars(consulta).all())


@router.get("/perdas", response_model=list[PerdaOut], summary="Historico de perdas registradas")
def listar_perdas(
    db: Session = Depends(get_db),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
) -> list[Perda]:
    consulta = (
        select(Perda)
        .options(selectinload(Perda.item))
        .order_by(Perda.data.desc(), Perda.id.desc())
    )
    if inicio:
        consulta = consulta.where(Perda.data >= inicio)
    if fim:
        consulta = consulta.where(Perda.data <= fim)
    return list(db.scalars(consulta).all())


@router.post(
    "/perdas",
    response_model=PerdaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Da baixa em itens perdidos por vencimento ou avaria",
)
def registrar_perda(
    dados: PerdaIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
) -> Perda:
    garantir_item(db, dados.item_id)
    baixar_estoque(db, dados.item_id, dados.quantidade)

    perda = Perda(
        item_id=dados.item_id,
        quantidade=dados.quantidade,
        motivo=dados.motivo,
        data=dados.data,
        registrado_por_id=usuario.id,
        observacoes=dados.observacoes,
    )
    db.add(perda)
    db.commit()
    db.refresh(perda)
    return perda
