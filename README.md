# Doa+ — Gestão Digital de Doações Comunitárias

Sistema web para instituições que arrecadam e distribuem donativos. Registra o que entra, controla
o estoque por lote e validade, documenta para onde cada item foi, emite relatórios de prestação de
contas e publica um canal de doação acessível por QR Code.

Projeto de Extensão — Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas —
Faculdade QI Brasil.

---

## Subir o sistema

Requisito único: **Docker** com Docker Compose v2 ([Docker Desktop](https://www.docker.com/products/docker-desktop/)
no Windows ou macOS).

```bash
docker compose up -d --build
```

Pronto. O sistema fica em **http://localhost:8080**.

| Endereço | O que é |
| --- | --- |
| http://localhost:8080 | Sistema (login dos voluntários) |
| http://localhost:8080/doar | Canal público de doação — é o destino do QR Code |
| http://localhost:8080/transparencia | Prestação de contas pública |
| http://localhost:8080/api/docs | Documentação interativa da API |

**Primeiro acesso:** `admin@diegodias.dev` / `doamais123` (definidos em `.env`; troque a senha
depois de entrar).

Na primeira execução o sistema cria as tabelas, o usuário administrador e um catálogo inicial com
7 categorias e 47 itens típicos de campanhas de arrecadação. Subir novamente nunca duplica nada.

Outros comandos úteis:

```bash
docker compose logs -f backend
```

```bash
docker compose down
```

Para apagar também o banco de dados:

```bash
docker compose down -v
```

---

## Configuração

Copie `.env.example` para `.env` e ajuste antes de usar para valer:

```bash
cp .env.example .env
```

O que mais importa mudar:

- `SECRET_KEY` — chave que assina as sessões. Gere uma nova:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- `POSTGRES_PASSWORD` e `ADMIN_SENHA`
- `INSTITUICAO_NOME` — aparece na página pública e nos relatórios
- `PUBLIC_BASE_URL` — endereço que o QR Code aponta. Precisa ser o endereço real de produção,
  senão o código impresso no cartaz leva para `localhost`.

---

## Publicar com domínio e HTTPS

O `docker-compose.yml` traz um serviço **Caddy** no perfil `producao`, que emite e renova o
certificado TLS automaticamente pelo Let's Encrypt.

1. Aponte um registro DNS `A` do subdomínio para o IP do servidor:

   ```
   doamais.diegodias.dev.   A   <IP do servidor>
   ```

2. No `.env` do servidor:

   ```
   DOMINIO=doamais.diegodias.dev
   EMAIL_ACME=seu-email@diegodias.dev
   PUBLIC_BASE_URL=https://doamais.diegodias.dev
   ```

3. Suba com o perfil de produção (as portas 80 e 443 precisam estar livres e abertas no firewall):

   ```bash
   docker compose --profile producao up -d --build
   ```

O certificado é emitido no primeiro acesso e renovado sozinho. Depois disso, gere o QR Code
definitivo em **Divulgação e QR Code** — ele já apontará para o endereço com HTTPS.

### Atrás de um proxy reverso já existente

Se o servidor já roda um proxy (Traefik, nginx do host) cuidando de 80/443, **não** use o perfil
`producao` — o Caddy disputaria as mesmas portas e derrubaria o que já está no ar. Use o arquivo
de integração com Traefik incluído no projeto:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Ele coloca o frontend na rede `traefik_public`, adiciona os labels de roteamento e emissão de
certificado, e mantém banco e backend isolados na rede interna. No `.env`, defina `DOMINIO`,
`PUBLIC_BASE_URL` e `BIND_WEB=127.0.0.1` (para não publicar a porta do frontend na internet).

### Notas para Oracle Cloud (camada gratuita)

A instância ARM Ampere gratuita roda o projeto sem ajustes — todas as imagens usadas
(`postgres:16-alpine`, `python:3.12-slim`, `node:20-alpine`, `nginx:1.27-alpine`, `caddy:2-alpine`)
têm versão `arm64`. Dois pontos costumam travar quem publica ali pela primeira vez:

**1. Liberar as portas em dois lugares, não em um.** Abrir 80 e 443 na *Security List* (ou
*Network Security Group*) do painel da Oracle não basta: as imagens Ubuntu e Oracle Linux vêm com
regras locais de firewall que descartam o tráfego antes de ele chegar ao Docker. No Ubuntu:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT && sudo netfilter-persistent save
```

No Oracle Linux, o equivalente com firewalld:

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload
```

**2. Só suba o Caddy depois que o DNS estiver propagado.** O Let's Encrypt valida o domínio por
HTTP; se `doamais.diegodias.dev` ainda não resolver para o IP da instância, a emissão falha e entra
em espera. Confirme antes:

```bash
dig +short doamais.diegodias.dev
```

Com o IP correto na resposta, suba com `docker compose --profile producao up -d --build`.

A instância gratuita tem pouca memória para compilar o frontend. Se o build do contêiner morrer
sem explicação, gere a imagem na sua máquina e envie pronta, ou crie um arquivo de swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

---

## O que o sistema faz

**Doações recebidas** — registra doador, data, campanha e os itens, cada um com sua validade.
Cada linha vira um lote de estoque.

**Estoque** — saldo consolidado por item, alerta do que está abaixo do mínimo e do que vence nos
próximos 30 dias. Baixa de itens perdidos por vencimento ou avaria, contabilizada como perda.

**Destinações** — registra quem recebeu, o quê e quando. A baixa segue a regra **FEFO**
(*first expire, first out*): sai primeiro o lote que vence antes, e itens sem validade saem por
último. O sistema recusa entregar mais do que existe.

**Doadores** — cadastro com histórico: quantas doações, quantos itens, última doação.

**Canal público (QR Code)** — página sem login em `/doar` com a lista do que está faltando,
montada automaticamente a partir do estoque mínimo de cada item. Quem quiser doar escolhe os itens
e deixa o contato; a oferta chega em *Quero doar* para os voluntários darem sequência.

**Transparência** — página pública com os números agregados da instituição.

**Relatórios** — entradas, saídas e perdas por período; itens mais e menos doados; destinação por
beneficiário; ranking de doadores. Exportação em CSV e versão para impressão/PDF.

**Manual de uso** — embutido no próprio sistema, em `/manual`, escrito para quem nunca usou um
sistema de estoque.

### Perfis de acesso

| | Administrador | Voluntário |
| --- | :---: | :---: |
| Registrar doações e entregas | ✓ | ✓ |
| Consultar estoque e relatórios | ✓ | ✓ |
| Cadastrar doadores e itens | ✓ | ✓ |
| Gerenciar voluntários | ✓ | — |
| Estornar doações e criar categorias | ✓ | — |

---

## Arquitetura

```
Navegador
    │
    ├── :8080 ─► nginx (container frontend)
    │              ├── /            → SPA React compilado
    │              └── /api/*       → proxy para o backend
    │
    ├──────────► FastAPI (container backend) :8000
    │                            │
    └──────────────────────────► PostgreSQL 16 (container db)
                                 volume dados_postgres
```

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite, Recharts, React Router |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Banco | PostgreSQL 16 |
| Autenticação | JWT (HS256), senhas com bcrypt |
| Servidor web | nginx (SPA + proxy) e Caddy (TLS automático) |
| Orquestração | Docker Compose |

Todas as tecnologias são gratuitas e de código aberto. Não há custo de licença nem de
hospedagem obrigatório.

### Modelo de dados

```
categorias ──< itens ──< lotes           (saldo real, um lote por validade)
                 │
doadores ──< doacoes ──< doacao_itens ───┘
                 │
            destinacoes ──< destinacao_itens
                 │
            perdas, intencoes ──< intencao_itens
usuarios
```

O saldo nunca é um campo gravado: ele é sempre a soma dos lotes abertos. Isso torna impossível o
estoque "descolar" do histórico de movimentações.

---

## Desenvolvimento sem Docker

**Backend** (Python 3.11+):

```bash
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```

Sem `DATABASE_URL` definida, o backend usa SQLite em arquivo (`doamais.db`) — não é preciso ter
PostgreSQL instalado para desenvolver.

**Frontend** (Node 18+):

```bash
cd frontend && npm install && npm run dev
```

A interface sobe em http://localhost:5173 e encaminha `/api` para o backend na porta 8000.

---

## Estrutura do repositório

```
.
├── docker-compose.yml        # sobe banco + backend + frontend (+ HTTPS no perfil producao)
├── Caddyfile                 # TLS automático para o domínio
├── .env.example              # modelo de configuração
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # aplicação, CORS, inicialização
│       ├── config.py         # configuração por variáveis de ambiente
│       ├── database.py       # engine e sessão
│       ├── models.py         # tabelas
│       ├── schemas.py        # contratos de entrada e saída
│       ├── security.py       # JWT, hash de senha, permissões
│       ├── services.py       # regras de estoque (FEFO, saldo, alertas)
│       ├── seed.py           # admin inicial e catálogo base
│       └── routers/          # um módulo por área da API
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── lib/              # cliente HTTP, sessão, tipos, formatação
        ├── components/       # layout e componentes reaproveitados
        └── pages/            # uma tela por arquivo
```

---

## Licença

Código aberto, livre para uso e adaptação por qualquer entidade assistencial.
