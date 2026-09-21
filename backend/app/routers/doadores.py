"""Cadastro de doadores e historico por doador."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Doacao, DoacaoItem, Doador
from ..schemas import DoacaoOut, DoadorIn, DoadorOut, DoadorResumo, DoadorUpdate
from ..security import usuario_atual

router = APIRouter(prefix="/api/doadores", tags=["Doadores"], dependencies=[Depends(usuario_atual)])


@router.get("", response_model=list[DoadorResumo], summary="Lista os doadores com seu historico")
def listar(
    db: Session = Depends(get_db),
    busca: str | None = Query(default=None),
    apenas_ativos: bool = Query(default=True),
) -> list[DoadorResumo]:
    consulta = select(Doador).order_by(Doador.nome)
    if busca:
        consulta = consulta.where(Doador.nome.ilike(f"%{busca.strip()}%"))
    if apenas_ativos:
        consulta = consulta.where(Doador.ativo.is_(True))
    doadores = list(db.scalars(consulta).all())

    # Agrega o historico de todos os doadores em duas consultas, evitando N+1.
    contagens = dict(
        db.execute(
            select(Doacao.doador_id, func.count(Doacao.id)).group_by(Doacao.doador_id)
        ).all()
    )
    ultimas = dict(
        db.execute(
            select(Doacao.doador_id, func.max(Doacao.data_recebimento)).group_by(Doacao.doador_id)
        ).all()
    )
    totais_itens = dict(
        db.execute(
            select(Doacao.doador_id, func.coalesce(func.sum(DoacaoItem.quantidade), 0.0))
            .join(DoacaoItem, DoacaoItem.doacao_id == Doacao.id)
            .group_by(Doacao.doador_id)
        ).all()
    )

    resultado: list[DoadorResumo] = []
    for doador in doadores:
        resultado.append(
            DoadorResumo(
                id=doador.id,
                nome=doador.nome,
                tipo=doador.tipo,
                telefone=doador.telefone,
                email=doador.email,
                total_doacoes=int(contagens.get(doador.id, 0)),
                total_itens=round(float(totais_itens.get(doador.id, 0.0)), 2),
                ultima_doacao=ultimas.get(doador.id),
            )
        )
    return resultado


@router.post(
    "", response_model=DoadorOut, status_code=status.HTTP_201_CREATED, summary="Cria um doador"
)
def criar(dados: DoadorIn, db: Session = Depends(get_db)) -> Doador:
    doador = Doador(**dados.model_dump())
    doador.nome = doador.nome.strip()
    db.add(doador)
    db.commit()
    db.refresh(doador)
    return doador


@router.get("/{doador_id}", response_model=DoadorOut, summary="Detalha um doador")
def detalhar(doador_id: int, db: Session = Depends(get_db)) -> Doador:
    doador = db.get(Doador, doador_id)
    if doador is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doador nao encontrado.")
    return doador


@router.get(
    "/{doador_id}/doacoes",
    response_model=list[DoacaoOut],
    summary="Historico de doacoes de um doador",
)
def historico(doador_id: int, db: Session = Depends(get_db)) -> list[Doacao]:
    doador = db.get(Doador, doador_id)
    if doador is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doador nao encontrado.")
    consulta = (
        select(Doacao)
        .options(
            selectinload(Doacao.itens).selectinload(DoacaoItem.item),
            selectinload(Doacao.doador),
            selectinload(Doacao.recebido_por),
        )
        .where(Doacao.doador_id == doador_id)
        .order_by(Doacao.data_recebimento.desc(), Doacao.id.desc())
    )
    return list(db.scalars(consulta).all())


@router.put("/{doador_id}", response_model=DoadorOut, summary="Atualiza um doador")
def atualizar(doador_id: int, dados: DoadorUpdate, db: Session = Depends(get_db)) -> Doador:
    doador = db.get(Doador, doador_id)
    if doador is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doador nao encontrado.")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(doador, campo, valor)
    db.commit()
    db.refresh(doador)
    return doador


@router.delete(
    "/{doador_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desativa um doador"
)
def desativar(doador_id: int, db: Session = Depends(get_db)) -> None:
    doador = db.get(Doador, doador_id)
    if doador is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doador nao encontrado.")
    doador.ativo = False
    db.commit()
