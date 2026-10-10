"""Popula o banco com o conteúdo de app/seed/data.json (idempotente).

Uso: python -m app.seed
"""

import json
from pathlib import Path

from sqlmodel import Session, select

from app.db import engine
from app.models import Project, Skill, TimelineEntry

DATA_FILE = Path(__file__).with_name("data.json")


def _upsert(session: Session, model, lookup: dict, values: dict) -> None:
    stmt = select(model)
    for field, value in lookup.items():
        stmt = stmt.where(getattr(model, field) == value)
    obj = session.exec(stmt).first()
    if obj is None:
        session.add(model(**lookup, **values))
    else:
        for field, value in values.items():
            setattr(obj, field, value)


def seed(session: Session, data: dict) -> None:
    for i, entry in enumerate(data["timeline"]):
        values = {k: v for k, v in entry.items() if k != "version"}
        _upsert(session, TimelineEntry, {"version": entry["version"]}, {**values, "sort_order": i})
    for i, skill in enumerate(data["skills"]):
        values = {k: v for k, v in skill.items() if k != "name"}
        _upsert(session, Skill, {"name": skill["name"]}, {**values, "sort_order": i})
    for i, project in enumerate(data["projects"]):
        values = {k: v for k, v in project.items() if k != "slug"}
        _upsert(session, Project, {"slug": project["slug"]}, {**values, "sort_order": i})
    session.commit()


def main() -> None:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    with Session(engine) as session:
        seed(session, data)
    print(
        f"Seed ok: {len(data['projects'])} projetos, "
        f"{len(data['skills'])} skills, {len(data['timeline'])} entradas na timeline."
    )


if __name__ == "__main__":
    main()
