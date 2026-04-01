const state = {
    latestAnalysis: null,
    overview: null,
    charts: {}
};

const el = {
    uploadForm: document.getElementById("upload-form"),
    billFile: document.getElementById("bill-file"),
    dropzone: document.querySelector(".dropzone"),
    dropzoneFile: document.getElementById("dropzone-file"),
    purchaseDate: document.getElementById("purchase-date"),
    uploadStatus: document.getElementById("upload-status"),
    loadDemo: document.getElementById("load-demo"),
    heroAnalyses: document.getElementById("hero-analyses"),
    heroHidden: document.getElementById("hero-hidden"),
    heroWater: document.getElementById("hero-water"),
    metricVisible: document.getElementById("metric-visible"),
    metricInvisible: document.getElementById("metric-invisible"),
    metricWater: document.getElementById("metric-water"),
    metricIndex: document.getElementById("metric-index"),
    clearHistory: document.getElementById("clear-history"),
    recommendList: document.getElementById("recommend-list"),
    historyList: document.getElementById("history-list"),
    lastUpdated: document.getElementById("last-updated"),
    wasteBarChart: document.getElementById("waste-bar-chart"),
    categoryChart: document.getElementById("category-chart"),
    wastePie: document.getElementById("waste-pie"),
    packagingChart: document.getElementById("packaging-chart"),
    projectionChart: document.getElementById("projection-chart"),
    productChart: document.getElementById("product-chart")
};

const chartPalette = {
    green: "#1d6f42",
    greenSoft: "#8ecf71",
    lime: "#d6ef72",
    warm: "#f2c572",
    slate: "#7da18a",
    deep: "#0e4727"
};

const formatKg = (value) => `${Number(value || 0).toFixed(2)} kg`;
const formatLitres = (value) => `${Math.round(Number(value || 0)).toLocaleString()} L`;

function setStatus(message, isError = false) {
    el.uploadStatus.textContent = message;
    el.uploadStatus.style.color = isError ? "#a53232" : "";
}

function updateFileIndicator() {
    const hasFile = el.billFile.files.length > 0;
    el.dropzone.classList.toggle("has-file", hasFile);
    el.dropzoneFile.textContent = hasFile ? `${el.billFile.files[0].name} selected` : "No file selected";
}

async function parseResponse(response) {
    const raw = await response.text();
    let payload = null;

    if (raw.trim()) {
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = null;
        }
    }

    if (!response.ok) {
        const message =
            payload?.error ||
            (raw.trim() ? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "") ||
            `Request failed with status ${response.status}.`;
        throw new Error(message);
    }

    if (!payload) {
        throw new Error("The server returned an empty response. Please restart the Flask app and try again.");
    }

    return payload;
}

function renderOverview(overview) {
    state.overview = overview;
    el.heroAnalyses.textContent = overview.totalAnalyses || 0;
    el.heroHidden.textContent = formatKg(overview.cumulativeInvisibleWasteKg);
    el.heroWater.textContent = formatLitres(overview.cumulativeWaterFootprintL);
    renderHistory(overview.recentAnalyses || []);
}

function renderMetrics(summary) {
    el.metricVisible.textContent = formatKg(summary.totalVisibleWasteKg);
    el.metricInvisible.textContent = formatKg(summary.totalInvisibleWasteKg);
    el.metricWater.textContent = formatLitres(summary.totalWaterFootprintL);
    el.metricIndex.textContent = Number(summary.invisibleWasteIndex || 0).toFixed(1);
}

function renderRecommendations(recommendations = []) {
    el.recommendList.innerHTML = "";

    if (!recommendations.length) {
        el.recommendList.innerHTML = "<p>Recommendations will appear after analysis.</p>";
        return;
    }

    recommendations.forEach((item) => {
        const card = document.createElement("article");
        card.className = "recommend-item";
        card.innerHTML = `
            <span class="recommend-kicker">Lower-Impact Swap</span>
            <h4>${item.title}</h4>
            <p><strong>Action:</strong> ${item.message}</p>
        `;
        el.recommendList.appendChild(card);
    });
}

function renderHistory(history = []) {
    el.historyList.innerHTML = "";

    if (!history.length) {
        el.historyList.innerHTML = "<p>No analyses stored yet.</p>";
        if (el.clearHistory) {
            el.clearHistory.disabled = true;
        }
        return;
    }

    if (el.clearHistory) {
        el.clearHistory.disabled = false;
    }

    history.forEach((item) => {
        const card = document.createElement("article");
        card.className = "history-item";
        card.innerHTML = `
            <h4>${item.fileName}</h4>
            <p>${item.userName} | ${item.uploadedAt}</p>
            <p>Invisible waste: ${formatKg(item.totalInvisibleWasteKg)} | Water: ${formatLitres(item.totalWaterFootprintL)}</p>
        `;
        el.historyList.appendChild(card);
    });
}

