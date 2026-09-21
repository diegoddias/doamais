"""Canal publico de doacao: necessidades, transparencia, intencoes e QR Code.

Nenhuma rota deste modulo exige autenticacao. E o que a comunidade acessa
ao ler o QR Code do cartaz afixado na instituicao.
"""
import io
from datetime import datetime, timezone

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    Destinacao,
    DestinacaoItem,
    Doacao,
    DoacaoItem,
    IntencaoDoacao,
    IntencaoItem,
)
from ..schemas import IntencaoIn, NecessidadePublica, TransparenciaPublica
from ..services import garantir_item, linhas_de_estoque, prioridade_da_falta

router = APIRouter(prefix="/api/publico", tags=["Canal publico"])


@router.get(
    "/necessidades",
    response_model=list[NecessidadePublica],
    summary="Itens que a instituicao precisa no momento",
)
def necessidades(db: Session = Depends(get_db)) -> list[NecessidadePublica]:
    linhas = linhas_de_estoque(db, somente_falta=True)
    resultado = [
        NecessidadePublica(
            item_id=linha["item_id"],
            item=linha["item"],
            categoria=linha["categoria"],
            unidade=linha["unidade"],
            falta_quantidade=linha["falta_quantidade"],
            prioridade=prioridade_da_falta(linha["falta_quantidade"], linha["estoque_minimo"]),
        )
        for linha in linhas
    ]
    ordem = {"urgente": 0, "alta": 1, "media": 2}
    resultado.sort(key=lambda n: (ordem.get(n.prioridade, 3), -n.falta_quantidade))
    return resultado


@router.get(
    "/transparencia",
    response_model=TransparenciaPublica,
    summary="Numeros abertos da instituicao, para prestacao de contas",
)
def transparencia(db: Session = Depends(get_db)) -> TransparenciaPublica:
    recebidos = db.scalar(select(func.coalesce(func.sum(DoacaoItem.quantidade), 0.0))) or 0.0
    destinados = db.scalar(select(func.coalesce(func.sum(DestinacaoItem.quantidade), 0.0))) or 0.0
    total_doacoes = db.scalar(select(func.count(Doacao.id))) or 0
    beneficiarios = (
        db.scalar(select(func.count(func.distinct(Destinacao.beneficiario)))) or 0
    )
    em_falta = len(linhas_de_estoque(db, somente_falta=True))

    return TransparenciaPublica(
        instituicao=settings.instituicao_nome,
        cidade=settings.instituicao_cidade,
        total_itens_recebidos=round(float(recebidos), 2),
        total_itens_destinados=round(float(destinados), 2),
        total_doacoes=int(total_doacoes),
        total_beneficiarios=int(beneficiarios),
        itens_em_falta=em_falta,
        atualizado_em=datetime.now(timezone.utc),
    )


@router.post(
    "/intencoes",
    status_code=status.HTTP_201_CREATED,
    summary="Registra a intencao de doar de um morador da comunidade",
)
def registrar_intencao(dados: IntencaoIn, db: Session = Depends(get_db)) -> dict:
    if not dados.telefone and not dados.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe ao menos um telefone ou e-mail para que possamos entrar em contato.",
        )

    intencao = IntencaoDoacao(
        nome=dados.nome.strip(),
        telefone=dados.telefone,
        email=dados.email,
        mensagem=dados.mensagem,
    )
    db.add(intencao)
    db.flush()

    for linha in dados.itens:
        garantir_item(db, linha.item_id)
        db.add(
            IntencaoItem(
                intencao_id=intencao.id, item_id=linha.item_id, quantidade=linha.quantidade
            )
        )

    db.commit()
    return {
        "id": intencao.id,
        "mensagem": (
            "Obrigado! Sua intencao de doacao foi registrada e a equipe "
            "entrara em contato para combinar a entrega."
        ),
    }


@router.get(
    "/qrcode.png",
    summary="QR Code do canal publico, para impressao em cartazes",
    response_class=Response,
)
def qrcode_png(tamanho: int = 10) -> Response:
    tamanho = max(4, min(tamanho, 20))
    url = f"{settings.public_base_url.rstrip('/')}/doar"

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=tamanho,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    imagem = qr.make_image(fill_color="#0f3d2e", back_color="white")

    buffer = io.BytesIO()
    imagem.save(buffer, format="PNG")
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={"Content-Disposition": 'inline; filename="doamais-qrcode.png"'},
    )


@router.get("/info", summary="Identificacao da instituicao para a pagina publica")
def info() -> dict:
    return {
        "instituicao": settings.instituicao_nome,
        "cidade": settings.instituicao_cidade,
        "url_publica": f"{settings.public_base_url.rstrip('/')}/doar",
    }
