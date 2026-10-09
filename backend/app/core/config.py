from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Sal usado para gravar o IP do remetente como hash (nunca em texto puro)
    ip_hash_salt: str = "change-me"

    @model_validator(mode="after")
    def _reject_default_secrets_in_production(self) -> "Settings":
        if self.is_production and self.ip_hash_salt == "change-me":
            raise ValueError("Defina IP_HASH_SALT antes de rodar em produção")
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
