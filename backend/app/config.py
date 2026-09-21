"""Configuracao central da aplicacao, lida de variaveis de ambiente."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco de dados. O docker-compose injeta a URL do PostgreSQL.
    # O padrao em SQLite permite rodar a API isolada, sem Docker, para testes.
    database_url: str = "sqlite:///./doamais.db"

    # Autenticacao
    secret_key: str = "troque-esta-chave-em-producao"
    access_token_expire_minutes: int = 60 * 12

    # Identidade da instituicao (exibida no sistema e nos relatorios)
    instituicao_nome: str = "QI Escolas e Faculdades Tecnicas - Unidade Alvorada"
    instituicao_cidade: str = "Alvorada/RS"

    # URL publica do sistema, usada para gerar o QR Code do canal de doacao
    public_base_url: str = "http://localhost:8080"

    # Usuario administrador criado automaticamente na primeira execucao
    admin_nome: str = "Administrador"
    admin_email: str = "admin@diegodias.dev"
    admin_senha: str = "doamais123"

    # Carrega catalogo inicial de categorias e itens na primeira execucao
    seed_catalogo: bool = True

    # Dias de antecedencia para o alerta de vencimento
    dias_alerta_validade: int = 30

    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
