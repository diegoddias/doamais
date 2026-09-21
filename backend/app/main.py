"""Doa+ - API de gestao de doacoes comunitarias.

Projeto de Extensao - Curso Superior de Tecnologia em
Analise e Desenvolvimento de Sistemas - Faculdade QI Brasil.
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from . import seed
from .config import settings
from .database import Base, SessionLocal, engine
from .models import *  # noqa: F401,F403  (registra as tabelas no metadata)
from .routers import (
    auth,
    catalogo,
    destinacoes,
    doacoes,
    doadores,
    estoque,
    intencoes,
    publico,
    relatorios,
    usuarios,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s | %(message)s"
)
log = logging.getLogger("doamais")


def esperar_banco(tentativas: int = 30, intervalo: float = 2.0) -> None:
    """O container do backend sobe junto com o do banco; aguarda ele aceitar conexoes."""
    for tentativa in range(1, tentativas + 1):
        try:
            with engine.connect() as conexao:
                conexao.execute(text("SELECT 1"))
            return
        except OperationalError:
            log.warning("Banco indisponivel (tentativa %d/%d). Aguardando...", tentativa, tentativas)
            time.sleep(intervalo)
    raise RuntimeError("Nao foi possivel conectar ao banco de dados.")


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    esperar_banco()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed.executar(db)
    log.info("Doa+ pronto. Documentacao da API em /api/docs")
    yield


app = FastAPI(
    title="Doa+ | Gestao Digital de Doacoes Comunitarias",
    description=(
        "API do sistema Doa+, desenvolvido como Projeto de Extensao do curso de "
        "Analise e Desenvolvimento de Sistemas. Permite registrar doacoes recebidas, "
        "controlar o estoque por validade, cadastrar doadores, destinar donativos, "
        "emitir relatorios e receber intencoes de doacao da comunidade via QR Code."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    # A autenticacao usa cabecalho Bearer, nao cookies: manter credentials
    # desligado permite a origem curinga sem afrouxar nada de fato.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for modulo in (
    auth,
    usuarios,
    catalogo,
    doadores,
    doacoes,
    destinacoes,
    estoque,
    intencoes,
    relatorios,
    publico,
):
    app.include_router(modulo.router)


@app.get("/api/saude", tags=["Infraestrutura"], summary="Verificacao de disponibilidade")
def saude() -> dict:
    return {"status": "ok", "sistema": "Doa+", "versao": app.version}
