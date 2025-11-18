// Restaurante - Painel administrativo com API ASP.NET Core
// ------------------------------------------------------------
// Esta versão remove a dependência do dataSdk e conversa
// diretamente com os endpoints em /api/...

// =====================
// CONFIG / ESTADO
// =====================

const API_BASE_URL = "/api";

let orders = [];
let products = [];
let orderSearchTerm = "";
let orderStatusFilter = "";

// =====================
// HELPERS
// =====================

function formatMoney(value) {
    return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

async function apiRequest(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    const config = {
        headers: { "Content-Type": "application/json" },
        ...options
    };

    const response = await fetch(url, config);
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Erro HTTP ${response.status} - ${text || response.statusText}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

function showMessage(message, type = "success") {
    const div = document.createElement("div");
    div.className =
        "fixed top-4 right-4 px-4 py-2 rounded-lg text-sm font-semibold z-50 " +
        (type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white");
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function normalizeStatus(status) {
    if (!status) return "Cozinha";
    if (status === "Criado") return "Cozinha";
    if (status === "Cancelado") return "Cancelados";
    return status;
}

// =====================
// NAVEGAÇÃO (para index, products, etc.)
// =====================

function showSection(section) {
    const sections = ["orders", "products", "customers", "analytics"];
    sections.forEach((s) => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.classList.add("hidden");
    });

    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.remove("hidden");
}

// =====================
// RENDERIZAÇÃO DE PEDIDOS
// =====================

function createOrderCard(order) {
    const date = new Date(order.createdAt);
    const timeString = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const dateString = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
    });

    const card = document.createElement("div");
    card.className =
        "order-card bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer";

    card.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
        showOrderDetails(order);
    });

    const itemsText = (order.items || [])
        .map((i) => `${i.quantity}x ${i.productName}`)
        .join(", ");

    const actionsHtml = getOrderActionButtons(order);

    card.innerHTML = `
        <div class="flex flex-col space-y-2">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-sm text-gray-500">Pedido #${order.id}</p>
                    <p class="text-xs text-gray-400">${dateString} às ${timeString}</p>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    ${normalizeStatus(order.status)}
                </span>
            </div>
            <p class="text-sm text-gray-700">
                Itens: <span class="text-gray-900">${itemsText || "—"}</span>
            </p>
            <p class="text-sm text-gray-700">
                Total: <span class="font-bold text-green-600">${formatMoney(order.total)}</span>
            </p>
            <div class="pt-2 border-t border-gray-100">
                ${actionsHtml}
            </div>
        </div>
    `;

    return card;
}

