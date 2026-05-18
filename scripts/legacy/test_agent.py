import asyncio
from browser_use import Agent
from langchain_openai import ChatOpenAI

async def main():
    llm = ChatOpenAI(model='gpt-4o', api_key='test')
    agent = Agent(task='test', llm=llm)
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())