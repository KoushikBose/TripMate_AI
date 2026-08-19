import os 
import asyncio
import certifi 
from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient


load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")


client = MultiServerMCPClient(
    {
    "tavily": {
        "transport": "streamable_http",
        "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"
    },

    }
)

async def get_all_tools():
    tools=await client.get_tools()
    print("\nAvailable MCP Tools:\n")

    for tool in tools:
        print(tool.name)

    return tools

# This Function Can Be Used To Call The Tavily_Search Tool With  A Query In Backend.py

async def tavily_mcp_search(query:str):
    tools = await get_all_tools()
    tavily_search_tool = next(
        tool for tool in tools
        if tool.name == "tavily_search"
    )
    result = await tavily_search_tool.ainvoke(
        {
            'query':query
        }
    )
    print(result)
    return result
