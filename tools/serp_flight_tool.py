import os
import time
import certifi
import requests
from dotenv import load_dotenv

load_dotenv()

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

SERP_API_KEY = os.getenv("SERP_API_KEY")

BASE_URL = "https://serpapi.com/search.json"
EXCHANGE_RATE_URL = "https://api.frankfurter.app/latest"

_rate_cache = {"rate": None, "fetched_at": 0}
RATE_CACHE_TTL_SECONDS = 3600


def get_usd_to_inr_rate():
    """
    Returns the live USD -> INR exchange rate, cached for RATE_CACHE_TTL_SECONDS.
    Falls back to the last known rate (or None) if the live lookup fails.
    """

    now = time.time()

    if _rate_cache["rate"] and (now - _rate_cache["fetched_at"]) < RATE_CACHE_TTL_SECONDS:
        return _rate_cache["rate"]

    try:
        response = requests.get(
            EXCHANGE_RATE_URL,
            params={"from": "USD", "to": "INR"},
            timeout=10,
        )
        data = response.json()
        rate = data.get("rates", {}).get("INR")

        if rate:
            _rate_cache["rate"] = rate
            _rate_cache["fetched_at"] = now
            return rate
    except requests.exceptions.RequestException:
        pass

    return _rate_cache["rate"]


def _format_duration(total_minutes):
    if not total_minutes:
        return None

    hours, minutes = divmod(int(total_minutes), 60)
    return f"{hours}h {minutes}m"


def _extract_flights(entries, usd_to_inr_rate=None):
    results = []

    for entry in entries or []:
        legs = entry.get("flights") or []

        if not legs:
            continue

        first_leg = legs[0]
        last_leg = legs[-1]
        price = entry.get("price")

        results.append({
            "airline": first_leg.get("airline"),
            "airline_logo": entry.get("airline_logo"),
            "flight_number": first_leg.get("flight_number"),
            "travel_class": first_leg.get("travel_class"),
            "departure_airport": (first_leg.get("departure_airport") or {}).get("name"),
            "departure_time": (first_leg.get("departure_airport") or {}).get("time"),
            "arrival_airport": (last_leg.get("arrival_airport") or {}).get("name"),
            "arrival_time": (last_leg.get("arrival_airport") or {}).get("time"),
            "duration": _format_duration(entry.get("total_duration")),
            "stops": len(legs) - 1,
            "price": price,
            "price_inr": round(price * usd_to_inr_rate) if price and usd_to_inr_rate else None,
            "type": entry.get("type"),
        })

    return results


def search_flights_serpapi(departure_id: str, arrival_id: str, outbound_date: str, return_date: str | None = None, currency: str = "USD"):
    """
    Searches real flight schedules and prices via SerpApi's Google Flights engine.

    Returns a dict with best_flights / other_flights, or a dict containing "error".
    """

    if not SERP_API_KEY:
        return {
            "error": "SERP_API_KEY is missing. Please add it in your .env file:\n"
                     "SERP_API_KEY=your_api_key_here"
        }

    params = {
        "engine": "google_flights",
        "api_key": SERP_API_KEY,
        "departure_id": departure_id,
        "arrival_id": arrival_id,
        "outbound_date": outbound_date,
        "currency": currency,
        "hl": "en",
        "type": "1" if return_date else "2",
    }

    if return_date:
        params["return_date"] = return_date

    try:
        response = requests.get(BASE_URL, params=params, timeout=30)
        data = response.json()
    except requests.exceptions.RequestException as e:
        return {"error": f"Flight search request failed: {e}"}
    except ValueError:
        return {"error": "Flight search API returned invalid JSON."}

    if data.get("error"):
        return {"error": data["error"]}

    usd_to_inr_rate = get_usd_to_inr_rate() if currency == "USD" else None

    best_flights = _extract_flights(data.get("best_flights"), usd_to_inr_rate)
    other_flights = _extract_flights(data.get("other_flights"), usd_to_inr_rate)

    if not best_flights and not other_flights:
        return {"error": f"No flights found for {departure_id} to {arrival_id} on {outbound_date}."}

    return {
        "currency": currency,
        "usd_to_inr_rate": usd_to_inr_rate,
        "best_flights": best_flights,
        "other_flights": other_flights,
    }
