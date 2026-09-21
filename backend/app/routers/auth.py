"""Login e dados da sessao atual."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Usuario
from ..schemas import LoginIn, Token, UsuarioOut
from ..security import autenticar, criar_token, usuario_atual

router = APIRouter(prefix="/api/auth", tags=["Autenticacao"])


@router.post("/login", response_model=Token, summary="Autentica e devolve o token de acesso")
def login(dados: LoginIn, db: Session = Depends(get_db)) -> Token:
    usuario = autenticar(db, dados.email, dados.senha)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    return Token(access_token=criar_token(usuario), usuario=UsuarioOut.model_validate(usuario))


@router.post("/token", response_model=Token, include_in_schema=False)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    """Formato OAuth2 usado pelo botao Authorize da documentacao interativa."""
    usuario = autenticar(db, form.username, form.password)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos."
        )
    return Token(access_token=criar_token(usuario), usuario=UsuarioOut.model_validate(usuario))


@router.get("/eu", response_model=UsuarioOut, summary="Dados do usuario autenticado")
def eu(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    return usuario
