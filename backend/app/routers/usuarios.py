"""Cadastro de voluntarios e administradores."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Usuario
from ..schemas import UsuarioIn, UsuarioOut, UsuarioUpdate
from ..security import apenas_admin, gerar_hash

router = APIRouter(
    prefix="/api/usuarios", tags=["Usuarios"], dependencies=[Depends(apenas_admin)]
)


@router.get("", response_model=list[UsuarioOut], summary="Lista os usuarios do sistema")
def listar(db: Session = Depends(get_db)) -> list[Usuario]:
    return list(db.scalars(select(Usuario).order_by(Usuario.nome)).all())


@router.post(
    "", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED, summary="Cria um usuario"
)
def criar(dados: UsuarioIn, db: Session = Depends(get_db)) -> Usuario:
    email = dados.email.strip().lower()
    if db.scalar(select(Usuario).where(Usuario.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ja existe um usuario com este e-mail."
        )
    usuario = Usuario(
        nome=dados.nome.strip(),
        email=email,
        senha_hash=gerar_hash(dados.senha),
        papel=dados.papel,
        ativo=dados.ativo,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/{usuario_id}", response_model=UsuarioOut, summary="Atualiza um usuario")
def atualizar(usuario_id: int, dados: UsuarioUpdate, db: Session = Depends(get_db)) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")

    valores = dados.model_dump(exclude_unset=True)
    if "senha" in valores and valores["senha"]:
        usuario.senha_hash = gerar_hash(valores.pop("senha"))
    valores.pop("senha", None)

    if "email" in valores and valores["email"]:
        email = valores["email"].strip().lower()
        existente = db.scalar(select(Usuario).where(Usuario.email == email))
        if existente and existente.id != usuario.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ja existe um usuario com este e-mail.",
            )
        valores["email"] = email

    for campo, valor in valores.items():
        setattr(usuario, campo, valor)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete(
    "/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desativa um usuario"
)
def desativar(
    usuario_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(apenas_admin)
) -> None:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")
    if usuario.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voce nao pode desativar o proprio usuario.",
        )
    usuario.ativo = False
    db.commit()
