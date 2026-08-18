from tavily import TavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

Client=TavilyClient(
    api_key=os.getenv("TAVILY_API_KEY")
)

print('Value----->',Client)


def tavily_search(query):
    Response=Client.search(
        query=query,
        max_results=7
    )
    print(Response)

    Result=[]

    for i, r in enumerate(Response["results"], 1):
        title   = r.get("title", "Unknown")
        url     = r.get("url", "")
        snippet = r.get("content", "").strip()
        # Keep only the first 300 characters to avoid wall-of-text
        if len(snippet) > 300:
            snippet = snippet[:400].rsplit(" ", 1)[0] + "..."

        Result.append(f"{i}. **{title}**\n   {url}\n   {snippet}")

    return "\n\n".join(Result)

