let currentThreadId = localStorage.getItem("travel_thread_id") || null;
let latestAnswerMarkdown = "";

function setPrompt(text) {
    document.getElementById("userInput").value = text;
}

function formatDateLabel(dateStr) {
    const date = new Date(dateStr + "T00:00:00");

    return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function getTripDurationDays(startDate, endDate) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    return Math.round((end - start) / msPerDay) + 1;
}

function updateTripDuration() {
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const tripDuration = document.getElementById("tripDuration");
    const tripDurationText = document.getElementById("tripDurationText");

    if (startInput.value && endInput.value && endInput.value >= startInput.value) {
        const days = getTripDurationDays(startInput.value, endInput.value);

        tripDurationText.textContent = `${days} ${days === 1 ? "Day" : "Days"} Trip`;
        tripDuration.classList.remove("hidden");
    } else {
        tripDuration.classList.add("hidden");
    }
}

function initDatePickers() {
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    const today = new Date().toISOString().split("T")[0];
    startInput.min = today;
    endInput.min = today;

    startInput.addEventListener("change", () => {
        if (startInput.value) {
            endInput.min = startInput.value;

            if (endInput.value && endInput.value < startInput.value) {
                endInput.value = startInput.value;
            }
        }

        updateTripDuration();
    });

    endInput.addEventListener("change", updateTripDuration);

    const flightDepartInput = document.getElementById("flightDepartDate");
    const flightReturnInput = document.getElementById("flightReturnDate");

    flightDepartInput.min = today;
    flightReturnInput.min = today;

    flightDepartInput.addEventListener("change", () => {
        if (flightDepartInput.value) {
            flightReturnInput.min = flightDepartInput.value;

            if (flightReturnInput.value && flightReturnInput.value < flightDepartInput.value) {
                flightReturnInput.value = flightDepartInput.value;
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", initDatePickers);

function setLoading(isLoading) {
    const sendBtn = document.getElementById("sendBtn");
    const btnText = document.getElementById("btnText");
    const btnLoader = document.getElementById("btnLoader");

    sendBtn.disabled = isLoading;

    if (isLoading) {
        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
    } else {
        btnText.classList.remove("hidden");
        btnLoader.classList.add("hidden");
    }
}

function showError(message) {
    const errorBox = document.getElementById("errorBox");

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideError() {
    const errorBox = document.getElementById("errorBox");

    errorBox.classList.add("hidden");
    errorBox.textContent = "";
}

function showResult(answer, threadId) {
    latestAnswerMarkdown = answer;

    const resultSection = document.getElementById("resultSection");
    const resultBox = document.getElementById("resultBox");
    const threadInfo = document.getElementById("threadInfo");

    if (typeof marked !== "undefined") {
        resultBox.innerHTML = marked.parse(answer);
    } else {
        resultBox.innerText = answer;
    }

    threadInfo.textContent = `Thread ID: ${threadId}`;

    resultSection.classList.remove("hidden");

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function sendMessage() {
    hideError();

    const input = document.getElementById("userInput");
    const message = input.value.trim();

    if (!message) {
        showError("Please enter your travel request first.");
        return;
    }

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (startDate && endDate && endDate < startDate) {
        showError("Journey end date cannot be before the start date.");
        return;
    }

    let finalMessage = message;

    if (startDate && endDate) {
        const days = getTripDurationDays(startDate, endDate);
        finalMessage = `${message} (Journey dates: ${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}, ${days} ${days === 1 ? "day" : "days"})`;
    } else if (startDate) {
        finalMessage = `${message} (Journey start date: ${formatDateLabel(startDate)})`;
    }

    setLoading(true);

    try {
        const response = await fetch("/api/travel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: finalMessage,
                thread_id: currentThreadId
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Something went wrong.");
        }

        currentThreadId = data.thread_id;
        localStorage.setItem("travel_thread_id", currentThreadId);

        showResult(data.answer, data.thread_id);

    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

function copyResult() {
    const resultBox = document.getElementById("resultBox");
    const text = resultBox.innerText;

    if (!text) {
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            const copyBtn = document.querySelector(".copy-btn");
            const oldText = copyBtn.textContent;

            copyBtn.textContent = "Copied!";

            setTimeout(() => {
                copyBtn.textContent = oldText;
            }, 1400);
        })
        .catch(() => {
            showError("Could not copy result.");
        });
}

function downloadPDF() {
    const pdfContent = document.getElementById("pdfContent");

    if (!latestAnswerMarkdown || !pdfContent) {
        showError("No travel plan available to download.");
        return;
    }

    const downloadBtn = document.querySelector(".download-btn");
    const oldText = downloadBtn.textContent;

    downloadBtn.textContent = "Preparing PDF...";
    downloadBtn.disabled = true;

    const options = {
        margin: 0.5,
        filename: "ai-travel-plan.pdf",
        image: {
            type: "jpeg",
            quality: 0.98
        },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#0a0e1c"
        },
        jsPDF: {
            unit: "in",
            format: "a4",
            orientation: "portrait"
        },
        pagebreak: {
            mode: ["avoid-all", "css", "legacy"]
        }
    };

    html2pdf()
        .set(options)
        .from(pdfContent)
        .save()
        .then(() => {
            downloadBtn.textContent = oldText;
            downloadBtn.disabled = false;
        })
        .catch(() => {
            downloadBtn.textContent = oldText;
            downloadBtn.disabled = false;
            showError("Could not download PDF.");
        });
}

document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "Enter") {
        sendMessage();
    }
});

// =========================
// Tabs
// =========================

function switchTab(tab) {
    const plannerTab = document.getElementById("plannerTab");
    const flightTab = document.getElementById("flightTab");
    const plannerBtn = document.getElementById("tabPlannerBtn");
    const flightBtn = document.getElementById("tabFlightBtn");

    const isPlanner = tab === "planner";

    plannerTab.classList.toggle("hidden", !isPlanner);
    flightTab.classList.toggle("hidden", isPlanner);
    plannerBtn.classList.toggle("active", isPlanner);
    flightBtn.classList.toggle("active", !isPlanner);
}

// =========================
// Flight Tracking
// =========================

function setFlightLoading(isLoading) {
    const searchBtn = document.getElementById("flightSearchBtn");
    const btnText = document.getElementById("flightBtnText");
    const btnLoader = document.getElementById("flightBtnLoader");

    searchBtn.disabled = isLoading;

    if (isLoading) {
        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
    } else {
        btnText.classList.remove("hidden");
        btnLoader.classList.add("hidden");
    }
}

function showFlightError(message) {
    const errorBox = document.getElementById("flightErrorBox");

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideFlightError() {
    const errorBox = document.getElementById("flightErrorBox");

    errorBox.classList.add("hidden");
    errorBox.textContent = "";
}

function formatFlightTime(timeStr) {
    if (!timeStr) {
        return "Unknown";
    }

    const date = new Date(timeStr.replace(" ", "T"));

    if (isNaN(date.getTime())) {
        return timeStr;
    }

    return date.toLocaleString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatInr(amount) {
    return new Intl.NumberFormat("en-IN").format(amount);
}

function renderFlightCard(flight, currency) {
    const stopsLabel = flight.stops === 0
        ? "Nonstop"
        : `${flight.stops} ${flight.stops === 1 ? "stop" : "stops"}`;

    const priceLabel = flight.price ? `${currency} ${flight.price}` : "Price unavailable";
    const inrLabel = flight.price_inr ? `₹${formatInr(flight.price_inr)}` : "";

    return `
        <div class="flight-card">
            <div class="flight-card-top">
                <div class="flight-airline">
                    ${flight.airline_logo ? `<img src="${flight.airline_logo}" alt="${flight.airline || ''}" class="airline-logo">` : ""}
                    <div>
                        <div class="flight-airline-name">${flight.airline || "Unknown airline"}</div>
                        <div class="flight-number">${flight.flight_number || ""}</div>
                    </div>
                </div>
                <div class="flight-price-block">
                    <div class="flight-price">${priceLabel}</div>
                    ${inrLabel ? `<div class="flight-price-inr">${inrLabel}</div>` : ""}
                </div>
            </div>

            <div class="flight-card-route">
                <div class="flight-route-point">
                    <div class="flight-route-time">${formatFlightTime(flight.departure_time)}</div>
                    <div class="flight-route-airport">${flight.departure_airport || "Unknown"}</div>
                </div>

                <div class="flight-route-middle">
                    <div class="flight-duration">${flight.duration || ""}</div>
                    <div class="flight-route-line"></div>
                    <div class="flight-stops">${stopsLabel}</div>
                </div>

                <div class="flight-route-point">
                    <div class="flight-route-time">${formatFlightTime(flight.arrival_time)}</div>
                    <div class="flight-route-airport">${flight.arrival_airport || "Unknown"}</div>
                </div>
            </div>
        </div>
    `;
}

function showFlightResults(data) {
    const resultSection = document.getElementById("flightResultSection");
    const resultBox = document.getElementById("flightResultBox");
    const routeInfo = document.getElementById("flightRouteInfo");

    const allFlights = [...(data.best_flights || []), ...(data.other_flights || [])];

    let routeText = `${data.departure_id} → ${data.arrival_id} · ${allFlights.length} flight${allFlights.length === 1 ? "" : "s"} found`;

    if (data.usd_to_inr_rate) {
        routeText += ` · 1 USD = ₹${data.usd_to_inr_rate.toFixed(2)} (live)`;
    }

    routeInfo.textContent = routeText;

    if (!allFlights.length) {
        resultBox.innerHTML = `<p class="flight-empty">No flights found for this route and date.</p>`;
    } else {
        resultBox.innerHTML = allFlights
            .map((flight) => renderFlightCard(flight, data.currency))
            .join("");
    }

    resultSection.classList.remove("hidden");

    resultSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function searchFlightTracking() {
    hideFlightError();

    const origin = document.getElementById("flightOrigin").value.trim();
    const destination = document.getElementById("flightDestination").value.trim();
    const outboundDate = document.getElementById("flightDepartDate").value;
    const returnDate = document.getElementById("flightReturnDate").value;

    if (!origin || !destination) {
        showFlightError("Please enter both origin and destination.");
        return;
    }

    if (!outboundDate) {
        showFlightError("Please select a departure date.");
        return;
    }

    if (returnDate && returnDate < outboundDate) {
        showFlightError("Return date cannot be before the departure date.");
        return;
    }

    setFlightLoading(true);

    try {
        const response = await fetch("/api/flight-tracking", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                origin,
                destination,
                outbound_date: outboundDate,
                return_date: returnDate || null
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Something went wrong.");
        }

        showFlightResults(data);

    } catch (error) {
        showFlightError(error.message);
    } finally {
        setFlightLoading(false);
    }
}