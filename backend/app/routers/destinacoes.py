"""Registro da destinacao dos donativos (saidas de estoque)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Destinacao, DestinacaoItem, Usuario
from ..schemas import DestinacaoIn, DestinacaoOut
from ..security import usuario_atual
from ..services import baixar_estoque, garantir_item

router = APIRouter(
    prefix="/api/destinacoes", tags=["Destinacoes"], dependencies=[Depends(usuario_atual)]
)

CARREGAR_TUDO = (
    selectinload(Destinacao.itens).selectinload(DestinacaoItem.item),
    selectinload(Destinacao.responsavel),
)


@router.get("", response_model=list[DestinacaoOut], summary="Lista as destinacoes realizadas")
def listar(
    db: Session = Depends(get_db),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    beneficiario: str | None = Query(default=None),
    limite: int = Query(default=200, ge=1, le=1000),
) -> list[Destinacao]:
    consulta = (
        select(Destinacao)
        .options(*CARREGAR_TUDO)
        .order_by(Destinacao.data.desc(), Destinacao.id.desc())
        .limit(limite)
    )
    if inicio:
        consulta = consulta.where(Destinacao.data >= inicio)
    if fim:
        consulta = consulta.where(Destinacao.data <= fim)
    if beneficiario:
        consulta = consulta.where(Destinacao.beneficiario.ilike(f"%{beneficiario.strip()}%"))
    return list(db.scalars(consulta).all())


@router.post(
    "",
    response_model=DestinacaoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra a entrega de donativos e baixa o estoque",
)
def criar(
    dados: DestinacaoIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
) -> Destinacao:
    if dados.data > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="A data nao pode ser futura."
        )

    # Soma quantidades repetidas do mesmo item antes de validar o saldo,
    # senao duas linhas do mesmo item passariam na checagem individualmente.
    consolidado: dict[int, float] = {}
    for linha in dados.itens:
        garantir_item(db, linha.item_id)
        consolidado[linha.item_id] = consolidado.get(linha.item_id, 0.0) + linha.quantidade

    destinacao = Destinacao(
        beneficiario=dados.beneficiario.strip(),
        tipo_beneficiario=dados.tipo_beneficiario,
        data=dados.data,
        responsavel_id=usuario.id,
        observacoes=dados.observacoes,
    )
    db.add(destinacao)
    db.flush()

    for item_id, quantidade in consolidado.items():
        baixar_estoque(db, item_id, quantidade)
        db.add(
            DestinacaoItem(
                destinacao_id=destinacao.id, item_id=item_id, quantidade=quantidade
            )
        )

    db.commit()
    db.refresh(destinacao)
    return destinacao


@router.get("/{destinacao_id}", response_model=DestinacaoOut, summary="Detalha uma destinacao")
def detalhar(destinacao_id: int, db: Session = Depends(get_db)) -> Destinacao:
    destinacao = db.scalar(
        select(Destinacao).options(*CARREGAR_TUDO).where(Destinacao.id == destinacao_id)
    )
    if destinacao is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Destinacao nao encontrada."
        )
    return destinacao
