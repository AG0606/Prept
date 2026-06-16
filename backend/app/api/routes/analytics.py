from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_db
from ...models.session import Session

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    session_type: str = "",
    db: AsyncSession = Depends(get_db),
):
    query = select(Session).where(Session.status == "completed").order_by(Session.created_at.desc())
    if session_type:
        query = query.where(Session.session_type == session_type)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()
    return {"sessions": sessions, "total": len(sessions)}

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.count(Session.id),
            func.avg(Session.scores["overall"].as_float()),
        ).where(Session.status == "completed")
    )
    row = result.one()
    return {
        "total_sessions": row[0] or 0,
        "average_score": round(float(row[1] or 0), 1),
    }

@router.get("/trends")
async def get_trends(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.date(Session.created_at).label("date"),
            func.avg(Session.scores["overall"].as_float()).label("avg_score"),
        )
        .where(Session.status == "completed")
        .group_by(func.date(Session.created_at))
        .order_by(func.date(Session.created_at))
    )
    rows = result.all()
    return {"trends": [{"date": str(r.date), "score": round(float(r.avg_score), 1)} for r in rows]}