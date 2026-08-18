# TripMate AI

TripMate AI is a multi-agent travel planning assistant built with **LangGraph** and served through a **FastAPI** web app. Give it a travel request in plain English and it coordinates a pipeline of agents to fetch flights, find hotels, and generate a complete day-by-day itinerary.

## How It Works

Each request flows through a LangGraph pipeline of specialized agents:

1. **Flight Agent** — searches for flights matching the query.
2. **Hotel Agent** — searches for hotel recommendations via Tavily search.
3. **Itinerary Agent** — builds a practical, budget-aware itinerary from the flight and hotel results using an LLM.
4. **Final Agent** — formats everything into a final response covering trip summary, flights, hotels, itinerary, budget, and recommendations.

Conversation state is persisted per `thread_id` using a **PostgreSQL** checkpointer (`langgraph-checkpoint-postgres`), so a conversation can continue across requests.

## Tech Stack

- **FastAPI** — web server and API (`app.py`)
- **LangGraph** — multi-agent orchestration (`backend.py`)
- **LangChain / langchain-groq** — LLM integration (Groq-hosted `openai/gpt-oss-120b`)
- **Tavily Search** — hotel/web search tool
- **PostgreSQL** (via `psycopg`) — conversation checkpointing
- **Jinja2** — HTML templating for the frontend (`templates/index.html`)

## Project Structure

```
TripMate_AI/
├── app.py              # FastAPI app and routes
├── backend.py           # LangGraph agent pipeline
├── tools/
│   ├── flight_tool.py    # Flight search tool
│   └── tavily_tool.py    # Hotel/web search tool
├── templates/
│   └── index.html        # Frontend UI
├── static/
│   ├── script.js
│   └── style.css
├── requirements.txt
├── dockerfile
└── .dockerignore
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in the project root with:

```
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=your_postgresql_connection_url
TAVILY_API_KEY=your_tavily_api_key
```

### 3. Run the app

```bash
python app.py
```

The app will be available at `http://127.0.0.1:8000`.

## API

| Method | Endpoint       | Description                          |
|--------|----------------|---------------------------------------|
| GET    | `/`            | Web UI                                |
| POST   | `/api/travel`  | Submit a travel planning request      |
| GET    | `/health`      | Health check                          |

**POST `/api/travel`** request body:

```json
{
  "message": "Plan a 5-day trip to Goa from Mumbai",
  "thread_id": "optional-existing-thread-id"
}
```

## Running with Docker

```bash
docker build -t tripmate-ai .
docker run -p 8000:8000 --env-file .env tripmate-ai
```