function getOrderActionButtons(order) {
    const status = normalizeStatus(order.status);
    const id = order.id;

    if (status === "Cozinha") {
        return `
            <div class="flex space-x-2">
                <button data-action="to-awaiting" data-id="${id}" class="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded-lg">
                    ⏳ Aguardando
                </button>
                <button data-action="to-cancel" data-id="${id}" class="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-lg">
                    ❌ Cancelar
                </button>
            </div>
        `;
    }
    if (status === "Aguardando entrega") {
        return `
            <div class="flex space-x-2">
                <button data-action="to-out" data-id="${id}" class="bg-orange-500 hover:bg-orange-600 text-white text-xs py-1 px-2 rounded-lg">
                    🚚 Enviar
                </button>
                <button data-action="to-cancel" data-id="${id}" class="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-lg">
                    ❌ Cancelar
                </button>
            </div>
        `;
    }
    if (status === "Saiu para entrega") {
        return `
            <button data-action="to-delivered" data-id="${id}" class="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-lg">
                ✅ Entregar
            </button>
        `;
    }

    return '<p class="text-xs text-gray-400 text-center py-1">Pedido finalizado</p>';
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await apiRequest(`/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: newStatus })
        });

        const order = orders.find((o) => o.id === orderId);
        if (order) order.status = newStatus;

        renderKanbanBoard();
        updateAnalytics();
        showMessage(`Status atualizado para ${newStatus}.`, "success");
    } catch (err) {
        console.error(err);
        showMessage("Erro ao atualizar status do pedido.", "error");
    }
}

// Expor para uso em event delegation, se necessário
window.updateOrderStatus = updateOrderStatus;

function renderKanbanBoard() {
    const columns = {
        new: document.getElementById("new-orders"),
        preparing: document.getElementById("preparing-orders"),
        ready: document.getElementById("ready-orders"),
        delivered: document.getElementById("delivered-orders"),
        cancelled: document.getElementById("cancelled-orders")
    };

    if (!columns.new) return;

    const counts = {
        new: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0
    };

    Object.values(columns).forEach((col) => {
        if (col) col.innerHTML = "";
    });

    let filtered = [...orders];

    // Filtro texto
    if (orderSearchTerm) {
        filtered = filtered.filter((order) => {
            const normalized = [
                `#${order.id}`,
                order.deliveryAddress || "",
                normalizeStatus(order.status)
            ]
                .join(" ")
                .toLowerCase();
            return normalized.includes(orderSearchTerm);
        });
    }

    // Filtro de status (select)
    if (orderStatusFilter) {
        filtered = filtered.filter(
            (order) => normalizeStatus(order.status) === orderStatusFilter
        );
    }

    filtered.forEach((order) => {
        const statusNorm = normalizeStatus(order.status);
        let colKey = "new";

        if (statusNorm === "Cozinha") colKey = "new";
        else if (statusNorm === "Aguardando entrega") colKey = "preparing";
        else if (statusNorm === "Saiu para entrega") colKey = "ready";
        else if (statusNorm === "Entregue") colKey = "delivered";
        else if (statusNorm === "Cancelados") colKey = "cancelled";

        const column = columns[colKey];
        if (!column) return;

        const card = createOrderCard(order);
        column.appendChild(card);
        counts[colKey]++;
    });

    // Atualizar contadores
    const mapping = {
        new: "new-orders-count",
        preparing: "preparing-orders-count",
        ready: "ready-orders-count",
        delivered: "delivered-orders-count",
        cancelled: "cancelled-orders-count"
    };

    for (const key in mapping) {
        const span = document.getElementById(mapping[key]);
        if (span) span.textContent = counts[key];
    }

    // Contador de pedidos pendentes (na barra superior)
    const pendingCountEl = document.getElementById("pending-orders-count");
    if (pendingCountEl) {
        const pending = orders.filter((o) => {
            const st = normalizeStatus(o.status);
            return st !== "Entregue" && st !== "Cancelados";
        }).length;

        if (pending > 0) {
            pendingCountEl.textContent = pending;
            pendingCountEl.classList.remove("hidden");
        } else {
            pendingCountEl.textContent = "0";
            pendingCountEl.classList.add("hidden");
        }
    }
}

// =====================
// DETALHES DO PEDIDO
// =====================

