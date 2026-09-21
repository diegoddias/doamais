"""Catalogo de categorias e itens que a instituicao recebe."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Categoria, DestinacaoItem, DoacaoItem, Item
from ..schemas import CategoriaIn, CategoriaOut, ItemIn, ItemOut, ItemUpdate
from ..security import apenas_admin, usuario_atual
from ..services import garantir_categoria

router = APIRouter(prefix="/api", tags=["Catalogo"], dependencies=[Depends(usuario_atual)])


# --------------------------------------------------------------------------
# Categorias
# --------------------------------------------------------------------------
@router.get("/categorias", response_model=list[CategoriaOut], summary="Lista as categorias")
def listar_categorias(db: Session = Depends(get_db)) -> list[Categoria]:
    return list(db.scalars(select(Categoria).order_by(Categoria.nome)).all())


@router.post(
    "/categorias",
    response_model=CategoriaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(apenas_admin)],
    summary="Cria uma categoria",
)
def criar_categoria(dados: CategoriaIn, db: Session = Depends(get_db)) -> Categoria:
    nome = dados.nome.strip()
    if db.scalar(select(Categoria).where(Categoria.nome == nome)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ja existe uma categoria com este nome."
        )
    categoria = Categoria(nome=nome, descricao=dados.descricao, perecivel=dados.perecivel)
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.put(
    "/categorias/{categoria_id}",
    response_model=CategoriaOut,
    dependencies=[Depends(apenas_admin)],
    summary="Atualiza uma categoria",
)
def atualizar_categoria(
    categoria_id: int, dados: CategoriaIn, db: Session = Depends(get_db)
) -> Categoria:
    categoria = garantir_categoria(db, categoria_id)
    categoria.nome = dados.nome.strip()
    categoria.descricao = dados.descricao
    categoria.perecivel = dados.perecivel
    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete(
    "/categorias/{categoria_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(apenas_admin)],
    summary="Remove uma categoria sem itens",
)
def remover_categoria(categoria_id: int, db: Session = Depends(get_db)) -> None:
    categoria = garantir_categoria(db, categoria_id)
    if db.scalar(select(Item.id).where(Item.categoria_id == categoria_id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta categoria possui itens e nao pode ser removida.",
        )
    db.delete(categoria)
    db.commit()


# --------------------------------------------------------------------------
# Itens
# --------------------------------------------------------------------------
@router.get("/itens", response_model=list[ItemOut], summary="Lista os itens do catalogo")
def listar_itens(
    db: Session = Depends(get_db),
    categoria_id: int | None = Query(default=None),
    busca: str | None = Query(default=None, description="Filtra pelo nome do item"),
    apenas_ativos: bool = Query(default=True),
) -> list[Item]:
    consulta = select(Item).options(selectinload(Item.categoria)).order_by(Item.nome)
    if categoria_id is not None:
        consulta = consulta.where(Item.categoria_id == categoria_id)
    if busca:
        consulta = consulta.where(Item.nome.ilike(f"%{busca.strip()}%"))
    if apenas_ativos:
        consulta = consulta.where(Item.ativo.is_(True))
    return list(db.scalars(consulta).all())


@router.post(
    "/itens",
    response_model=ItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um item no catalogo",
)
def criar_item(dados: ItemIn, db: Session = Depends(get_db)) -> Item:
    garantir_categoria(db, dados.categoria_id)
    nome = dados.nome.strip()
    duplicado = db.scalar(
        select(Item).where(Item.nome == nome, Item.categoria_id == dados.categoria_id)
    )
    if duplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ja existe um item com este nome nesta categoria.",
        )
    item = Item(
        nome=nome,
        categoria_id=dados.categoria_id,
        unidade=dados.unidade.strip() or "un",
        estoque_minimo=dados.estoque_minimo,
        ativo=dados.ativo,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/itens/{item_id}", response_model=ItemOut, summary="Atualiza um item")
def atualizar_item(item_id: int, dados: ItemUpdate, db: Session = Depends(get_db)) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    valores = dados.model_dump(exclude_unset=True)
    if "categoria_id" in valores and valores["categoria_id"] is not None:
        garantir_categoria(db, valores["categoria_id"])
    for campo, valor in valores.items():
        if valor is not None:
            setattr(item, campo, valor)

    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/itens/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(apenas_admin)],
    summary="Remove o item, ou o desativa se ja houver movimentacao",
)
def remover_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item nao encontrado.")

    tem_movimento = db.scalar(
        select(DoacaoItem.id).where(DoacaoItem.item_id == item_id)
    ) or db.scalar(select(DestinacaoItem.id).where(DestinacaoItem.item_id == item_id))

    if tem_movimento:
        # Preserva o historico: o item some das listas, mas os registros ficam.
        item.ativo = False
    else:
        db.delete(item)
    db.commit()
