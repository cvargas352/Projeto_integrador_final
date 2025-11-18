// ==================== CONFIG PADRÃO ====================
const defaultConfig = {
  restaurant_name: "Burger House Admin",
  admin_email: "admin@burgerhouse.com",
  support_phone: "(11) 99999-9999",
  restaurant_open: true
};

// ==================== ESTADO ====================
let currentSection = 'orders';
let currentProductFilter = 'all';
let orders = [];
let users = [];
let products = [];
let editingProduct = null;
let orderSearchTerm = '';
let orderStatusFilter = '';
let currentOrderForPrint = null;

// 👉 Estado local estável para o toggle (FIX)
let restaurantIsOpen = defaultConfig.restaurant_open;

// ==================== STATUS DOS PEDIDOS ====================
const orderStatuses = {
  'Cozinha': { column: 'new', icon: '👨‍🍳', color: 'bg-yellow-100 text-yellow-800' },
  'Aguardando entrega': { column: 'preparing', icon: '⏳', color: 'bg-blue-100 text-blue-800' },
  'Saiu para entrega': { column: 'ready', icon: '🚚', color: 'bg-orange-100 text-orange-800' },
  'Entregue': { column: 'delivered', icon: '✅', color: 'bg-green-100 text-green-800' },
  'Cancelados': { column: 'cancelled', icon: '❌', color: 'bg-red-100 text-red-800' }
};

// ==================== DATA SDK HANDLER ====================
const dataHandler = {
  onDataChanged(data) {
    if (!data) return;

    orders = data.filter(item => item.type === 'order') || [];
    users = data.filter(item => item.type === 'user') || [];
    products = data.filter(item => item.type === 'product') || [];

    renderKanbanBoard();
    renderProducts();
    renderCustomers();
    updateAnalytics();
  }
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async function () {
  // Inicializar Data SDK
  if (window.dataSdk) {
    const initResult = await window.dataSdk.init(dataHandler);
    if (!initResult.isOk) console.error('Erro ao inicializar Data SDK');
  }

  // Inicializar Element SDK
  if (window.elementSdk) {
    await window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => {
        document.getElementById('restaurant-name').textContent =
          config.restaurant_name || defaultConfig.restaurant_name;
        document.getElementById('dropdown-user-email').textContent =
          config.admin_email || defaultConfig.admin_email;

        // Se o painel alterar o status, reflete no estado local e no UI
        if (typeof config.restaurant_open === 'boolean') {
          restaurantIsOpen = config.restaurant_open;
          updateRestaurantStatusDisplay(restaurantIsOpen);
        }
      },
      mapToCapabilities: (config) => ({
        recolorables: [
          {
            get: () => config.primary_color || "#dc2626",
            set: (value) => {
              config.primary_color = value;
              window.elementSdk.setConfig({ primary_color: value });
            }
          }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) => new Map([
        ["restaurant_name", config.restaurant_name || defaultConfig.restaurant_name],
        ["admin_email", config.admin_email || defaultConfig.admin_email],
        ["support_phone", config.support_phone || defaultConfig.support_phone]
      ])
    });

    // Tenta ler o status inicial do SDK após init; se não vier, mantém o default
    if (window.elementSdk.config && typeof window.elementSdk.config.restaurant_open === 'boolean') {
      restaurantIsOpen = window.elementSdk.config.restaurant_open;
    }
  }

  setupEventListeners();
  createSampleProducts();
  createSampleOrders();

  // Seção padrão e status inicial no UI
  showSection('orders');
  updateRestaurantStatusDisplay(restaurantIsOpen);
});

