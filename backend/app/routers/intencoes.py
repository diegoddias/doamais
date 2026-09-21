"""Caixa de entrada das intencoes de doacao vindas do canal publico."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import IntencaoDoacao, IntencaoItem, StatusIntencao
from ..schemas import IntencaoOut, IntencaoStatusIn
from ..security import usuario_atual

router = APIRouter(
    prefix="/api/intencoes", tags=["Intencoes"], dependencies=[Depends(usuario_atual)]
)


@router.get("", response_model=list[IntencaoOut], summary="Lista as intencoes recebidas")
def listar(
    db: Session = Depends(get_db),
    status_filtro: StatusIntencao | None = Query(default=None, alias="status"),
) -> list[IntencaoDoacao]:
    consulta = (
        select(IntencaoDoacao)
        .options(selectinload(IntencaoDoacao.itens).selectinload(IntencaoItem.item))
        .order_by(IntencaoDoacao.criado_em.desc())
    )
    if status_filtro is not None:
        consulta = consulta.where(IntencaoDoacao.status == status_filtro)
    return list(db.scalars(consulta).all())


@router.put(
    "/{intencao_id}/status",
    response_model=IntencaoOut,
    summary="Atualiza o andamento de uma intencao",
)
def atualizar_status(
    intencao_id: int, dados: IntencaoStatusIn, db: Session = Depends(get_db)
) -> IntencaoDoacao:
    intencao = db.get(IntencaoDoacao, intencao_id)
    if intencao is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Intencao nao encontrada."
        )
    intencao.status = dados.status
    db.commit()
    db.refresh(intencao)
    return intencao
