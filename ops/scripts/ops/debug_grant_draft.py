import asyncio
from agentz.core.grants import draft_federal_proposal

opp = {
    "notice_id": "b2bc21c9a8144e858d0fd5724d21f5a0",
    "title": "16--CONTROL BOX ASS, IN REPAIR/MODIFICATION OF",
    "agency": "DEPT OF DEFENSE",
    "deadline": "2026-08-28T14:00:00-04:00"
}

async def main():
    try:
        content = await draft_federal_proposal(opp)
        print("--- CONTENT ---")
        print(content)
    except Exception as e:
        print("--- ERROR ---")
        import traceback
        traceback.print_exc()

asyncio.run(main())
