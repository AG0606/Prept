from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...services.sandbox_client import SandboxClient
from ...schemas.session import CodeRunRequest, CodeSubmitRequest

router = APIRouter(prefix="/api/coding", tags=["coding"])

@router.post("/run")
async def run_code(req: CodeRunRequest):
    client = SandboxClient()
    result = await client.execute(req.source_code, req.language, req.stdin)
    return result

@router.post("/submit")
async def submit_code(req: CodeSubmitRequest):
    client = SandboxClient()
    result = await client.submit_with_tests(req.source_code, req.language, req.problem_id)
    return result

@router.post("/sql/run")
async def run_sql(query: str, db: AsyncSession = Depends(get_db)):
    from ...services.sql_runner import SQLRunner
    runner = SQLRunner()
    result = await runner.execute(query)
    return result

@router.post("/sql/submit")
async def submit_sql(query: str, problem_id: str):
    from ...services.sql_runner import SQLRunner
    runner = SQLRunner()
    result = await runner.submit_with_tests(query, problem_id)
    return result