function destroyChart(key) {
    if (state.charts[key]) {
        state.charts[key].destroy();
    }
}

function createChart(key, canvas, config) {
    if (!window.Chart || !canvas) {
        return;
    }

    destroyChart(key);
    state.charts[key] = new window.Chart(canvas, config);
}

function baseChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#335243",
                    font: {
                        size: 12,
                        family: "Trebuchet MS"
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: "#527160", maxRotation: 0, autoSkip: true, font: { size: 11 } },
                grid: { color: "rgba(23,49,30,0.08)" }
            },
            y: {
                ticks: { color: "#527160", font: { size: 11 } },
                grid: { color: "rgba(23,49,30,0.08)" }
            }
        }
    };
}

function renderCharts(payload) {
    if (!window.Chart) {
        setStatus("Charts could not load. Check your internet connection and refresh the page.", true);
        return;
    }

    const summary = payload.summary || {};
    const items = payload.items || [];
    const categoryBreakdown = payload.categoryBreakdown || [];
    const predictions = payload.predictions || [];

    createChart("wasteBar", el.wasteBarChart, {
        type: "bar",
        data: {
            labels: ["Visible Waste", "Invisible Waste", "Water Footprint / 100"],
            datasets: [{
                label: "Current Analysis",
                data: [
                    Number(summary.totalVisibleWasteKg || 0),
                    Number(summary.totalInvisibleWasteKg || 0),
                    Number(summary.totalWaterFootprintL || 0) / 100
                ],
                backgroundColor: [chartPalette.greenSoft, chartPalette.green, chartPalette.warm],
                borderRadius: 12
            }]
        },
        options: {
            ...baseChartOptions(),
            plugins: {
                legend: { display: false }
            },
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    beginAtZero: true
                }
            }
        }
    });

    createChart("category", el.categoryChart, {
        type: "bar",
        data: {
            labels: categoryBreakdown.map((item) => item.category),
            datasets: [{
                label: "Invisible Waste (kg)",
                data: categoryBreakdown.map((item) => Number(item.invisibleWasteKg || 0)),
                backgroundColor: [
                    "#1d6f42",
                    "#4d9657",
                    "#8ecf71",
                    "#d6ef72",
                    "#f2c572",
                    "#7da18a"
                ],
                borderRadius: 10
            }]
        },
        options: {
            ...baseChartOptions(),
            indexAxis: "y",
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: "#527160", font: { size: 11 } },
                    grid: { color: "rgba(23,49,30,0.08)" }
                },
                y: {
                    ticks: { color: "#527160", font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });

    createChart("wastePie", el.wastePie, {
        type: "doughnut",
        data: {
            labels: ["Visible Waste", "Invisible Waste"],
            datasets: [{
                data: [
                    Number(summary.totalVisibleWasteKg || 0),
                    Number(summary.totalInvisibleWasteKg || 0)
                ],
                backgroundColor: [chartPalette.greenSoft, chartPalette.green],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#335243",
                        font: { family: "Trebuchet MS", size: 11 },
                        boxWidth: 12
                    }
                }
            }
        }
    });

    const packagingMap = {};
    items.forEach((item) => {
        const key = item.packagingType || "Unknown";
        packagingMap[key] = (packagingMap[key] || 0) + Number(item.invisibleWasteKg || 0);
    });
    const packagingLabels = Object.keys(packagingMap);
    const packagingValues = packagingLabels.map((key) => packagingMap[key]);

    createChart("packaging", el.packagingChart, {
        type: "pie",
        data: {
            labels: packagingLabels,
            datasets: [{
                data: packagingValues,
                backgroundColor: [
                    "#1d6f42",
                    "#4d9657",
                    "#8ecf71",
                    "#d6ef72",
                    "#f2c572",
                    "#7da18a"
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        color: "#335243",
                        font: { family: "Trebuchet MS", size: 11 },
                        boxWidth: 12
                    }
                }
            }
        }
    });

    createChart("projection", el.projectionChart, {
        type: "line",
        data: {
            labels: predictions.map((item) => item.label),
            datasets: [{
                label: "Projected Invisible Waste (kg)",
                data: predictions.map((item) => Number(item.projectedInvisibleWasteKg || 0)),
                borderColor: chartPalette.green,
                backgroundColor: "rgba(29,111,66,0.18)",
                fill: true,
                tension: 0.35,
                pointBackgroundColor: chartPalette.lime,
                pointBorderColor: chartPalette.deep,
                pointRadius: 5
            }]
        },
        options: {
            ...baseChartOptions(),
            plugins: {
                legend: {
                    labels: {
                        color: "#335243",
                        font: { family: "Trebuchet MS", size: 11 }
                    }
                }
            },
            scales: {
                ...baseChartOptions().scales,
                y: {
                    ...baseChartOptions().scales.y,
                    beginAtZero: true
                }
            }
        }
    });

    const topItems = [...items]
        .sort((a, b) => Number(b.invisibleWasteKg || 0) - Number(a.invisibleWasteKg || 0))
        .slice(0, 12);

    createChart("products", el.productChart, {
        type: "bar",
        data: {
            labels: topItems.map((item) => item.product),
            datasets: [{
                label: "Invisible Waste (kg)",
                data: topItems.map((item) => Number(item.invisibleWasteKg || 0)),
                backgroundColor: "rgba(29,111,66,0.82)",
                borderRadius: 8,
                maxBarThickness: 32
            }]
        },
        options: {
            ...baseChartOptions(),
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: "#527160", font: { size: 10 } },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: "#527160", font: { size: 11 } },
                    grid: { color: "rgba(23,49,30,0.08)" },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderAnalysis(payload) {
    state.latestAnalysis = payload;
    renderMetrics(payload.summary);
    renderCharts(payload);
    renderRecommendations(payload.recommendations);
    el.lastUpdated.textContent = `Updated ${payload.summary.generatedAt}`;
}

async function fetchOverview() {
    const response = await fetch("/api/overview");
    const payload = await parseResponse(response);
    renderOverview(payload);

    if (payload.latestAnalysis) {
        renderAnalysis(payload.latestAnalysis);
    }
}

async function submitUpload(formData) {
    setStatus("Analyzing uploaded bill...");
    const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
    });

    const payload = await parseResponse(response);
    renderAnalysis(payload);
    await fetchOverview();
    setStatus(`Analysis complete for ${payload.summary.fileName}.`);
    window.location.hash = "dashboard";
}