// ==================== EVENTOS ====================
function setupEventListeners() {
  // Navegação
  document.getElementById('orders-btn').addEventListener('click', () => showSection('orders'));
  document.getElementById('products-btn').addEventListener('click', () => showSection('products'));
  document.getElementById('customers-btn').addEventListener('click', () => showSection('customers'));
  document.getElementById('analytics-btn').addEventListener('click', () => showSection('analytics'));

  // Menu de usuário
  document.getElementById('user-menu-btn').addEventListener('click', () => {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    showMessage('👋 Logout realizado com sucesso! Até logo!', 'success');
    setTimeout(() => { showMessage('Sessão encerrada.', 'success'); }, 1500);
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (!userMenu.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Produtos
  document.getElementById('add-product-btn').addEventListener('click', () => showProductModal());
  document.getElementById('product-modal-cancel').addEventListener('click', hideProductModal);
  document.getElementById('product-modal-save').addEventListener('click', saveProduct);

  // Filtros de produtos
  document.getElementById('filter-all-products').addEventListener('click', () => setProductFilter('all'));
  document.getElementById('filter-burgers-products').addEventListener('click', () => setProductFilter('burger'));
  document.getElementById('filter-sides-products').addEventListener('click', () => setProductFilter('side'));
  document.getElementById('filter-drinks-products').addEventListener('click', () => setProductFilter('drink'));

  // Busca de clientes
  document.getElementById('customer-search').addEventListener('input', (e) => {
    renderCustomers(e.target.value);
  });

  // Busca de pedidos
  document.getElementById('order-search').addEventListener('input', (e) => {
    orderSearchTerm = e.target.value.toLowerCase();
    renderKanbanBoard();
  });

  // Filtro de status
  document.getElementById('status-filter').addEventListener('change', (e) => {
    orderStatusFilter = e.target.value;
    renderKanbanBoard();
  });

  // Limpar pesquisa
  document.getElementById('clear-search').addEventListener('click', () => {
    document.getElementById('order-search').value = '';
    document.getElementById('status-filter').value = '';
    orderSearchTerm = '';
    orderStatusFilter = '';
    renderKanbanBoard();
  });

  // Exportar clientes
  document.getElementById('export-customers-btn').addEventListener('click', exportCustomers);

  // Modal detalhes do pedido
  document.getElementById('order-details-close').addEventListener('click', () => {
    document.getElementById('order-details-modal').classList.add('hidden');
  });

  // Botão de impressão
  document.getElementById('print-order-btn').addEventListener('click', printCurrentOrder);

  // Fechar modais clicando no fundo
  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target.id === 'product-modal') hideProductModal();
  });
  document.getElementById('order-details-modal').addEventListener('click', (e) => {
    if (e.target.id === 'order-details-modal') {
      document.getElementById('order-details-modal').classList.add('hidden');
    }
  });
}

// ==================== NAVEGAÇÃO ====================
function showSection(section) {
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`${section}-section`).classList.remove('hidden');
  currentSection = section;

  // Atualiza botões
  document.querySelectorAll('header button').forEach(btn => {
    if (btn.id !== 'user-menu-btn') {
      btn.classList.remove('bg-red-700');
      btn.classList.add('text-white', 'hover:text-red-200');
    }
  });

  const activeBtn = document.getElementById(`${section}-btn`);
  if (activeBtn) {
    activeBtn.classList.add('bg-red-700');
    activeBtn.classList.remove('text-white', 'hover:text-red-200');
  }
}

// ==================== KANBAN ====================
function renderKanbanBoard() {
  const columns = {
    new: document.getElementById('new-orders'),
    preparing: document.getElementById('preparing-orders'),
    ready: document.getElementById('ready-orders'),
    delivered: document.getElementById('delivered-orders'),
    cancelled: document.getElementById('cancelled-orders')
  };

  const counts = { new: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 };

  // Limpar colunas
  Object.values(columns).forEach(column => { column.innerHTML = ''; });

  // Filtrar
  let filteredOrders = orders;

  if (orderSearchTerm) {
    filteredOrders = filteredOrders.filter(order => {
      const searchableText = [
        order.id.slice(-6),
        order.customer_name,
        order.customer_phone,
        order.status,
        order.customer_address || ''
      ].join(' ').toLowerCase();
      return searchableText.includes(orderSearchTerm);
    });
  }

  if (orderStatusFilter) {
    filteredOrders = filteredOrders.filter(order => order.status === orderStatusFilter);
  }

  // Agrupar e renderizar
  filteredOrders.forEach(order => {
    const statusInfo = orderStatuses[order.status];
    if (statusInfo && columns[statusInfo.column]) {
      counts[statusInfo.column]++;
      const orderCard = createOrderCard(order);
      columns[statusInfo.column].appendChild(orderCard);
    }
  });

  if (filteredOrders.length === 0 && (orderSearchTerm || orderStatusFilter)) {
    const noResultsMessage = document.createElement('div');
    noResultsMessage.className = 'col-span-4 text-center py-8 text-gray-500';
    noResultsMessage.innerHTML = `
      <div class="text-4xl mb-2">🔍</div>
      <p class="text-lg font-semibold">Nenhum pedido encontrado</p>
      <p class="text-sm">Tente ajustar os filtros de pesquisa</p>
    `;
    columns.new.appendChild(noResultsMessage);
  }

  document.getElementById('new-orders-count').textContent = counts.new;
  document.getElementById('preparing-orders-count').textContent = counts.preparing;
  document.getElementById('ready-orders-count').textContent = counts.ready;
  document.getElementById('delivered-orders-count').textContent = counts.delivered;
  document.getElementById('cancelled-orders-count').textContent = counts.cancelled;
  document.getElementById('pending-orders-count').textContent = counts.new + counts.preparing + counts.ready;

  updateHeaderMetrics();
}

