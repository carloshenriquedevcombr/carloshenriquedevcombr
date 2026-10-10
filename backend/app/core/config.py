from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valor só para desenvolvimento; a API se recusa a subir em produção com ele
DEV_CTF_SECRET = "dev-ctf-secret"  # noqa: S105  # nosec B105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "The Lab API"
    environment: str = "development"
    database_url: str = "sqlite:///./lab.db"

    # Origens autorizadas a chamar a API pelo navegador (separadas por vírgula)
    cors_origins: str = "http://localhost:3000"

    # Rate limit do formulário de contato: N requisições por janela (segundos), por IP
    contact_rate_limit: int = 5
    contact_rate_window: int = 3600

    # Redis (opcional): compartilha rate limit e métricas entre réplicas da API.
    # Vazio = tudo em memória, suficiente para uma única instância.
    redis_url: str = ""

    # Terminal interativo (WebSocket)
    terminal_max_message: int = 512
    terminal_rate_limit: int = 15  # comandos por janela, por conexão
    terminal_rate_window: int = 10
    terminal_idle_timeout: int = 300
    # Cada página abre 3 WebSockets (terminal, métricas, reactor); folga para abas e NAT
    ws_max_connections_per_ip: int = 10

    # Usuário do GitHub cujas estatísticas aparecem no Live Metrics (vazio = desligado)
    github_username: str = ""
    github_refresh_seconds: int = 900

    # Segredo do CTF: as flags são HMACs dele, então nunca aparecem no código
    ctf_secret: str = DEV_CTF_SECRET

    # Sal usado para gravar o IP do remetente como hash (nunca em texto puro)
    ip_hash_salt: str = "change-me"

    @model_validator(mode="after")
    def _reject_default_secrets_in_production(self) -> "Settings":
        if self.is_production and self.ip_hash_salt == "change-me":
            raise ValueError("Defina IP_HASH_SALT antes de rodar em produção")
        if self.is_production and self.ctf_secret == DEV_CTF_SECRET:
            raise ValueError("Defina CTF_SECRET antes de rodar em produção")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