async function loadDemo() {
    setStatus("Running demo analysis...");
    const response = await fetch("/api/demo", { method: "POST" });
    const payload = await parseResponse(response);
    renderAnalysis(payload);
    await fetchOverview();
    setStatus("Demo analysis loaded successfully.");
    window.location.hash = "dashboard";
}

async function clearHistory() {
    setStatus("Clearing recent analyses...");
    const response = await fetch("/api/history", { method: "DELETE" });
    await parseResponse(response);

    Object.keys(state.charts).forEach((key) => destroyChart(key));
    state.latestAnalysis = null;
    el.metricVisible.textContent = "0 kg";
    el.metricInvisible.textContent = "0 kg";
    el.metricWater.textContent = "0 L";
    el.metricIndex.textContent = "0";
    el.lastUpdated.textContent = "No analysis yet";
    renderRecommendations([]);
    renderHistory([]);
    renderOverview({
        totalAnalyses: 0,
        cumulativeInvisibleWasteKg: 0,
        cumulativeWaterFootprintL: 0,
        recentAnalyses: []
    });
    setStatus("Recent analyses cleared.");
}

el.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!el.billFile.files.length) {
        setStatus("Choose a CSV, XLSX, or PDF file before analyzing.", true);
        return;
    }

    const formData = new FormData(el.uploadForm);
    if (!formData.get("purchase_date")) {
        formData.set("purchase_date", new Date().toISOString().slice(0, 10));
    }

    try {
        await submitUpload(formData);
    } catch (error) {
        setStatus(error.message, true);
    }
});

el.loadDemo.addEventListener("click", async () => {
    try {
        await loadDemo();
    } catch (error) {
        setStatus(error.message, true);
    }
});

el.clearHistory?.addEventListener("click", async () => {
    try {
        await clearHistory();
    } catch (error) {
        setStatus(error.message, true);
    }
});

el.billFile.addEventListener("change", updateFileIndicator);

el.purchaseDate.value = new Date().toISOString().slice(0, 10);
updateFileIndicator();

fetchOverview().catch((error) => {
    setStatus(error.message, true);
});
