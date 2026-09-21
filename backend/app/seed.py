"""Carga inicial: usuario administrador e catalogo basico de donativos.

Roda em toda inicializacao, mas so cria o que ainda nao existe, de modo que
subir o container novamente nunca duplica nem sobrescreve dados.
"""
from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import Categoria, Item, Papel, Usuario
from .security import gerar_hash

log = logging.getLogger("doamais.seed")

# (categoria, perecivel, descricao, [(item, unidade, estoque_minimo)])
CATALOGO: list[tuple[str, bool, str, list[tuple[str, str, float]]]] = [
    (
        "Alimentos nao pereciveis",
        True,
        "Itens da cesta basica com prazo de validade.",
        [
            ("Arroz 5kg", "pacote", 30),
            ("Feijao 1kg", "pacote", 30),
            ("Oleo de soja 900ml", "unidade", 20),
            ("Acucar 1kg", "pacote", 20),
            ("Cafe 500g", "pacote", 15),
            ("Macarrao 500g", "pacote", 25),
            ("Farinha de trigo 1kg", "pacote", 15),
            ("Leite em po 400g", "lata", 15),
            ("Sardinha em lata", "lata", 20),
            ("Molho de tomate", "unidade", 20),
        ],
    ),
    (
        "Higiene e limpeza",
        True,
        "Produtos de higiene pessoal e limpeza domestica.",
        [
            ("Sabonete", "unidade", 40),
            ("Creme dental", "unidade", 30),
            ("Papel higienico", "rolo", 40),
            ("Absorvente", "pacote", 30),
            ("Detergente", "unidade", 20),
            ("Agua sanitaria 1L", "unidade", 20),
            ("Sabao em po 1kg", "pacote", 15),
            ("Shampoo", "unidade", 15),
        ],
    ),
    (
        "Roupas e calcados",
        False,
        "Vestuario em bom estado de conservacao.",
        [
            ("Agasalho adulto", "peca", 40),
            ("Agasalho infantil", "peca", 40),
            ("Calca adulto", "peca", 30),
            ("Calca infantil", "peca", 30),
            ("Camiseta adulto", "peca", 40),
            ("Camiseta infantil", "peca", 40),
            ("Calcado adulto", "par", 20),
            ("Calcado infantil", "par", 20),
            ("Meia", "par", 30),
        ],
    ),
    (
        "Roupas de cama e banho",
        False,
        "Itens essenciais em atendimentos emergenciais de alagamento.",
        [
            ("Cobertor", "unidade", 30),
            ("Lencol", "unidade", 20),
            ("Toalha de banho", "unidade", 25),
            ("Travesseiro", "unidade", 15),
            ("Colchao solteiro", "unidade", 10),
        ],
    ),
    (
        "Utensilios domesticos",
        False,
        "Itens de reposicao para familias atingidas.",
        [
            ("Prato", "unidade", 20),
            ("Talher", "unidade", 30),
            ("Panela", "unidade", 10),
            ("Copo", "unidade", 20),
            ("Balde", "unidade", 15),
        ],
    ),
    (
        "Materiais escolares",
        False,
        "Apoio a permanencia escolar das criancas atendidas.",
        [
            ("Caderno", "unidade", 30),
            ("Caneta", "unidade", 50),
            ("Lapis", "unidade", 50),
            ("Mochila", "unidade", 15),
            ("Estojo completo", "unidade", 20),
        ],
    ),
    (
        "Itens para bebe",
        True,
        "Itens de primeira necessidade para criancas de ate 2 anos.",
        [
            ("Fralda descartavel P", "pacote", 15),
            ("Fralda descartavel M", "pacote", 15),
            ("Fralda descartavel G", "pacote", 15),
            ("Lenco umedecido", "pacote", 15),
            ("Formula infantil", "lata", 10),
        ],
    ),
]


def criar_admin(db: Session) -> None:
    email = settings.admin_email.strip().lower()
    if db.scalar(select(Usuario).where(Usuario.email == email)):
        return
    if db.scalar(select(func.count(Usuario.id))):
        # Ja existem usuarios; nao cria um admin extra sem necessidade.
        return

    db.add(
        Usuario(
            nome=settings.admin_nome,
            email=email,
            senha_hash=gerar_hash(settings.admin_senha),
            papel=Papel.admin,
            ativo=True,
        )
    )
    db.commit()
    log.info("Usuario administrador criado: %s", email)


def criar_catalogo(db: Session) -> None:
    if not settings.seed_catalogo:
        return
    if db.scalar(select(func.count(Categoria.id))):
        return

    for nome_cat, perecivel, descricao, itens in CATALOGO:
        categoria = Categoria(nome=nome_cat, descricao=descricao, perecivel=perecivel)
        db.add(categoria)
        db.flush()
        for nome_item, unidade, minimo in itens:
            db.add(
                Item(
                    nome=nome_item,
                    categoria_id=categoria.id,
                    unidade=unidade,
                    estoque_minimo=minimo,
                    ativo=True,
                )
            )

    db.commit()
    log.info("Catalogo inicial carregado: %d categorias", len(CATALOGO))


def executar(db: Session) -> None:
    criar_admin(db)
    criar_catalogo(db)
