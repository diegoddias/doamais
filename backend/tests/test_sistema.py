"""Teste ponta a ponta do Doa+.

Exercita o sistema inteiro contra um banco SQLite temporario: autenticacao,
permissoes, entrada de doacoes, baixa FEFO, alertas de validade, perdas,
canal publico, intencoes e relatorios.

Executar a partir da pasta backend/:

    python -m pytest tests -q
    ou
    python tests/test_sistema.py
"""
import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

CAMINHO_BANCO = Path(tempfile.gettempdir()) / "doamais_teste.db"
if CAMINHO_BANCO.exists():
    CAMINHO_BANCO.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{CAMINHO_BANCO.as_posix()}"
os.environ["SECRET_KEY"] = "chave-de-teste"
os.environ["PUBLIC_BASE_URL"] = "http://localhost:8080"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

falhas: list[str] = []


def check(nome, condicao, extra=""):
    if condicao:
        print(f"  OK    {nome}")
    else:
        print(f"  FALHA {nome} {extra}")
        falhas.append(nome)


def executar():
    with TestClient(app) as c:
        print("\n== Saude e carga inicial ==")
        r = c.get("/api/saude")
        check("GET /api/saude", r.status_code == 200, r.text)

        print("\n== Autenticacao ==")
        r = c.post("/api/auth/login", json={"email": "errado@exemplo.com", "senha": "x"})
        check("login invalido devolve 401", r.status_code == 401, r.status_code)

        r = c.post(
            "/api/auth/login", json={"email": "admin@diegodias.dev", "senha": "doamais123"}
        )
        check("login do administrador", r.status_code == 200, r.text[:200])
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        check("papel admin no retorno do login", r.json()["usuario"]["papel"] == "admin")

        r = c.get("/api/estoque")
        check("estoque sem token devolve 401", r.status_code == 401, r.status_code)

        print("\n== Catalogo criado automaticamente ==")
        cats = c.get("/api/categorias", headers=h).json()
        check("7 categorias criadas", len(cats) == 7, len(cats))
        itens = c.get("/api/itens", headers=h).json()
        check("catalogo com mais de 40 itens", len(itens) > 40, len(itens))

        arroz = next(i for i in itens if i["nome"].startswith("Arroz"))
        feijao = next(i for i in itens if i["nome"].startswith("Feijao"))
        cobertor = next(i for i in itens if i["nome"] == "Cobertor")

        print("\n== Doadores ==")
        r = c.post(
            "/api/doadores",
            headers=h,
            json={"nome": "Mercado Central", "tipo": "pessoa_juridica", "telefone": "51999990000"},
        )
        check("cadastra doador", r.status_code == 201, r.text[:200])
        doador_id = r.json()["id"]

        print("\n== Doacao recebida (entrada de estoque) ==")
        r = c.post(
            "/api/doacoes",
            headers=h,
            json={
                "doador_id": doador_id,
                "data_recebimento": "2026-09-01",
                "campanha": "Campanha do Agasalho",
                "itens": [
                    {"item_id": arroz["id"], "quantidade": 50, "validade": "2027-06-30"},
                    {"item_id": arroz["id"], "quantidade": 10, "validade": "2026-10-05"},
                    {"item_id": cobertor["id"], "quantidade": 12},
                ],
            },
        )
        check("registra doacao", r.status_code == 201, r.text[:300])
        doacao_id = r.json()["id"]
        check("doacao gravou as 3 linhas", len(r.json()["itens"]) == 3)

        r = c.post(
            "/api/doacoes",
            headers=h,
            json={
                "data_recebimento": "2050-01-01",
                "itens": [{"item_id": arroz["id"], "quantidade": 1}],
            },
        )
        check("recusa data de recebimento futura", r.status_code == 400, r.status_code)

        print("\n== Saldo de estoque e alerta de validade ==")
        estoque = {l["item_id"]: l for l in c.get("/api/estoque", headers=h).json()}
        check("saldo do arroz soma os dois lotes", estoque[arroz["id"]]["saldo"] == 60)
        check("saldo do cobertor", estoque[cobertor["id"]]["saldo"] == 12)
        check("feijao sinalizado em falta", estoque[feijao["id"]]["em_falta"] is True)
        check(
            "proxima validade e a mais curta",
            estoque[arroz["id"]]["proxima_validade"] == "2026-10-05",
            estoque[arroz["id"]]["proxima_validade"],
        )

        print("\n== Destinacao: baixa pela regra FEFO ==")
        r = c.post(
            "/api/destinacoes",
            headers=h,
            json={
                "beneficiario": "Familia Silva",
                "tipo_beneficiario": "familia",
                "data": "2026-09-10",
                "itens": [
                    {"item_id": arroz["id"], "quantidade": 4},
                    {"item_id": arroz["id"], "quantidade": 3},
                ],
            },
        )
        check("registra entrega somando item repetido", r.status_code == 201, r.text[:300])

        lotes = c.get(f"/api/estoque/lotes/{arroz['id']}", headers=h).json()
        curto = next(l for l in lotes if l["validade"] == "2026-10-05")
        longo = next(l for l in lotes if l["validade"] == "2027-06-30")
        check("consumiu o lote que vence antes", curto["quantidade_atual"] == 3, curto)
        check("lote de validade longa intacto", longo["quantidade_atual"] == 50, longo)

        r = c.post(
            "/api/destinacoes",
            headers=h,
            json={
                "beneficiario": "Familia Souza",
                "data": "2026-09-10",
                "itens": [{"item_id": cobertor["id"], "quantidade": 999}],
            },
        )
        check("recusa entrega maior que o saldo", r.status_code == 400, r.status_code)
        check("mensagem de saldo e explicativa", "Saldo insuficiente" in r.text, r.text[:200])

        print("\n== Integridade do historico ==")
        r = c.delete(f"/api/doacoes/{doacao_id}", headers=h)
        check("bloqueia estorno de doacao ja destinada", r.status_code == 400, r.status_code)

        print("\n== Perdas ==")
        r = c.post(
            "/api/estoque/perdas",
            headers=h,
            json={
                "item_id": arroz["id"],
                "quantidade": 3,
                "motivo": "vencimento",
                "data": "2026-09-15",
            },
        )
        check("registra perda", r.status_code == 201, r.text[:200])
        estoque = {l["item_id"]: l for l in c.get("/api/estoque", headers=h).json()}
        check("perda abateu o saldo", estoque[arroz["id"]]["saldo"] == 50)

        print("\n== Canal publico (sem autenticacao) ==")
        nec = c.get("/api/publico/necessidades").json()
        check("lista publica de necessidades", len(nec) > 0)
        check("item com saldo suficiente sai da lista", all(n["item_id"] != arroz["id"] for n in nec))
        check(
            "prioridade calculada",
            all(n["prioridade"] in ("urgente", "alta", "media") for n in nec),
        )

        t = c.get("/api/publico/transparencia")
        check("pagina de transparencia", t.status_code == 200, t.text[:200])
        check("total recebido consolidado", t.json()["total_itens_recebidos"] == 72, t.json())

        r = c.post(
            "/api/publico/intencoes",
            json={"nome": "Joana", "itens": [{"item_id": feijao["id"], "quantidade": 5}]},
        )
        check("recusa intencao sem contato", r.status_code == 400, r.status_code)

        r = c.post(
            "/api/publico/intencoes",
            json={
                "nome": "Joana Pereira",
                "telefone": "51988887777",
                "mensagem": "Posso entregar no sabado",
                "itens": [{"item_id": feijao["id"], "quantidade": 5}],
            },
        )
        check("registra intencao de doacao", r.status_code == 201, r.text[:200])

        r = c.get("/api/publico/qrcode.png")
        check(
            "gera o QR Code do canal publico",
            r.status_code == 200
            and r.headers["content-type"] == "image/png"
            and len(r.content) > 500,
            r.status_code,
        )

        print("\n== Intencoes no painel interno ==")
        intencoes = c.get("/api/intencoes", headers=h).json()
        check("intencao chega ao painel", len(intencoes) == 1)
        r = c.put(
            f"/api/intencoes/{intencoes[0]['id']}/status",
            headers=h,
            json={"status": "em_contato"},
        )
        check("atualiza o andamento da intencao", r.json()["status"] == "em_contato")

        print("\n== Relatorios ==")
        ind = c.get("/api/relatorios/indicadores", headers=h)
        check("indicadores do painel", ind.status_code == 200, ind.text[:300])
        ind = ind.json()
        check("total em estoque", ind["total_itens_estoque"] == 62, ind["total_itens_estoque"])
        check("serie historica de 6 meses", len(ind["serie"]) == 6)
        check("ranking de itens preenchido", len(ind["top_itens"]) > 0)

        mov = c.get("/api/relatorios/movimento?inicio=2026-09-01&fim=2026-09-30", headers=h)
        check("relatorio de movimento", mov.status_code == 200, mov.text[:300])
        mov = mov.json()
        check("entradas do periodo", mov["entradas_total"] == 72)
        check("saidas do periodo", mov["saidas_total"] == 7)
        check("perdas do periodo", mov["perdas_total"] == 3)
        check(
            "destinacao por beneficiario",
            mov["destinacoes_por_beneficiario"][0]["rotulo"] == "Familia Silva",
        )

        r = c.get("/api/relatorios/estoque.csv", headers=h)
        check("exporta estoque em CSV", r.status_code == 200 and "Item;Categoria" in r.text)
        r = c.get("/api/relatorios/doacoes.csv?inicio=2026-09-01&fim=2026-09-30", headers=h)
        check("exporta doacoes em CSV", r.status_code == 200 and "Mercado Central" in r.text)

        print("\n== Perfis de acesso ==")
        r = c.post(
            "/api/usuarios",
            headers=h,
            json={
                "nome": "Voluntaria Maria",
                "email": "maria@diegodias.dev",
                "senha": "senha123",
                "papel": "voluntario",
            },
        )
        check("admin cadastra voluntario", r.status_code == 201, r.text[:200])

        r = c.post("/api/auth/login", json={"email": "maria@diegodias.dev", "senha": "senha123"})
        hv = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = c.get("/api/usuarios", headers=hv)
        check("voluntario nao gerencia usuarios", r.status_code == 403, r.status_code)
        r = c.post(
            "/api/doacoes",
            headers=hv,
            json={
                "data_recebimento": "2026-09-12",
                "itens": [{"item_id": feijao["id"], "quantidade": 20}],
            },
        )
        check("voluntario registra doacao", r.status_code == 201, r.text[:200])

    print("\n" + "=" * 62)
    if falhas:
        print(f"{len(falhas)} FALHA(S): {falhas}")
        return 1
    print("TODOS OS TESTES PASSARAM")
    return 0


def test_sistema_completo():
    """Ponto de entrada para o pytest."""
    assert executar() == 0, f"Falhas: {falhas}"


if __name__ == "__main__":
    sys.exit(executar())
