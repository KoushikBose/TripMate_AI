import os
import sys
import asyncio
import certifi
from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

load_dotenv()


TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
AVIATION_STACK_API_KEY = os.getenv("AVIATIONSTACK_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY")


# LLM
llm = ChatOllama(
    model="llama3.1:405b",
    base_url="https://ollama.com",
    client_kwargs={
        "headers": {
            "Authorization": f"Bearer {OLLAMA_API_KEY}"
        }
    }
)

client=MultiServerMCPClient(
    {
        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"
        },
         "aviationstack": {
            "transport": "stdio",
            "command": "uvx",
            "args": [
                "--from", "aviationstack-mcp",
                "--with", "mcp<1.28",
                "aviationstack-mcp"
            ],
            "env": {
                "AVIATION_STACK_API_KEY": AVIATION_STACK_API_KEY
            }
        },

         "weather": {
            "transport": "stdio",
            "command": sys.executable,
            "args": [
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "custom_weather_mcp_server.py")
            ],
            "env": {
                "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY
            }
        }

    }
)

# Check if the client is connected to all servers
async def get_all_tools():

    tools = await client.get_tools()

    print("\nAvailable MCP Tools:\n")

    for tool in tools:
        print(tool.name)

    return tools


async def _get_tool(tool_name: str):
    tools = await client.get_tools()
    return next(tool for tool in tools if tool.name == tool_name)


###################################
# Tavily, Aviation and Weather Tools
###################################

async def tavily_mcp_search(query: str):
    tool = await _get_tool("tavily_search")
    return await tool.ainvoke({"query": query})


async def aviation_mcp_call(tool_name: str, tool_args: dict | None = None):
    tool = await _get_tool(tool_name)
    return await tool.ainvoke(tool_args or {})


async def weather_mcp_search(city: str):
    tool = await _get_tool("get_current_weather")
    return await tool.ainvoke({"city": city})


async def forecast_mcp_search(city: str):
    tool = await _get_tool("get_forecast")
    return await tool.ainvoke({"city": city})


def extract_destination(query: str) -> str:
    try:
        response = llm.invoke([
            SystemMessage(
                content="Extract only the destination City and Country name from the travel query. "
                        "Respond with just the City and Country name, nothing else."
            ),
            HumanMessage(content=query)
        ])
        return response.content.strip()
    except Exception as e:
        print(f"\nextract_destination failed, falling back to raw query: {e}")
        return query.strip()
