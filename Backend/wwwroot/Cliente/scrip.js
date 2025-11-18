// Cliente - Digital Menu com API ASP.NET Core
// ------------------------------------------------------
// Este script NÃO usa mais o dataSdk. Ele se comunica
// diretamente com a API em /api/...

// =====================
// CONFIG / ESTADO
// =====================

const API_BASE_URL = "burgerhouse.runasp.net";

const defaultConfig = {
    restaurant_name: "🍔 Burger House",
    delivery_fee: "5.00",
    footer_text: "🍔 Delivery rápido e saboroso!"
};

let currentSection = "menu";
let currentFilter = "all";
let products = [];
let cart = [];
let orders = [];
let currentUser = null;
let pendingItem = null;
let modalQuantity = 1;
let modalExtras = [];
let modalRemovedIngredients = [];
let modalObservations = '';

// =====================
// HELPERS
// =====================

function formatMoney(value) {
    return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

async function apiRequest(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    const baseOptions = {
        headers: { "Content-Type": "application/json" },
        ...options
    };

    const response = await fetch(url, baseOptions);
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Erro HTTP ${response.status} - ${text || response.statusText}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

function showMessage(message, type = "success") {
    const messageDiv = document.createElement("div");
    messageDiv.className =
        "fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 " +
        (type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white");
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

// =====================
// NAVEGAÇÃO ENTRE SEÇÕES
// =====================

function showSection(section) {
    const sections = ["menu", "cart", "orders", "profile"];
    sections.forEach((s) => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.classList.add("hidden");
    });

    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.remove("hidden");

    currentSection = section;
}

function setFilter(filter) {
    currentFilter = filter;
    renderMenu();
}

// =====================
// LOGIN / REGISTRO
// =====================

function restoreUserFromStorage() {
    const stored = localStorage.getItem("dm_currentUser");
    if (stored) {
        try {
            currentUser = JSON.parse(stored);
        } catch {
            currentUser = null;
        }
    }
}

function persistUser() {
    if (currentUser) {
        localStorage.setItem("dm_currentUser", JSON.stringify(currentUser));
    } else {
        localStorage.removeItem("dm_currentUser");
    }
}

function updateLoginState() {
    const guestCheckout = document.getElementById("guest-checkout");
    const userCheckout = document.getElementById("user-checkout");
    const userInfo = document.getElementById("user-info");
    const profileName = document.getElementById("profile-name");
    const profilePhone = document.getElementById("profile-phone");

    if (currentUser) {
        if (guestCheckout) guestCheckout.classList.add("hidden");
        if (userCheckout) userCheckout.classList.remove("hidden");
        if (userInfo)
            userInfo.textContent = `${currentUser.name} - ${currentUser.phone || ""}`;
        if (profileName) profileName.value = currentUser.name || "";
        if (profilePhone) profilePhone.value = currentUser.phone || "";
    } else {
        if (guestCheckout) guestCheckout.classList.remove("hidden");
        if (userCheckout) userCheckout.classList.add("hidden");
        if (userInfo) userInfo.textContent = "";
    }
}

function showLoginModal() {
    const modal = document.getElementById("login-modal");
    if (modal) modal.classList.remove("hidden");

    showLoginForm();
}

function hideLoginModal() {
    const modal = document.getElementById("login-modal");
    if (modal) modal.classList.add("hidden");
}

function showLoginForm() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const forgotForm = document.getElementById("forgot-password-form");
    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");

    if (loginForm) loginForm.classList.remove("hidden");
    if (registerForm) registerForm.classList.add("hidden");
    if (forgotForm) forgotForm.classList.add("hidden");
    if (loginTab) loginTab.classList.add("bg-white", "shadow");
    if (loginTab) loginTab.classList.remove("bg-transparent");
    if (registerTab) registerTab.classList.remove("bg-white", "shadow");
}

function showRegisterForm() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const forgotForm = document.getElementById("forgot-password-form");
    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");

    if (loginForm) loginForm.classList.add("hidden");
    if (registerForm) registerForm.classList.remove("hidden");
    if (forgotForm) forgotForm.classList.add("hidden");
    if (registerTab) registerTab.classList.add("bg-white", "shadow");
    if (registerTab) registerTab.classList.remove("bg-transparent");
    if (loginTab) loginTab.classList.remove("bg-white", "shadow");
}

async function login() {
    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();

    if (!email || !password) {
        showMessage("Preencha e-mail e senha.", "error");
        return;
    }

    const button = document.getElementById("login-submit");
    const originalText = button ? button.textContent : "";
    if (button) {
        button.textContent = "Entrando...";
        button.disabled = true;
    }

    try {
        const user = await apiRequest("/users/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        currentUser = user;
        persistUser();
        updateLoginState();
        hideLoginModal();
        showMessage(`Bem-vindo, ${user.name}!`, "success");
        await loadOrdersFromApi();
    } catch (err) {
        console.error(err);
        showMessage("E-mail ou senha inválidos.", "error");
    } finally {
        if (button) {
            button.textContent = originalText || "Entrar";
            button.disabled = false;
        }
    }
}

async function register() {
    const name = document.getElementById("register-name")?.value.trim();
    const email = document.getElementById("register-email")?.value.trim();
    const phone = document.getElementById("register-phone")?.value.trim();
    const password = document.getElementById("register-password")?.value.trim();

    if (!name || !email || !phone || !password) {
        showMessage("Preencha todos os campos de cadastro.", "error");
        return;
    }

    const button = document.getElementById("register-submit");
    const originalText = button ? button.textContent : "";
    if (button) {
        button.textContent = "Criando conta...";
        button.disabled = true;
    }

    try {
        const body = {
            name,
            email,
            phone,
            password,
            role: "cliente"
        };
        const user = await apiRequest("/users/register", {
            method: "POST",
            body: JSON.stringify(body)
        });
        currentUser = user;
        persistUser();
        updateLoginState();
        hideLoginModal();
        showMessage("Conta criada com sucesso!", "success");
        await loadOrdersFromApi();
    } catch (err) {
        console.error(err);
        showMessage("Erro ao criar conta. Tente novamente.", "error");
    } finally {
        if (button) {
            button.textContent = originalText || "Criar Conta";
            button.disabled = false;
        }
    }
}

function logout() {
    currentUser = null;
    persistUser();
    updateLoginState();
    showMessage("Você saiu da sua conta.", "success");
}

// Atualizar perfil básico (nome/telefone)
async function saveProfile() {
    if (!currentUser) {
        showMessage("Faça login para salvar seu perfil.", "error");
        return;
    }

    const name = document.getElementById("profile-name")?.value.trim();
    const phone = document.getElementById("profile-phone")?.value.trim();

    if (!name) {
        showMessage("O nome não pode estar vazio.", "error");
        return;
    }

    try {
        const body = {
            name,
            email: currentUser.email,
            phone,
            password: "", // ignorado pelo backend na atualização
            role: currentUser.role
        };

        await apiRequest(`/users/${currentUser.id}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        currentUser.name = name;
        currentUser.phone = phone;
        persistUser();
        updateLoginState();
        showMessage("Perfil atualizado com sucesso!", "success");
    } catch (err) {
        console.error(err);
        showMessage("Erro ao atualizar perfil.", "error");
    }
}

// =====================
// PRODUTOS / CARDÁPIO
// =====================

function getCategoryIcon(category) {
    if (category === "burger") return "🍔";
    if (category === "side") return "🍟";
    if (category === "drink") return "🥤";
    return "🍽️";
}

function renderMenu() {
    const container = document.getElementById("products-list");
    if (!container) return;

    // Usa os produtos vindos da API (/api/products)
    let items = products || [];

    switch (currentFilter) {
        case "burgers":
            items = items.filter((p) => p.category === "burger");
            break;
        case "sides":
            items = items.filter((p) => p.category === "side");
            break;
        case "drinks":
            items = items.filter((p) => p.category === "drink");
            break;
        default:
            // "all" – não filtra nada
            break;
    }

    if (!items.length) {
        container.innerHTML =
            '<p class="text-gray-500 py-8 text-center">Nenhum produto encontrado.</p>';
        return;
    }

    container.innerHTML = items
        .map(
            (item) => `
        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-4">
                <div class="text-3xl">${getCategoryIcon(item.category)}</div>
                <div>
                    <h4 class="font-bold text-lg text-gray-800">${item.name}</h4>
                    <p class="text-gray-600 text-sm">${item.description || ""}</p>
                    <span class="text-xl font-bold text-green-600">
                        ${formatMoney(item.price)}
                    </span>
                </div>
            </div>
            <button
                class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors add-to-cart-btn"
                data-id="${item.id}"
            >
                Adicionar
            </button>
        </div>`
        )
        .join("");

    // Conecta os botões "Adicionar" ao modal de opcionais/adicionais
    container.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const product = products.find((p) => String(p.id) === String(id));
            if (product) {
                openItemCustomizationModal(product);
            }
        });
    });
}
// =====================
// CARRINHO
// =====================

function addToCart(item, quantity = 1, extras = [], removedIngredients = [], observations = '') {
    if (!quantity || quantity < 1) quantity = 1;

    // Identificador único considerando extras, ingredientes removidos e observações
    const extrasId   = extras.map(e => e.name).sort().join(',');
    const removedId  = removedIngredients.sort().join(',');
    const obsId      = observations.trim();
    const uniqueId   = `${item.id}_${extrasId}_${removedId}_${obsId}`;

    const extrasPrice    = extras.reduce((sum, extra) => sum + extra.price, 0);
    const finalUnitPrice = (Number(item.price) || 0) + extrasPrice;

    // Nome exibido com customizações
    let displayName = item.name;
    const customizations = [];

    if (removedIngredients.length > 0) {
        customizations.push(`Sem: ${removedIngredients.join(', ')}`);
    }
    if (extras.length > 0) {
        customizations.push(`+ ${extras.map(e => e.name).join(', ')}`);
    }
    if (observations.trim()) {
        customizations.push(`Obs: ${observations.trim()}`);
    }

    if (customizations.length > 0) {
        displayName += ` (${customizations.join(' | ')})`;
    }

    // Verifica se já existe item igual no carrinho
    const existingItem = cart.find(c => c.uniqueId === uniqueId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            ...item,
            uniqueId,
            originalId: item.id,
            name: displayName,
            quantity,
            price: finalUnitPrice,
            originalPrice: item.price,
            extras,
            removedIngredients,
            observations
        });
    }

    // Atualiza UI – só chama se as funções existirem
    if (typeof renderCartSidebar === 'function') {
        renderCartSidebar();
    }
    if (typeof renderCartPage === 'function') {
        renderCartPage();
    }
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    }

    if (typeof showMessage === 'function') {
        showMessage(`${quantity}x ${item.name} adicionado(s) ao carrinho! 🛒`, 'success');
    }

    console.log('Carrinho atual:', cart);
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById("cart-count");
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove("hidden");
        } else {
            badge.textContent = "0";
            badge.classList.add("hidden");
        }
    }
}

function renderCartSidebar() {
    const list = document.getElementById("cart-summary-sidebar");
    const totalBox = document.getElementById("cart-total-sidebar");
    const subtotalEl = document.getElementById("sidebar-subtotal");
    const deliveryEl = document.getElementById("sidebar-delivery-fee");
    const totalEl = document.getElementById("sidebar-total");
    const checkoutBtn = document.getElementById("sidebar-checkout-btn");

    if (!list) return;

    if (!cart.length) {
        list.innerHTML =
            '<p class="text-gray-500 text-center py-8">Carrinho vazio</p>';
        if (totalBox) totalBox.classList.add("hidden");
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    list.innerHTML = cart
        .map(
            (item) => `
        <div class="flex justify-between items-start text-sm border-b border-gray-100 pb-2">
            <div class="flex-1">
                <p class="font-medium text-gray-800">${item.name}</p>
                <p class="text-gray-500">${item.quantity}x ${formatMoney(
                item.price
            )}</p>
            </div>
            <p class="font-semibold text-green-600">${formatMoney(
                item.price * item.quantity
            )}</p>
        </div>`
        )
        .join("");

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const deliveryFee = parseFloat(defaultConfig.delivery_fee || "0");
    const total = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (deliveryEl) deliveryEl.textContent = formatMoney(deliveryFee);
    if (totalEl) totalEl.textContent = formatMoney(total);
    if (totalBox) totalBox.classList.remove("hidden");
    if (checkoutBtn) checkoutBtn.disabled = false;
}

function renderCartPage() {
    const list = document.getElementById("cart-items");
    const summary = document.getElementById("cart-summary");
    const subtotalEl = document.getElementById("subtotal");
    const totalEl = document.getElementById("total");
    const deliveryDisplay = document.getElementById("delivery-fee-display");
    const placeOrderBtn = document.getElementById("place-order");

    if (!list) return;

    if (!cart.length) {
        list.innerHTML =
            '<p class="text-gray-500 text-center py-8">Seu carrinho está vazio</p>';
        if (summary) summary.classList.add("hidden");
        if (placeOrderBtn) placeOrderBtn.disabled = true;
        if (deliveryDisplay)
            deliveryDisplay.textContent = formatMoney(defaultConfig.delivery_fee);
        if (subtotalEl) subtotalEl.textContent = formatMoney(0);
        if (totalEl) totalEl.textContent = formatMoney(0);
        return;
    }

    list.innerHTML = cart
        .map(
            (item, index) => `
        <div class="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
            <div>
                <h4 class="font-bold text-gray-800">${item.name}</h4>
                <p class="text-gray-600 text-sm">${item.quantity}x ${formatMoney(
                item.price
            )}</p>
            </div>
            <div class="flex items-center space-x-3">
                <span class="font-bold text-green-600">${formatMoney(
                    item.price * item.quantity
                )}</span>
                <div class="flex items-center space-x-1">
                    <button class="px-2 py-1 border rounded decrease-item" data-index="${index}">-</button>
                    <span>${item.quantity}</span>
                    <button class="px-2 py-1 border rounded increase-item" data-index="${index}">+</button>
                </div>
                <button class="text-red-600 text-sm remove-item" data-index="${index}">Remover</button>
            </div>
        </div>`
        )
        .join("");

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const deliveryType =
        document.querySelector('input[name="delivery-type"]:checked')?.value ||
        "delivery";
    const deliveryFee =
        deliveryType === "delivery"
            ? parseFloat(defaultConfig.delivery_fee || "0")
            : 0;
    const total = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (deliveryDisplay)
        deliveryDisplay.textContent = formatMoney(deliveryFee);
    if (totalEl) totalEl.textContent = formatMoney(total);
    if (summary) summary.classList.remove("hidden");
    if (placeOrderBtn) placeOrderBtn.disabled = false;

    // Eventos de + / - / remover
    list.querySelectorAll(".decrease-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            const index = parseInt(btn.dataset.index);
            if (cart[index].quantity > 1) {
                cart[index].quantity -= 1;
            } else {
                cart.splice(index, 1);
            }
            renderCartSidebar();
            renderCartPage();
            updateCartCount();
        });
    });
    list.querySelectorAll(".increase-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            const index = parseInt(btn.dataset.index);
            cart[index].quantity += 1;
            renderCartSidebar();
            renderCartPage();
            updateCartCount();
        });
    });
    list.querySelectorAll(".remove-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            const index = parseInt(btn.dataset.index);
            cart.splice(index, 1);
            renderCartSidebar();
            renderCartPage();
            updateCartCount();
        });
    });
}

function getItemIconFromProduct(product) {
  const idStr = String(product.id || "");
  if (idStr.startsWith("b")) return "🍔";
  if (idStr.startsWith("s")) return "🍟";
  if (idStr.startsWith("d")) return "🥤";
  return "🍽️";
}

function openItemCustomizationModal(product) {
  pendingItem = product;
  modalQuantity = 1;
  modalExtras = [];
  modalRemovedIngredients = [];
  modalObservations = '';

  // Atualiza textos do modal (usa o mesmo HTML antigo)
  const iconEl   = document.getElementById("modal-icon");
  const nameEl   = document.getElementById("modal-product-name");
  const descEl   = document.getElementById("modal-product-description");
  const priceEl  = document.getElementById("modal-product-price");
  const qtyEl    = document.getElementById("modal-quantity");
  const obsInput = document.getElementById("modal-observations");

  if (iconEl)  iconEl.textContent  = getItemIconFromProduct(product);
  if (nameEl)  nameEl.textContent  = product.name;
  if (descEl)  descEl.textContent  = product.description || "";
  if (priceEl) priceEl.textContent = `R$ ${Number(product.price).toFixed(2).replace('.', ',')}`;
  if (qtyEl)   qtyEl.textContent   = modalQuantity;
  if (obsInput) obsInput.value = "";

  // Limpa checkboxes dos adicionais/ingredientes
  document.querySelectorAll(".extra-checkbox").forEach(cb => cb.checked = false);
  document.querySelectorAll(".remove-checkbox").forEach(cb => cb.checked = false);

  updateModalPrice();

  // Mostra o modal
  const modal = document.getElementById("confirmation-modal");
  if (modal) modal.classList.remove("hidden");
}

function updateModalPrice() {
  if (!pendingItem) return;

  const basePrice   = Number(pendingItem.price) || 0;
  const extrasPrice = modalExtras.reduce((sum, extra) => sum + extra.price, 0);
  const totalPrice  = (basePrice + extrasPrice) * modalQuantity;

  const totalEl = document.getElementById("modal-total-price");
  if (totalEl) {
    totalEl.textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
  }
}
// =====================
// ENDEREÇOS
// =====================

// Salva o novo endereço digitado no card "📍 Novo Endereço"
function handleSaveAddress() {
    const form = document.getElementById("new-address-form");
    if (!form) return;

    // Pega o primeiro input e o primeiro textarea dentro do formulário
    const nameInput = form.querySelector("input");
    const detailsInput = form.querySelector("textarea");

    const name = nameInput?.value.trim() || "";
    const details = detailsInput?.value.trim() || "";

    if (!details) {
        showMessage("Preencha o endereço completo para salvar.", "error");
        return;
    }

    const fullAddress = name ? `${name} - ${details}` : details;

    // Atualiza a lista de endereços (por enquanto apenas um)
    const list = document.getElementById("addresses-list");
    if (list) {
        list.innerHTML = `
            <label class="flex items-center space-x-2">
                <input type="radio" name="selected-address" value="${fullAddress}" checked class="text-green-600">
                <span class="text-sm text-gray-800">${fullAddress}</span>
            </label>
        `;
    }

    // Preenche o campo usado pelo placeOrder (fallback)
    const customerAddressInput = document.getElementById("customer-address");
    if (customerAddressInput) {
        customerAddressInput.value = fullAddress;
    }

    // Esconde o formulário de novo endereço
    form.classList.add("hidden");

    showMessage("Endereço salvo.", "success");
}
// =====================
// PEDIDOS (CLIENTE)
// =====================

// Finalizar pedido (cliente)
async function placeOrder() {
    if (!cart.length) {
        showMessage("Adicione itens ao carrinho primeiro.", "error");
        return;
    }

    if (!currentUser) {
        showLoginModal();
        showMessage("Faça login para finalizar o pedido.", "error");
        return;
    }

    const deliveryType =
        document.querySelector('input[name="delivery-type"]:checked')?.value ||
        "delivery";

    let deliveryAddress = "";

      if (deliveryType === "delivery") {
        // 1º: tenta pegar um endereço selecionado na lista
        const selectedRadio = document.querySelector('input[name="selected-address"]:checked');
        if (selectedRadio) {
            deliveryAddress = selectedRadio.value.trim();
        } else {
            // 2º: fallback para o campo de texto direto
            const addrInput = document.getElementById("customer-address");
            deliveryAddress = addrInput?.value.trim() || "";
        }

        if (!deliveryAddress) {
            showMessage(
                "Preencha o endereço para entrega ou selecione retirada.",
                "error"
            );
            return;
        }
    } else {
        deliveryAddress = "Retirada no balcão";
    }

    // Usa o ID REAL do produto vindo da API
    const items = cart.map((c) => ({
        productId: c.originalId || c.id, // originalId se existir, senão id
        productName: c.name,
        quantity: c.quantity,
        unitPrice: c.price
    }));

    const button = document.getElementById("place-order");
    const originalText = button ? button.textContent : "";
    if (button) {
        button.textContent = "Enviando...";
        button.disabled = true;
    }

     try {
        // Debug: ver o usuário que está sendo enviado
        console.log("🚚 Enviando pedido para usuário:", currentUser);

        const userId = Number(currentUser?.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            showMessage(
                "Usuário inválido para criar pedido. Faça login novamente.",
                "error"
            );
            logout();
            showLoginModal();
            return;
        }

        const body = {
            userId,
            deliveryAddress,
            items
        };

        await apiRequest("/orders", {
            method: "POST",
            body: JSON.stringify(body)
        });

        cart = [];
        renderCartSidebar();
        renderCartPage();
        updateCartCount();
        showMessage("Pedido realizado com sucesso! 🎉", "success");

        await loadOrdersFromApi();
        showSection("orders");
    } catch (err) {
        console.error(err);
        showMessage("Erro ao enviar pedido. Tente novamente.", "error");
    } finally {
        if (button) {
            button.textContent = originalText || "Finalizar Pedido";
            button.disabled = false;
        }
    }
}

// Carregar pedidos do usuário logado
async function loadOrdersFromApi() {
    if (!currentUser) {
        orders = [];
        renderOrders();
        return;
    }

    try {
        const allOrders = await apiRequest("/orders");
        orders = allOrders.filter((o) => o.userId === currentUser.id);
        renderOrders();
    } catch (err) {
        console.error(err);
        showMessage("Não foi possível carregar seus pedidos.", "error");
    }
}

function renderOrders() {
    const container = document.getElementById("orders-list");
    if (!container) return;

    if (!orders.length) {
        container.innerHTML =
            '<p class="text-gray-500 text-center py-8">Você ainda não fez nenhum pedido</p>';
        return;
    }

    container.innerHTML = orders
        .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((order) => {
            const date = new Date(order.createdAt);
            const itemsText = (order.items || [])
                .map((i) => `${i.quantity}x ${i.productName}`)
                .join(", ");
            return `
        <div class="bg-white rounded-xl shadow p-4 border border-gray-100">
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="text-sm text-gray-500">Pedido #${order.id}</p>
                    <p class="text-xs text-gray-400">${date.toLocaleString(
                        "pt-BR"
                    )}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    ${order.status}
                </span>
            </div>
            <p class="text-sm text-gray-700 mb-1">
                Itens: <span class="text-gray-900">${itemsText || "—"}</span>
            </p>
            <p class="text-sm text-gray-700">
                Total: <span class="font-bold text-green-600">${formatMoney(
                    order.total
                )}</span>
            </p>
        </div>`;
        })
        .join("");
}

// =====================
// EVENTOS
// =====================

function setupEventListeners() {
    // Navegação topo
    document.getElementById("menu-btn")?.addEventListener("click", () =>
        showSection("menu")
    );
    document.getElementById("cart-btn")?.addEventListener("click", () => {
        showSection("cart");
        renderCartPage();
    });
    document.getElementById("orders-btn")?.addEventListener("click", () => {
        showSection("orders");
        renderOrders();
    });
    document.getElementById("profile-btn")?.addEventListener("click", () => {
        showSection("profile");
    });

    // Filtros
    document
        .getElementById("filter-all")
        ?.addEventListener("click", () => setFilter("all"));
    document
        .getElementById("filter-burgers")
        ?.addEventListener("click", () => setFilter("burgers"));
    document
        .getElementById("filter-sides")
        ?.addEventListener("click", () => setFilter("sides"));
    document
        .getElementById("filter-drinks")
        ?.addEventListener("click", () => setFilter("drinks"));

    // Botão principal de finalizar pedido
    document.getElementById("place-order")?.addEventListener("click", placeOrder);

    // Login / cadastro
    document
        .getElementById("login-tab")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            showLoginForm();
        });
    document
        .getElementById("register-tab")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    document
        .getElementById("login-submit")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            login();
        });
    document
        .getElementById("register-submit")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            register();
        });
    document
        .getElementById("login-modal-close")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            hideLoginModal();
        });
    document
        .getElementById("back-to-login-btn")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            showLoginForm();
        });

    // Abrir modal de login pelo perfil / checkout
    document
        .getElementById("profile-open-login")
        ?.addEventListener("click", (e) => {
            e.preventDefault();
            showLoginModal();
        });

    // Logout
    document.getElementById("logout-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });

    // Salvar perfil
    document.getElementById("save-profile")?.addEventListener("click", (e) => {
        e.preventDefault();
        saveProfile();
    });

    // Fechar modal de login ao clicar no fundo
    document.getElementById("login-modal")?.addEventListener("click", (e) => {
        if (e.target.id === "login-modal") hideLoginModal();
    });

    // Quando mudar tipo de entrega, atualizar resumo
    document
        .querySelectorAll('input[name="delivery-type"]')
        .forEach((radio) => {
            radio.addEventListener("change", () => {
                renderCartPage();
                renderCartSidebar();
            });
        });
// Salvar novo endereço
    document.getElementById("save-address-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        handleSaveAddress();
    });

    // Cancelar novo endereço
    document.getElementById("cancel-address-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        const form = document.getElementById("new-address-form");
        if (form) form.classList.add("hidden");
    });
}

// =====================
// INICIALIZAÇÃO (MODAL DE CUSTOMIZAÇÃO)
// =====================

// Adicionais
document.querySelectorAll(".extra-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
        const extraName = e.target.dataset.name;
        const extraPrice = parseFloat(e.target.dataset.price || "0");

        if (e.target.checked) {
            modalExtras.push({ name: extraName, price: extraPrice });
        } else {
            modalExtras = modalExtras.filter((extra) => extra.name !== extraName);
        }

        updateModalPrice();
    });
});

// Ingredientes removidos
document.querySelectorAll(".remove-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
        const ingredientName = e.target.dataset.name;

        if (e.target.checked) {
            modalRemovedIngredients.push(ingredientName);
        } else {
            modalRemovedIngredients = modalRemovedIngredients.filter(
                (i) => i !== ingredientName
            );
        }
    });
});

// Observações
const obsInput = document.getElementById("modal-observations");
if (obsInput) {
    obsInput.addEventListener("input", (e) => {
        modalObservations = e.target.value;
    });
}

// Botão cancelar
const modalCancel = document.getElementById("modal-cancel");
if (modalCancel) {
    modalCancel.addEventListener("click", () => {
        const modal = document.getElementById("confirmation-modal");
        if (modal) modal.classList.add("hidden");
        pendingItem = null;
        modalQuantity = 1;
        modalExtras = [];
        modalRemovedIngredients = [];
        modalObservations = "";
    });
}

// Botão confirmar
const modalConfirm = document.getElementById("modal-confirm");
if (modalConfirm) {
    modalConfirm.addEventListener("click", () => {
        if (!pendingItem) return;

        const extrasPrice = modalExtras.reduce((sum, e) => sum + e.price, 0);
        const finalUnitPrice = (Number(pendingItem.price) || 0) + extrasPrice;

        let displayName = pendingItem.name;
        const parts = [];
        if (modalRemovedIngredients.length) {
            parts.push(`Sem: ${modalRemovedIngredients.join(", ")}`);
        }
        if (modalExtras.length) {
            parts.push(`+ ${modalExtras.map((e) => e.name).join(", ")}`);
        }
        if (modalObservations.trim()) {
            parts.push(`Obs: ${modalObservations.trim()}`);
        }
        if (parts.length) {
            displayName += ` (${parts.join(" | ")})`;
        }

        const productForCart = {
            ...pendingItem,
            name: displayName,
            price: finalUnitPrice
        };

        addToCart(productForCart, modalQuantity);

        const modal = document.getElementById("confirmation-modal");
        if (modal) modal.classList.add("hidden");
        pendingItem = null;
        modalQuantity = 1;
        modalExtras = [];
        modalRemovedIngredients = [];
        modalObservations = "";
    });
}

// =====================
// BOOTSTRAP
// =====================

document.addEventListener("DOMContentLoaded", async () => {
    try {
        restoreUserFromStorage();
        setupEventListeners();

       // Listener global para o botão "+ Novo endereço"
document.addEventListener("click", (e) => {
    // aceita tanto #add-address-btn (HTML atual) quanto #new-address-btn (caso mude no futuro)
    const btn = e.target.closest("#add-address-btn, #new-address-btn");
    if (!btn) return; // clique não foi no botão

    e.preventDefault();

    // Mostra o formulário de novo endereço, se existir
    const form = document.getElementById("new-address-form");
    if (form) {
        form.classList.remove("hidden");
    }

    // Escolhe o melhor campo para limpar e focar
    const addrInput = document.querySelector(
        "#new-address-details, #new-address-name, #customer-address, #delivery-address, #endereco-entrega"
    );

    if (addrInput) {
        addrInput.value = "";
        addrInput.focus();
        console.log("Novo endereço: campo limpo e focado.");
    } else {
        console.warn("Campo de endereço não encontrado para limpar.");
    }
});

        // Carrega produtos da API
        try {
            products = await apiRequest("/products");
        } catch (err) {
            console.error("Erro ao carregar produtos:", err);
            products = [];
        }

        renderMenu();
        renderCartSidebar();
        updateCartCount();
        updateLoginState();
        await loadOrdersFromApi();

        showSection("menu");
    } catch (err) {
        console.error("Erro na inicialização:", err);
        showMessage("Erro ao inicializar a página do cliente.", "error");
    }
});