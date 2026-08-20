import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

from pathlib import Path
import traceback
import uvicorn

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import nest_asyncio
nest_asyncio.apply()

from backend import run_travel_agent
from tools.flight_tool import resolve_location_to_iata
from tools.serp_flight_tool import search_flights_serpapi

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="TripMate AI",
    description="LangGraph Multi-Agent Travel Planner with FastAPI Frontend",
    version="1.0.0"
)


app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)


templates = Jinja2Templates(
    directory=str(BASE_DIR / "templates")
)



class TravelRequest(BaseModel):
    message: str
    thread_id: str | None = None


class FlightTrackRequest(BaseModel):
    origin: str
    destination: str
    outbound_date: str
    return_date: str | None = None



@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )


@app.post("/api/travel")
async def travel_planner(request_data: TravelRequest):
    try:
        user_message = request_data.message.strip()

        if not user_message:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Message cannot be empty."
                }
            )

        result = run_travel_agent(
            user_input=user_message,
            thread_id=request_data.thread_id
        )

        return JSONResponse(
            content={
                "success": True,
                "thread_id": result["thread_id"],
                "answer": result["answer"],
                "flight_results": result["flight_results"],
                "hotel_results": result["hotel_results"],
                "itinerary": result["itinerary"],
                "llm_calls": result["llm_calls"],
            }
        )

    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )



@app.post("/api/flight-tracking")
async def flight_tracking(request_data: FlightTrackRequest):
    try:
        origin = request_data.origin.strip()
        destination = request_data.destination.strip()

        if not origin or not destination:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Origin and destination are required."
                }
            )

        dep_iata = resolve_location_to_iata(origin)
        arr_iata = resolve_location_to_iata(destination)

        if not dep_iata or not arr_iata:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Could not resolve origin/destination to an airport. Try a city name or IATA code."
                }
            )

        result = search_flights_serpapi(
            departure_id=dep_iata,
            arrival_id=arr_iata,
            outbound_date=request_data.outbound_date,
            return_date=request_data.return_date,
        )

        if result.get("error"):
            return JSONResponse(
                status_code=502,
                content={
                    "success": False,
                    "error": str(result["error"])
                }
            )

        return JSONResponse(
            content={
                "success": True,
                "departure_id": dep_iata,
                "arrival_id": arr_iata,
                "currency": result["currency"],
                "usd_to_inr_rate": result.get("usd_to_inr_rate"),
                "best_flights": result["best_flights"],
                "other_flights": result["other_flights"],
            }
        )

    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "message": "AI Travel Planner API is running"
    }


@app.get("/favicon.ico")
async def favicon():
    return JSONResponse(content={})



if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )