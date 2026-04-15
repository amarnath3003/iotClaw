from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "OpenClaw"
    app_env: str = "development"
    secret_key: str = "change-this-to-a-random-secret-key-in-production"

    database_url: str = "sqlite+aiosqlite:///./openclaw.db"

    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""

    simulation_mode: bool = True
    simulation_tick_seconds: int = 5

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