function createOrderCard(order) {
  const date = new Date(order.created_at);
  const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const card = document.createElement('div');
  card.className = 'order-card bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow fade-in cursor-pointer';

  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    showOrderDetails(order);
  });

  card.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-bold text-lg text-gray-800">#${order.id.slice(-6)}</h4>
          <p class="text-sm text-gray-600">${order.customer_name}</p>
        </div>
        <span class="text-lg font-bold text-green-600">R$ ${order.total.toFixed(2).replace('.', ',')}</span>
      </div>

      <div class="flex items-center space-x-2">
        ${order.delivery_type === 'delivery'
          ? '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-semibold">🚚 Entrega</span>'
          : '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold">🏪 Retirada</span>'
        }
      </div>

      <div class="text-sm text-gray-500">
        <p>${dateString} às ${timeString}</p>
      </div>

      <div class="text-xs text-gray-400 text-center">👆 Clique para ver detalhes</div>

      <div class="pt-2 border-t border-gray-100">
        ${getOrderActionButtons(order)}
      </div>
    </div>
  `;

  return card;
}

function getOrderActionButtons(order) {
  const status = order.status;

  if (status === 'Cozinha') {
    return `
      <div class="flex space-x-2">
        <button onclick="updateOrderStatus('${order.id}', 'Aguardando entrega')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded-lg font-medium transition-colors">⏳ Pronto</button>
        <button onclick="updateOrderStatus('${order.id}', 'Cancelados')" class="bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-lg font-medium transition-colors">❌</button>
      </div>
    `;
  } else if (status === 'Aguardando entrega') {
    return `
      <div class="flex space-x-2">
        <button onclick="updateOrderStatus('${order.id}', 'Saiu para entrega')" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm py-2 px-3 rounded-lg font-medium transition-colors">🚚 Enviar</button>
        <button onclick="updateOrderStatus('${order.id}', 'Cancelados')" class="bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-lg font-medium transition-colors">❌</button>
      </div>
    `;
  } else if (status === 'Saiu para entrega') {
    return `
      <button onclick="updateOrderStatus('${order.id}', 'Entregue')" class="w-full bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded-lg font-medium transition-colors">✅ Entregar</button>
    `;
  }

  return '<p class="text-sm text-gray-500 text-center py-2">Pedido finalizado</p>';
}

// ==================== ATUALIZA STATUS PEDIDO ====================
async function updateOrderStatus(orderId, newStatus) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  order.status = newStatus;

  if (window.dataSdk) {
    const result = await window.dataSdk.update(order);
    if (result.isOk) {
      showMessage(`Pedido #${orderId.slice(-6)} atualizado para: ${newStatus}`, 'success');
    } else {
      showMessage('Erro ao atualizar pedido', 'error');
    }
  }
}