function showOrderDetails(order) {
    const modal = document.getElementById("order-details-modal");
    const content = document.getElementById("order-details-content");
    if (!modal || !content) return;

    const date = new Date(order.createdAt);
    const itemsHtml = (order.items || [])
        .map(
            (i) => `
        <div class="flex justify-between text-sm py-1">
            <span>${i.quantity}x ${i.productName}</span>
            <span class="font-medium">${formatMoney(i.unitPrice * i.quantity)}</span>
        </div>
    `
        )
        .join("");

    content.innerHTML = `
        <div class="space-y-4">
            <div>
                <p class="text-sm text-gray-500">Pedido #${order.id}</p>
                <p class="text-xs text-gray-400">${date.toLocaleString("pt-BR")}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Status atual:</p>
                <p class="text-base font-semibold text-gray-800">${normalizeStatus(
                    order.status
                )}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Endereço de entrega:</p>
                <p class="text-base text-gray-800">${
                    order.deliveryAddress || "Retirada no balcão"
                }</p>
            </div>
            <div>
                <p class="text-sm text-gray-600 mb-1">Itens:</p>
                <div class="bg-gray-50 rounded-lg p-3">
                    ${itemsHtml || "<p class='text-sm text-gray-500'>Sem itens.</p>"}
                </div>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-gray-100">
                <span class="text-sm text-gray-600">Total:</span>
                <span class="text-lg font-bold text-green-600">${formatMoney(
                    order.total
                )}</span>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
}

function hideOrderDetails() {
    const modal = document.getElementById("order-details-modal");
    if (modal) modal.classList.add("hidden");
}

// =====================
// ANALYTICS (topo da tela)
// =====================

function updateAnalytics() {
    const totalOrdersTodayEl = document.getElementById("total-orders-today");
    const revenueTodayEl = document.getElementById("revenue-today");

    if (!totalOrdersTodayEl && !revenueTodayEl) return;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // yyyy-mm-dd

    const todaysOrders = orders.filter((o) => {
        const d = new Date(o.createdAt);
        const dStr = d.toISOString().slice(0, 10);
        return dStr === todayStr;
    });

    const totalCount = todaysOrders.length;
    const totalRevenue = todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    if (totalOrdersTodayEl) totalOrdersTodayEl.textContent = totalCount;
    if (revenueTodayEl) revenueTodayEl.textContent = formatMoney(totalRevenue);
}

// =====================
// EVENTOS
// =====================

function setupEventListeners() {
    const ordersBtn = document.getElementById("orders-btn");
    const productsBtn = document.getElementById("products-btn");
    const customersBtn = document.getElementById("customers-btn");
    const analyticsBtn = document.getElementById("analytics-btn");

    if (ordersBtn) ordersBtn.addEventListener("click", () => showSection("orders"));
    if (productsBtn)
        productsBtn.addEventListener("click", () => showSection("products"));
    if (customersBtn)
        customersBtn.addEventListener("click", () => showSection("customers"));
    if (analyticsBtn)
        analyticsBtn.addEventListener("click", () => showSection("analytics"));

    const orderSearch = document.getElementById("order-search");
    if (orderSearch) {
        orderSearch.addEventListener("input", (e) => {
            orderSearchTerm = e.target.value.toLowerCase();
            renderKanbanBoard();
        });
    }

    const statusFilter = document.getElementById("status-filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            orderStatusFilter = e.target.value;
            renderKanbanBoard();
        });
    }

    const clearSearchBtn = document.getElementById("clear-search");
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", () => {
            if (orderSearch) orderSearch.value = "";
            if (statusFilter) statusFilter.value = "";
            orderSearchTerm = "";
            orderStatusFilter = "";
            renderKanbanBoard();
        });
    }

    const orderDetailsClose = document.getElementById("order-details-close");
    if (orderDetailsClose) {
        orderDetailsClose.addEventListener("click", hideOrderDetails);
    }

    const modal = document.getElementById("order-details-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target.id === "order-details-modal") hideOrderDetails();
        });
    }

    const statusBtn = document.getElementById("restaurant-status-btn");
    const statusText = document.getElementById("status-text");
    const statusToggle = document.getElementById("status-toggle");

    if (statusBtn && statusText && statusToggle) {
        statusBtn.addEventListener("click", () => {
            const isOpen = statusText.textContent.includes("ABERTO");
            if (isOpen) {
                statusText.textContent = "FECHADO";
                statusText.classList.remove("text-green-600");
                statusText.classList.add("text-red-600");
                statusBtn.classList.remove("bg-green-500");
                statusBtn.classList.add("bg-red-500");
                statusToggle.classList.remove("translate-x-6");
                statusToggle.classList.add("translate-x-0");
            } else {
                statusText.textContent = "ABERTO";
                statusText.classList.remove("text-red-600");
                statusText.classList.add("text-green-600");
                statusBtn.classList.remove("bg-red-500");
                statusBtn.classList.add("bg-green-500");
                statusToggle.classList.remove("translate-x-0");
                statusToggle.classList.add("translate-x-6");
            }
        });
    }

    // Delegação de eventos para botões de ação dos cards
    const ordersSection = document.getElementById("orders-section");
    if (ordersSection) {
        ordersSection.addEventListener("click", async (e) => {
            const btn = e.target.closest("button");
            if (!btn || !btn.dataset.action || !btn.dataset.id) return;

            const id = parseInt(btn.dataset.id);
            const action = btn.dataset.action;

            if (Number.isNaN(id)) return;

            if (action === "to-awaiting") {
                await updateOrderStatus(id, "Aguardando entrega");
            } else if (action === "to-out") {
                await updateOrderStatus(id, "Saiu para entrega");
            } else if (action === "to-delivered") {
                await updateOrderStatus(id, "Entregue");
            } else if (action === "to-cancel") {
                await updateOrderStatus(id, "Cancelado");
            }
        });
    }
}

// =====================
// INICIALIZAÇÃO
// =====================

async function loadData() {
    try {
        try {
            orders = await apiRequest("/orders");
        } catch (err) {
            console.error("Erro ao buscar pedidos:", err);
            orders = [];
        }

        try {
            products = await apiRequest("/products");
        } catch (err) {
            console.error("Erro ao buscar produtos:", err);
            products = [];
        }

        renderKanbanBoard();
        updateAnalytics();
    } catch (err) {
        console.error("Erro na carga inicial:", err);
        showMessage("Erro ao carregar dados do restaurante.", "error");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    await loadData();
    showSection("orders");
});
