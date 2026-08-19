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