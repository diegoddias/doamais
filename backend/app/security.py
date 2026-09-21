"""Autenticacao por JWT e dependencias de autorizacao."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Papel, Usuario

ALGORITMO = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def gerar_hash(senha: str) -> str:
    return pwd_context.hash(senha)


def conferir_senha(senha: str, senha_hash: str) -> bool:
    try:
        return pwd_context.verify(senha, senha_hash)
    except ValueError:
        return False


def criar_token(usuario: Usuario) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(usuario.id),
        "email": usuario.email,
        "papel": usuario.papel.value,
        "exp": expira,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITMO)


def usuario_atual(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessao invalida ou expirada. Entre novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise nao_autorizado
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITMO])
        usuario_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise nao_autorizado from None

    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.ativo:
        raise nao_autorizado
    return usuario


def apenas_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel is not Papel.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acao e restrita a administradores.",
        )
    return usuario


def autenticar(db: Session, email: str, senha: str) -> Usuario | None:
    usuario = db.scalar(select(Usuario).where(Usuario.email == email.strip().lower()))
    if usuario is None or not usuario.ativo:
        return None
    if not conferir_senha(senha, usuario.senha_hash):
        return None
    return usuario
