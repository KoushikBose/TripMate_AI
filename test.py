import asyncio
from tools.tavily_tool import tavily_search
from tools.flight_tool import search_flights
from backend import run_travel_agent

# res = asyncio.run(tavily_search("Best Hotel In India"))
# print(res)

# r1=search_flights("Plan 7 Days Australlia Trip from India")
# print(r1)

Result1=input("Enter Travel Request: ")

Response=run_travel_agent(
    user_input=Result1
)

print("\n Final Response:\n")
print(Response["answer"])