// ==================== DETALHES DO PEDIDO ====================
function showOrderDetails(order) {
  currentOrderForPrint = order;
  const items = JSON.parse(order.items);
  const date = new Date(order.created_at).toLocaleString('pt-BR');

  const content = `
    <div class="space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="text-xl font-bold">Pedido #${order.id.slice(-6)}</h4>
          <p class="text-gray-600">${date}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-semibold ${orderStatuses[order.status]?.color || 'bg-gray-100 text-gray-800'}">
          ${order.status}
        </span>
      </div>

      <div class="border-t pt-4">
        <h5 class="font-semibold mb-2">👤 Cliente</h5>
        <p><strong>Nome:</strong> ${order.customer_name}</p>
        <p><strong>Telefone:</strong> ${order.customer_phone}</p>
        <p><strong>Entrega:</strong> ${order.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Retirada'}</p>
        ${order.delivery_type === 'delivery' ? `<p><strong>Endereço:</strong> ${order.customer_address}</p>` : ''}
      </div>

      <div class="border-t pt-4">
        <h5 class="font-semibold mb-3">🍔 Itens do Pedido</h5>
        <div class="space-y-2">
          ${items.map(item => `
            <div class="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
              <div class="flex-1">
                <p class="font-medium">${item.name}</p>
                ${item.extras && item.extras.length > 0 ? `<p class="text-xs text-green-600">+ ${item.extras.map(e => e.name).join(', ')}</p>` : ''}
                ${item.removedIngredients && item.removedIngredients.length > 0 ? `<p class="text-xs text-red-600">Sem: ${item.removedIngredients.join(', ')}</p>` : ''}
                ${item.observations && item.observations.trim() ? `<p class="text-xs text-blue-600">Obs: ${item.observations}</p>` : ''}
                <p class="text-sm text-gray-600">${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')}</p>
              </div>
              <p class="font-semibold text-green-600">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="border-t pt-4">
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>Subtotal:</span>
            <span>R$ ${(order.total - order.delivery_fee).toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="flex justify-between">
            <span>Taxa de entrega:</span>
            <span>R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span class="text-green-600">R$ ${order.total.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </div>

      ${order.status !== 'Entregue' ? `
        <div class="border-t pt-4">
          <h5 class="font-semibold mb-3">⚡ Ações Rápidas</h5>
          <div class="space-y-2">
            ${getDetailedOrderActions(order)}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('order-details-content').innerHTML = content;
  document.getElementById('order-details-modal').classList.remove('hidden');
}

function getDetailedOrderActions(order) {
  const status = order.status;
  let actions = '';

  if (status === 'Cozinha') {
    actions = `
      <button onclick="updateOrderStatus('${order.id}', 'Aguardando entrega'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold mb-2">⏳ Marcar como Pronto</button>
      <button onclick="updateOrderStatus('${order.id}', 'Cancelados'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold">❌ Cancelar Pedido</button>
    `;
  } else if (status === 'Aguardando entrega') {
    actions = `
      <button onclick="updateOrderStatus('${order.id}', 'Saiu para entrega'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-semibold mb-2">🚚 Enviar para Entrega</button>
      <button onclick="updateOrderStatus('${order.id}', 'Cancelados'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-semibold">❌ Cancelar Pedido</button>
    `;
  } else if (status === 'Saiu para entrega') {
    actions = `<button onclick="updateOrderStatus('${order.id}', 'Entregue'); document.getElementById('order-details-modal').classList.add('hidden');" class="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold">✅ Marcar como Entregue</button>`;
  }

  return actions;
}

// ==================== HEADER METRICS ====================
function updateHeaderMetrics() {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(order => new Date(order.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);

  document.getElementById('total-orders-today').textContent = todayOrders.length;
  document.getElementById('revenue-today').textContent = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
}

// ==================== DADOS EXEMPLO ====================
async function createSampleProducts() {
  if (products.length > 0) return;

  const sampleProducts = [
    { name: 'Burger Clássico', category: 'burger', price: 18.90, description: 'Hambúrguer, queijo, alface, tomate e molho especial', available: true, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop' },
    { name: 'Burger Bacon', category: 'burger', price: 22.90, description: 'Hambúrguer, bacon, queijo, cebola caramelizada', available: true, image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&h=300&fit=crop' },
    { name: 'Batata Frita', category: 'side', price: 8.90, description: 'Porção individual de batatas fritas crocantes', available: true, image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=300&fit=crop' },
    { name: 'Coca-Cola', category: 'drink', price: 5.90, description: 'Refrigerante 350ml gelado', available: true, image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&h=300&fit=crop' }
  ];

  for (const product of sampleProducts) {
    const newProduct = {
      type: 'product',
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...product,
      created_at: new Date().toISOString()
    };

    if (window.dataSdk) await window.dataSdk.create(newProduct);
  }
}

async function createSampleOrders() {
  if (orders.length > 0) return;

  const sampleOrders = [
    {
      type: 'order',
      id: 'ORD' + Date.now().toString() + '001',
      user_id: 'user_001',
      customer_name: 'João Silva',
      customer_phone: '(11) 99999-1234',
      customer_address: 'Rua das Flores, 123 - Vila Madalena',
      delivery_type: 'delivery',
      delivery_fee: 5.00,
      status: 'Cozinha',
      total: 32.80,
      items: JSON.stringify([
        { name: 'Burger Clássico', price: 18.90, quantity: 1 },
        { name: 'Batata Frita', price: 8.90, quantity: 1 },
        { name: 'Coca-Cola', price: 5.90, quantity: 1 }
      ]),
      created_at: new Date().toISOString()
    },
    {
      type: 'order',
      id: 'ORD' + Date.now().toString() + '002',
      user_id: 'user_002',
      customer_name: 'Maria Santos',
      customer_phone: '(11) 98888-5678',
      customer_address: '',
      delivery_type: 'pickup',
      delivery_fee: 0.00,
      status: 'Aguardando entrega',
      total: 22.90,
      items: JSON.stringify([{ name: 'Burger Bacon', price: 22.90, quantity: 1 }]),
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      type: 'order',
      id: 'ORD' + Date.now().toString() + '003',
      user_id: 'user_003',
      customer_name: 'Pedro Costa',
      customer_phone: '(11) 97777-9012',
      customer_address: 'Av. Paulista, 1000 - Bela Vista',
      delivery_type: 'delivery',
      delivery_fee: 7.00,
      status: 'Saiu para entrega',
      total: 54.70,
      items: JSON.stringify([
        { name: 'Burger Clássico', price: 18.90, quantity: 2 },
        { name: 'Batata Frita', price: 8.90, quantity: 1 },
        { name: 'Coca-Cola', price: 5.90, quantity: 2 }
      ]),
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ];

  for (const order of sampleOrders) {
    if (window.dataSdk) await window.dataSdk.create(order);
  }
}

// ==================== PRODUTOS ====================
function renderProducts() {
  const productsList = document.getElementById('products-list');
  let filteredProducts = products;

  if (currentProductFilter !== 'all') {
    filteredProducts = products.filter(p => p.category === currentProductFilter);
  }

  if (filteredProducts.length === 0) {
    productsList.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhum produto encontrado</p>';
    return;
  }

  productsList.innerHTML = filteredProducts.map(product => `
    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div class="flex items-center space-x-4">
        <div class="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          ${product.image_url
            ? `<img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover"
                 onerror="this.src=''; this.alt='Imagem não disponível'; this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-3xl\\'>${getCategoryIcon(product.category)}</div>';">`
            : `<div class="w-full h-full flex items-center justify-center text-3xl">${getCategoryIcon(product.category)}</div>`
          }
        </div>
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <h4 class="font-bold text-lg text-gray-800">${product.name}</h4>
            ${!product.available ? '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Indisponível</span>' : ''}
          </div>
          <p class="text-gray-600 text-sm">${product.description}</p>
          <div class="flex items-center space-x-4 mt-1">
            <span class="text-xl font-bold text-green-600">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
            <span class="text-sm text-gray-500">${getCategoryName(product.category)}</span>
          </div>
        </div>
      </div>

      <div class="flex space-x-2">
        <button onclick="editProduct('${product.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">✏️ Editar</button>
        <button onclick="toggleProductAvailability('${product.id}')" class="bg-${product.available ? 'orange' : 'green'}-600 hover:bg-${product.available ? 'orange' : 'green'}-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
          ${product.available ? '⏸️ Desativar' : '✅ Ativar'}
        </button>
        <button onclick="confirmDeleteProduct('${product.id}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">🗑️ Excluir</button>
      </div>
    </div>
  `).join('');
}

function getCategoryIcon(category) {
  const icons = { burger: '🍔', side: '🍟', drink: '🥤' };
  return icons[category] || '🍽️';
}

function getCategoryName(category) {
  const names = { burger: 'Hambúrguer', side: 'Acompanhamento', drink: 'Bebida' };
  return names[category] || 'Produto';
}

function setProductFilter(filter) {
  currentProductFilter = filter;

  document.querySelectorAll('.product-filter-btn').forEach(btn => {
    btn.classList.remove('bg-red-600', 'text-white');
    btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
  });

  const activeBtn = filter === 'all'
    ? document.getElementById('filter-all-products')
    : document.getElementById(`filter-${filter}s-products`);

  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
    activeBtn.classList.add('bg-red-600', 'text-white');
  }

  renderProducts();
}

function showProductModal(productId = null) {
  editingProduct = productId;

  if (productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
      document.getElementById('product-modal-title').textContent = '✏️ Editar Produto';
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-category').value = product.category;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-description').value = product.description;
      document.getElementById('product-image').value = product.image_url || '';
      document.getElementById('product-available').checked = product.available;
    }
  } else {
    document.getElementById('product-modal-title').textContent = '➕ Novo Produto';
    document.getElementById('product-form').reset();
    document.getElementById('product-available').checked = true;
  }

  document.getElementById('product-modal').classList.remove('hidden');
}

function hideProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
  editingProduct = null;
}

async function saveProduct() {
  const name = document.getElementById('product-name').value.trim();
  const category = document.getElementById('product-category').value;
  const price = parseFloat(document.getElementById('product-price').value);
  const description = document.getElementById('product-description').value.trim();
  const imageUrl = document.getElementById('product-image').value.trim();
  const available = document.getElementById('product-available').checked;

  if (!name || !category || !price || !description) {
    showMessage('Por favor, preencha todos os campos obrigatórios', 'error');
    return;
  }

  const button = document.getElementById('product-modal-save');
  const originalText = button.textContent;
  button.textContent = 'Salvando...';
  button.disabled = true;

  try {
    if (editingProduct) {
      const product = products.find(p => p.id === editingProduct);
      if (product) {
        product.name = name;
        product.category = category;
        product.price = price;
        product.description = description;
        product.image_url = imageUrl;
        product.available = available;

        if (window.dataSdk) {
          const result = await window.dataSdk.update(product);
          if (result.isOk) {
            showMessage('Produto atualizado com sucesso! ✅', 'success');
            hideProductModal();
          } else {
            showMessage('Erro ao atualizar produto', 'error');
          }
        }
      }
    } else {
      const newProduct = {
        type: 'product',
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name,
        category,
        price,
        description,
        image_url: imageUrl,
        available,
        created_at: new Date().toISOString()
      };

      if (window.dataSdk) {
        const result = await window.dataSdk.create(newProduct);
        if (result.isOk) {
          showMessage('Produto criado com sucesso! 🎉', 'success');
          hideProductModal();
        } else {
          showMessage('Erro ao criar produto', 'error');
        }
      }
    }
  } catch (error) {
    showMessage('Erro ao salvar produto', 'error');
  }

  button.textContent = originalText;
  button.disabled = false;
}

function editProduct(productId) {
  showProductModal(productId);
}

async function toggleProductAvailability(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  product.available = !product.available;

  if (window.dataSdk) {
    const result = await window.dataSdk.update(product);
    if (result.isOk) {
      showMessage(`Produto ${product.available ? 'ativado' : 'desativado'} com sucesso!`, 'success');
    } else {
      showMessage('Erro ao atualizar produto', 'error');
    }
  }
}

function confirmDeleteProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const confirmModal = document.createElement('div');
  confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  confirmModal.innerHTML = `
    <div class="bg-white rounded-xl p-6 max-w-md mx-4 w-full">
      <h3 class="text-2xl font-bold text-gray-800 mb-4">🗑️ Excluir Produto</h3>
      <p class="text-gray-600 mb-6">Tem certeza que deseja excluir o produto <strong>"${product.name}"</strong>? Esta ação não pode ser desfeita.</p>
      <div class="flex space-x-4">
        <button id="cancel-delete" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors">Cancelar</button>
        <button id="confirm-delete" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors">Sim, Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmModal);

  document.getElementById('cancel-delete').addEventListener('click', () => {
    confirmModal.remove();
  });

  document.getElementById('confirm-delete').addEventListener('click', async () => {
    confirmModal.remove();
    await deleteProduct(productId);
  });

  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) confirmModal.remove();
  });
}

async function deleteProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (window.dataSdk) {
    const result = await window.dataSdk.delete(product);
    if (result.isOk) {
      showMessage('Produto excluído com sucesso! 🗑️', 'success');
    } else {
      showMessage('Erro ao excluir produto', 'error');
    }
  }
}

// ==================== CLIENTES ====================
function renderCustomers(searchTerm = '') {
  const tableBody = document.getElementById('customers-table-body');

  let filteredUsers = users;
  if (searchTerm) {
    filteredUsers = users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone || '').includes(searchTerm)
    );
  }

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Nenhum cliente encontrado</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredUsers.map(user => {
    const userOrders = orders.filter(order => order.user_id === user.id);
    const totalSpent = userOrders.reduce((sum, order) => sum + order.total, 0);
    const lastOrder = userOrders.length > 0
      ? new Date(Math.max(...userOrders.map(o => new Date(o.created_at)))).toLocaleDateString('pt-BR')
      : 'Nunca';

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-4 px-4">
          <div>
            <p class="font-semibold text-gray-800">${user.name}</p>
            <p class="text-sm text-gray-600">${user.email}</p>
          </div>
        </td>
        <td class="py-4 px-4"><p class="text-gray-800">${user.phone || ''}</p></td>
        <td class="py-4 px-4"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-semibold">${userOrders.length}</span></td>
        <td class="py-4 px-4"><span class="font-semibold text-green-600">R$ ${totalSpent.toFixed(2).replace('.', ',')}</span></td>
        <td class="py-4 px-4"><span class="text-gray-600">${lastOrder}</span></td>
        <td class="py-4 px-4">
          <button onclick="viewCustomerDetails('${user.id}')" class="text-blue-600 hover:text-blue-700 font-medium">👁️ Ver Detalhes</button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewCustomerDetails(userId) {
  const user = users.find(u => u.id === userId);
  const userOrders = orders.filter(order => order.user_id === userId);
  if (!user) return;

  const totalSpent = userOrders.reduce((sum, order) => sum + order.total, 0);
  const avgOrderValue = userOrders.length > 0 ? totalSpent / userOrders.length : 0;

  showMessage(`
Cliente: ${user.name}
E-mail: ${user.email}
Telefone: ${user.phone}
Total de Pedidos: ${userOrders.length}
Total Gasto: R$ ${totalSpent.toFixed(2).replace('.', ',')}
Ticket Médio: R$ ${avgOrderValue.toFixed(2).replace('.', ',')}
  `, 'success');
}

function exportCustomers() {
  const csvContent = "data:text/csv;charset=utf-8," +
    "Nome,Email,Telefone,Pedidos,Total Gasto,Último Pedido\n" +
    users.map(user => {
      const userOrders = orders.filter(order => order.user_id === user.id);
      const totalSpent = userOrders.reduce((sum, order) => sum + order.total, 0);
      const lastOrder = userOrders.length > 0
        ? new Date(Math.max(...userOrders.map(o => new Date(o.created_at)))).toLocaleDateString('pt-BR')
        : 'Nunca';

      return `"${user.name}","${user.email}","${user.phone}",${userOrders.length},"R$ ${totalSpent.toFixed(2).replace('.', ',')}","${lastOrder}"`;
    }).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `clientes_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showMessage('Lista de clientes exportada com sucesso! 📊', 'success');
}

// ==================== ANALÍTICOS ====================
function updateAnalytics() {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(order => new Date(order.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const avgTicket = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;
  const activeCustomers = new Set(orders.map(order => order.user_id)).size;

  document.getElementById('analytics-orders-today').textContent = todayOrders.length;
  document.getElementById('analytics-revenue-today').textContent = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
  document.getElementById('analytics-avg-ticket').textContent = `R$ ${avgTicket.toFixed(2).replace('.', ',')}`;
  document.getElementById('analytics-active-customers').textContent = activeCustomers;

  updateTopProducts();
  updatePeakHours();
}

function updateTopProducts() {
  const productSales = {};

  orders.forEach(order => {
    const items = JSON.parse(order.items);
    items.forEach(item => {
      if (!productSales[item.name]) {
        productSales[item.name] = { quantity: 0, revenue: 0 };
      }
      productSales[item.name].quantity += item.quantity;
      productSales[item.name].revenue += item.price * item.quantity;
    });
  });

  const sortedProducts = Object.entries(productSales)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5);

  const topProductsContainer = document.getElementById('top-products');

  if (sortedProducts.length === 0) {
    topProductsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum produto vendido ainda</p>';
    return;
  }

  topProductsContainer.innerHTML = sortedProducts.map((product, index) => `
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center space-x-3">
        <span class="text-2xl font-bold text-gray-400">#${index + 1}</span>
        <div>
          <p class="font-semibold text-gray-800">${product[0]}</p>
          <p class="text-sm text-gray-600">${product[1].quantity} vendidos</p>
        </div>
      </div>
      <span class="font-bold text-green-600">R$ ${product[1].revenue.toFixed(2).replace('.', ',')}</span>
    </div>
  `).join('');
}

function updatePeakHours() {
  const hourCounts = {};

  orders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHoursContainer = document.getElementById('peak-hours');
  const hours = ['06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];

  peakHoursContainer.innerHTML = hours.map(hourRange => {
    const [start, end] = hourRange.split('-').map(Number);
    let count = 0;
    for (let h = start; h < end; h++) {
      count += hourCounts[h] || 0;
    }
    return `
      <div class="bg-gray-50 rounded-lg p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">${count}</p>
        <p class="text-sm text-gray-600">${hourRange}h</p>
      </div>
    `;
  }).join('');
}

// ==================== UTILITÁRIOS ====================
function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 max-w-md ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`;
  messageDiv.style.whiteSpace = 'pre-line';
  messageDiv.textContent = message;

  document.body.appendChild(messageDiv);
  setTimeout(() => { messageDiv.remove(); }, 4000);
}

// ==================== STATUS RESTAURANTE (FIX AQUI) ====================
async function toggleRestaurantStatus() {
  // Alterna SEM depender de ler o elementSdk.config no clique
  restaurantIsOpen = !restaurantIsOpen;

  if (window.elementSdk) {
    // Persiste a nova flag no SDK (quando disponível)
    await window.elementSdk.setConfig({ restaurant_open: restaurantIsOpen });
  }

  updateRestaurantStatusDisplay(restaurantIsOpen);

  const statusMessage = restaurantIsOpen
    ? 'Restaurante ABERTO! 🟢 Agora vocês podem receber novos pedidos!'
    : 'Restaurante FECHADO! 🔴 Não receberão novos pedidos até reabrir.';
  showMessage(statusMessage, 'success');
}

function updateRestaurantStatusDisplay(isOpen) {
  const statusBtn = document.getElementById('restaurant-status-btn');
  const statusToggle = document.getElementById('status-toggle');
  const statusText = document.getElementById('status-text');

  if (!statusBtn || !statusToggle || !statusText) return;

  if (isOpen) {
    statusBtn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 bg-green-500';
    statusToggle.className = 'inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6';
    statusText.textContent = 'ABERTO';
    statusText.className = 'ml-3 text-sm font-medium text-green-600';
  } else {
    statusBtn.className = 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 bg-red-500';
    statusToggle.className = 'inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1';
    statusText.textContent = 'FECHADO';
    statusText.className = 'ml-3 text-sm font-medium text-red-600';
  }
}

// ==================== IMPRESSÃO DO PEDIDO ====================
function printCurrentOrder() {
  if (!currentOrderForPrint) return;

  const order = currentOrderForPrint;
  const items = JSON.parse(order.items);
  const date = new Date(order.created_at);
  const dateString = date.toLocaleDateString('pt-BR');
  const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const printContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Pedido #${order.id.slice(-6)} - ${order.customer_name}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; margin: 0; padding: 20px; max-width: 300px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
  .restaurant-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
  .order-info { margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
  .customer-info { margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
  .items { margin-bottom: 15px; }
  .item { margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px dotted #ccc; }
  .item-name { font-weight: bold; }
  .item-details { font-size: 10px; color: #666; margin-top: 2px; }
  .item-price { text-align: right; margin-top: 2px; }
  .totals { border-top: 2px solid #000; padding-top: 10px; margin-top: 15px; }
  .total-line { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .final-total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
  .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
  .status-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; margin-top: 5px; }
  @media print { body { margin: 0; padding: 10px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">🍔 BURGER HOUSE</div>
    <div>Pedido para ${order.delivery_type === 'delivery' ? 'ENTREGA' : 'RETIRADA'}</div>
    <div class="status-badge">${order.status.toUpperCase()}</div>
  </div>

  <div class="order-info">
    <div><strong>Pedido:</strong> #${order.id.slice(-6)}</div>
    <div><strong>Data:</strong> ${dateString}</div>
    <div><strong>Hora:</strong> ${timeString}</div>
  </div>

  <div class="customer-info">
    <div><strong>Cliente:</strong> ${order.customer_name}</div>
    <div><strong>Telefone:</strong> ${order.customer_phone}</div>
    ${order.delivery_type === 'delivery' ? `<div><strong>Endereço:</strong></div><div style="margin-left: 10px;">${order.customer_address}</div>` : ''}
  </div>

  <div class="items">
    <div style="font-weight: bold; margin-bottom: 10px;">ITENS DO PEDIDO:</div>
    ${items.map(item => `
      <div class="item">
        <div class="item-name">${item.quantity}x ${item.name}</div>
        ${item.extras && item.extras.length > 0 ? `<div class="item-details">+ ${item.extras.map(e => e.name).join(', ')}</div>` : ''}
        ${item.removedIngredients && item.removedIngredients.length > 0 ? `<div class="item-details">Sem: ${item.removedIngredients.join(', ')}</div>` : ''}
        ${item.observations && item.observations.trim() ? `<div class="item-details">Obs: ${item.observations}</div>` : ''}
        <div class="item-price">R$ ${item.price.toFixed(2).replace('.', ',')} cada = R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
      </div>
    `).join('')}
  </div>

  <div class="totals">
    <div class="total-line"><span>Subtotal:</span><span>R$ ${(order.total - order.delivery_fee).toFixed(2).replace('.', ',')}</span></div>
    <div class="total-line"><span>Taxa de entrega:</span><span>R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}</span></div>
    <div class="total-line final-total"><span>TOTAL:</span><span>R$ ${order.total.toFixed(2).replace('.', ',')}</span></div>
  </div>

  <div class="footer">
    <div>Obrigado pela preferência!</div>
    <div>🍔 Burger House - Hambúrgueres Artesanais</div>
    <div>Impresso em: ${new Date().toLocaleString('pt-BR')}</div>
  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = function () { printWindow.close(); };
  };

  showMessage('Abrindo janela de impressão... 🖨️', 'success');
}