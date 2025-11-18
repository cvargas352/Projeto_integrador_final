// ===================================
        // CONFIGURAÇÃO INICIAL
        // ===================================
        
        // Configuração padrão do restaurante
        const defaultConfig = {
            restaurant_name: "Burger House",
            tagline: "Os melhores hambúrgueres da cidade",
            delivery_fee: 5.00
        };

        // ===================================
        // VARIÁVEIS DE ESTADO GLOBAIS
        // ===================================
        
        let currentUser = null;              // Usuário logado
        let userAddresses = [];              // Endereços do usuário
        let products = [];                   // Lista de produtos
        let orders = [];                     // Pedidos do usuário
        let cart = [];                       // Carrinho de compras
        let currentFilter = 'all';           // Filtro de categoria ativo
        let currentSection = 'menu';         // Seção atual (menu, orders, account)
        let selectedAddress = null;          // Endereço selecionado no checkout
        let guestOrderData = null;           // Dados do pedido para usuário não logado
        let currentDeliveryFee = 0;          // Taxa de entrega atual
        let currentDeliveryType = 'delivery'; // Tipo de entrega (delivery/pickup)
        let calculatedCEP = null;            // CEP calculado para o frete

        // ===================================
        // DATA SDK HANDLER
        // Gerencia os dados persistentes
        // ===================================
        
        const dataHandler = {
            /**
             * Função chamada quando os dados mudam
             * @param {Array} data - Array com todos os dados do banco
             */
            onDataChanged(data) {
                if (!data) return;
                
                // Separar dados por tipo
                const users = data.filter(item => item.type === 'user');
                products = data.filter(item => item.type === 'product');
                orders = data.filter(item => item.type === 'order');
                const addresses = data.filter(item => item.type === 'address');
                
                // Carregar usuário atual (primeiro usuário encontrado)
                if (users.length > 0) {
                    currentUser = users[0];
                    populateUserForm();
                    
                    // Carregar endereços do usuário
                    userAddresses = addresses.filter(addr => addr.user_id === currentUser.id);
                }
                
                // Filtrar apenas pedidos do usuário atual
                if (currentUser) {
                    orders = orders.filter(order => order.user_id === currentUser.id);
                }
                
                // Atualizar interface
                renderProducts();
                renderOrders();
            }
        };

        // ===================================
        // INICIALIZAÇÃO DA APLICAÇÃO
        // ===================================
        
        document.addEventListener('DOMContentLoaded', async function() {
            // Inicializar Data SDK (persistência de dados)
            if (window.dataSdk) {
                const initResult = await window.dataSdk.init(dataHandler);
                if (!initResult.isOk) {
                    console.error('Erro ao inicializar Data SDK');
                }
            }

            // Inicializar Element SDK (integração com Canva)
            if (window.elementSdk) {
                await window.elementSdk.init({
                    defaultConfig,
                    onConfigChange: async (config) => {
                        // Atualizar nome do restaurante
                        document.getElementById('restaurant-name').textContent = '🍔 ' + (config.restaurant_name || defaultConfig.restaurant_name);
                        // Atualizar tagline
                        document.querySelectorAll('.tagline').forEach(el => {
                            el.textContent = config.tagline || defaultConfig.tagline;
                        });
                    },
                    mapToCapabilities: (config) => ({
                        recolorables: [],
                        borderables: [],
                        fontEditable: undefined,
                        fontSizeable: undefined
                    }),
                    mapToEditPanelValues: (config) => new Map([
                        ["restaurant_name", config.restaurant_name || defaultConfig.restaurant_name],
                        ["tagline", config.tagline || defaultConfig.tagline]
                    ])
                });
            }

            // Configurar event listeners
            setupEventListeners();
            
            // Criar produtos de exemplo (apenas na primeira vez)
            await createSampleProducts();
        });

        // ===================================
        // CONFIGURAÇÃO DE EVENT LISTENERS
        // Vincula todos os elementos interativos
        // ===================================
        
        function setupEventListeners() {
            // --- NAVEGAÇÃO ---
            document.getElementById('menu-btn').addEventListener('click', () => showSection('menu'));
            document.getElementById('orders-btn').addEventListener('click', () => showSection('orders'));
            
            // --- DROPDOWN DE CONTA ---
            const accountBtn = document.getElementById('account-btn');
            const accountDropdown = document.getElementById('account-dropdown');
            
            // Abrir/fechar dropdown
            accountBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                accountDropdown.classList.toggle('hidden');
                updateAccountDropdown();
            });

            // Fechar dropdown ao clicar fora
            document.addEventListener('click', (e) => {
                if (!accountBtn.contains(e.target) && !accountDropdown.contains(e.target)) {
                    accountDropdown.classList.add('hidden');
                }
            });

            // Opções do dropdown
            document.getElementById('edit-account-btn').addEventListener('click', () => {
                showSection('account');
                accountDropdown.classList.add('hidden');
            });

            document.getElementById('logout-btn').addEventListener('click', () => {
                handleLogout();
                accountDropdown.classList.add('hidden');
            });

            document.getElementById('login-header-btn').addEventListener('click', () => {
                accountDropdown.classList.add('hidden');
            });

            // --- FILTROS DE CATEGORIA ---
            document.getElementById('filter-all').addEventListener('click', () => setFilter('all'));
            document.getElementById('filter-burgers').addEventListener('click', () => setFilter('burger'));
            document.getElementById('filter-sides').addEventListener('click', () => setFilter('side'));
            document.getElementById('filter-drinks').addEventListener('click', () => setFilter('drink'));

            // --- CARRINHO ---
            document.getElementById('cart-btn').addEventListener('click', openCart);
            document.getElementById('close-cart').addEventListener('click', closeCart);
            document.getElementById('checkout-btn').addEventListener('click', openCheckout);

            // --- CHECKOUT ---
            document.getElementById('close-checkout').addEventListener('click', closeCheckout);
            document.getElementById('continue-logged-btn').addEventListener('click', continueFromLoggedCheckout);
            document.getElementById('guest-address-form').addEventListener('submit', handleGuestAddressSubmit);
            document.getElementById('sidebar-checkout-btn').addEventListener('click', openCheckout);

            // --- AUTH MODAL ---
            document.getElementById('create-account-btn').addEventListener('click', handleCreateAccount);
            document.getElementById('login-btn').addEventListener('click', handleLogin);
            document.getElementById('continue-guest-btn').addEventListener('click', handleContinueAsGuest);

            // --- ORDER SUMMARY ---
            document.getElementById('close-order-summary').addEventListener('click', closeOrderSummary);
            document.getElementById('confirm-final-order-btn').addEventListener('click', confirmFinalOrder);

            // --- ADDRESS FORM ---
            document.getElementById('add-new-address-btn').addEventListener('click', openAddressForm);
            document.getElementById('close-address-form').addEventListener('click', closeAddressForm);
            document.getElementById('new-address-form').addEventListener('submit', saveNewAddress);

            // --- CUSTOMIZE MODAL ---
            document.getElementById('close-customize').addEventListener('click', closeCustomizeModal);
            document.getElementById('increase-quantity').addEventListener('click', increaseCustomizeQuantity);
            document.getElementById('decrease-quantity').addEventListener('click', decreaseCustomizeQuantity);
            document.getElementById('add-to-cart-btn').addEventListener('click', addCustomizedToCart);

            // --- FORMULÁRIO DE CONTA ---
            document.getElementById('account-form').addEventListener('submit', saveUserInfo);

            // --- CEP LOOKUP (Busca automática de endereço por CEP) ---
            document.getElementById('user-cep').addEventListener('blur', () => lookupCEP('user'));
            document.getElementById('user-cep').addEventListener('input', formatCEP);
            document.getElementById('guest-cep').addEventListener('blur', () => lookupCEP('guest'));
            document.getElementById('guest-cep').addEventListener('input', formatCEP);
            document.getElementById('new-cep').addEventListener('blur', () => lookupCEP('new'));
            document.getElementById('new-cep').addEventListener('input', formatCEP);

            // --- CÁLCULO DE FRETE - SIDEBAR ---
            document.getElementById('sidebar-cep-input').addEventListener('input', formatCEP);
            document.getElementById('sidebar-calc-btn').addEventListener('click', calculateSidebarDelivery);
            document.getElementById('sidebar-address-select').addEventListener('change', handleSidebarAddressChange);
            document.getElementById('sidebar-add-address-btn').addEventListener('click', openAddressForm);
            document.querySelectorAll('input[name="sidebar-delivery-type"]').forEach(radio => {
                radio.addEventListener('change', updateSidebarDeliveryType);
            });

            // --- CÁLCULO DE FRETE - MODAL ---
            document.getElementById('modal-cep-input').addEventListener('input', formatCEP);
            document.getElementById('modal-calc-btn').addEventListener('click', calculateModalDelivery);
            document.getElementById('modal-address-select').addEventListener('change', handleModalAddressChange);
            document.getElementById('modal-add-address-btn').addEventListener('click', openAddressForm);
            document.querySelectorAll('input[name="modal-delivery-type"]').forEach(radio => {
                radio.addEventListener('change', updateModalDeliveryType);
            });

            // --- FECHAR MODAIS AO CLICAR FORA ---
            document.getElementById('cart-modal').addEventListener('click', (e) => {
                if (e.target.id === 'cart-modal') closeCart();
            });
            document.getElementById('checkout-modal').addEventListener('click', (e) => {
                if (e.target.id === 'checkout-modal') closeCheckout();
            });
            document.getElementById('auth-modal').addEventListener('click', (e) => {
                if (e.target.id === 'auth-modal') closeAuthModal();
            });
            document.getElementById('order-summary-modal').addEventListener('click', (e) => {
                if (e.target.id === 'order-summary-modal') closeOrderSummary();
            });
            document.getElementById('address-form-modal').addEventListener('click', (e) => {
                if (e.target.id === 'address-form-modal') closeAddressForm();
            });
            document.getElementById('customize-modal').addEventListener('click', (e) => {
                if (e.target.id === 'customize-modal') closeCustomizeModal();
            });
        }

        // ===================================
        // FUNÇÕES UTILITÁRIAS
        // ===================================
        
        /**
         * Formata o CEP com máscara (00000-000)
         */
        function formatCEP(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 5) {
                value = value.slice(0, 5) + '-' + value.slice(5, 8);
            }
            e.target.value = value;
        }

        /**
         * Busca endereço automaticamente através do CEP usando API ViaCEP
         * @param {string} prefix - Prefixo do campo (user, guest, new)
         */
        async function lookupCEP(prefix) {
            const cepInput = document.getElementById(`${prefix}-cep`);
            const cep = cepInput.value.replace(/\D/g, '');
            
            if (cep.length !== 8) return;

            const loadingIndicator = document.getElementById(`${prefix}-cep-loading`);
            loadingIndicator.classList.remove('hidden');

            // Desabilitar campos enquanto busca
            const fields = [`${prefix}-street`, `${prefix}-neighborhood`, `${prefix}-city`, `${prefix}-state`];
            fields.forEach(id => {
                const field = document.getElementById(id);
                if (field) field.disabled = true;
            });

            try {
                // Fazer requisição para API ViaCEP
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();

                if (data.erro) {
                    showMessage('CEP não encontrado. Por favor, preencha manualmente.', 'error');
                    fields.forEach(id => {
                        const field = document.getElementById(id);
                        if (field) field.disabled = false;
                    });
                } else {
                    // Preencher campos com dados da API
                    const streetField = document.getElementById(`${prefix}-street`);
                    const neighborhoodField = document.getElementById(`${prefix}-neighborhood`);
                    const cityField = document.getElementById(`${prefix}-city`);
                    const stateField = document.getElementById(`${prefix}-state`);

                    if (streetField) streetField.value = data.logradouro || '';
                    if (neighborhoodField) neighborhoodField.value = data.bairro || '';
                    if (cityField) cityField.value = data.localidade || '';
                    if (stateField) stateField.value = data.uf || '';

                    // Reabilitar campos vazios para edição
                    fields.forEach(id => {
                        const field = document.getElementById(id);
                        if (field) field.disabled = false;
                    });

                    showMessage('Endereço encontrado! Complete as informações restantes.', 'success');
                }
            } catch (error) {
                showMessage('Erro ao buscar CEP. Por favor, preencha manualmente.', 'error');
                fields.forEach(id => {
                    const field = document.getElementById(id);
                    if (field) field.disabled = false;
                });
            } finally {
                loadingIndicator.classList.add('hidden');
            }
        }

        // ===================================
        // NAVEGAÇÃO ENTRE SEÇÕES
        // ===================================
        
        /**
         * Exibe a seção selecionada e esconde as outras
         * @param {string} section - Nome da seção (menu, orders, account)
         */
        function showSection(section) {
            // Esconder todas as seções
            document.getElementById('menu-section').classList.add('hidden');
            document.getElementById('orders-section').classList.add('hidden');
            document.getElementById('account-section').classList.add('hidden');

            // Mostrar seção selecionada
            document.getElementById(`${section}-section`).classList.remove('hidden');
            currentSection = section;

            // Mostrar/esconder carrinho lateral apenas na seção de menu
            const sidebarCart = document.getElementById('sidebar-cart');
            if (section === 'menu') {
                sidebarCart.classList.remove('hidden');
                sidebarCart.classList.add('lg:block');
            } else {
                sidebarCart.classList.add('hidden');
                sidebarCart.classList.remove('lg:block');
            }

            // Atualizar botões de navegação (destacar ativo)
            document.querySelectorAll('header button').forEach(btn => {
                btn.classList.remove('bg-gray-800');
                btn.classList.add('hover:text-gray-300');
            });

            const activeBtn = document.getElementById(`${section}-btn`);
            if (activeBtn) {
                activeBtn.classList.add('bg-gray-800');
                activeBtn.classList.remove('hover:text-gray-300');
            }
        }

        // ===================================
        // FILTROS DE PRODUTOS
        // ===================================
        
        /**
         * Define o filtro de categoria ativo
         * @param {string} filter - Categoria (all, burger, side, drink)
         */
        function setFilter(filter) {
            currentFilter = filter;

            // Atualizar estilo dos botões de filtro
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-red-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            });

            // Destacar botão ativo
            const activeBtn = filter === 'all' ? 
                document.getElementById('filter-all') : 
                document.getElementById(`filter-${filter}s`);

            if (activeBtn) {
                activeBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                activeBtn.classList.add('bg-red-600', 'text-white');
            }

            // Renderizar produtos filtrados
            renderProducts();
        }

        // ===================================
        // INGREDIENTES DISPONÍVEIS
        // Ingredientes que podem ser removidos ou adicionados
        // ===================================
        
        const availableIngredients = {
            remove: [
                'Alface',
                'Tomate',
                'Cebola',
                'Picles',
                'Queijo',
                'Molho especial',
                'Bacon'
            ],
            add: [
                { name: 'Queijo extra', price: 3.00 },
                { name: 'Bacon', price: 4.00 },
                { name: 'Ovo', price: 2.50 },
                { name: 'Cebola caramelizada', price: 2.00 },
                { name: 'Cogumelos', price: 3.50 },
                { name: 'Jalapeño', price: 2.50 },
                { name: 'Picles extra', price: 1.50 }
            ]
        };

        // ===================================
        // CRIAÇÃO DE PRODUTOS DE EXEMPLO
        // Cria produtos iniciais no banco de dados
        // ===================================
        
        async function createSampleProducts() {
            // Não criar se já existem produtos
            if (products.length > 0) return;

            // Definir produtos de exemplo
            const sampleProducts = [
                {
                    name: 'Burger Clássico',
                    category: 'burger',
                    price: 18.90,
                    description: 'Hambúrguer 150g, queijo cheddar, alface, tomate e molho especial',
                    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
                    available: true,
                    base_ingredients: ['Hambúrguer 150g', 'Queijo cheddar', 'Alface', 'Tomate', 'Molho especial']
                },
                {
                    name: 'Burger Bacon',
                    category: 'burger',
                    price: 22.90,
                    description: 'Hambúrguer 150g, bacon crocante, queijo, cebola caramelizada e molho barbecue',
                    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop',
                    available: true,
                    base_ingredients: ['Hambúrguer 150g', 'Bacon crocante', 'Queijo', 'Cebola caramelizada', 'Molho barbecue']
                },
                {
                    name: 'Burger Duplo',
                    category: 'burger',
                    price: 28.90,
                    description: 'Dois hambúrgueres 150g, queijo duplo, alface, tomate, picles e molho especial',
                    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop',
                    available: true,
                    base_ingredients: ['Dois hambúrgueres 150g', 'Queijo duplo', 'Alface', 'Tomate', 'Picles', 'Molho especial']
                },
                {
                    name: 'Batata Frita',
                    category: 'side',
                    price: 8.90,
                    description: 'Porção individual de batatas fritas crocantes',
                    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop',
                    available: true
                },
                {
                    name: 'Onion Rings',
                    category: 'side',
                    price: 9.90,
                    description: 'Anéis de cebola empanados e fritos',
                    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop',
                    available: true
                },
                {
                    name: 'Coca-Cola',
                    category: 'drink',
                    price: 5.90,
                    description: 'Refrigerante 350ml gelado',
                    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=300&fit=crop',
                    available: true
                },
                {
                    name: 'Suco Natural',
                    category: 'drink',
                    price: 7.90,
                    description: 'Suco natural 500ml (laranja, limão ou maracujá)',
                    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=300&fit=crop',
                    available: true
                }
            ];

            // Criar cada produto no banco de dados
            for (const product of sampleProducts) {
                const newProduct = {
                    type: 'product',
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    ...product,
                    created_at: new Date().toISOString()
                };

                if (window.dataSdk) {
                    await window.dataSdk.create(newProduct);
                }
                
                // Pequeno delay entre criações para evitar conflitos
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // ===================================
        // RENDERIZAÇÃO DE PRODUTOS
        // Exibe os produtos na tela
        // ===================================
        
        function renderProducts() {
            const list = document.getElementById('products-list');
            
            // Filtrar produtos disponíveis
            let filteredProducts = products.filter(p => p.available);
            if (currentFilter !== 'all') {
                filteredProducts = filteredProducts.filter(p => p.category === currentFilter);
            }

            // Mostrar mensagem se não houver produtos
            if (filteredProducts.length === 0) {
                list.innerHTML = '<div class="text-center py-12 text-gray-500"><p class="text-xl">Nenhum produto disponível</p></div>';
                return;
            }

            // Renderizar cards de produtos
            list.innerHTML = filteredProducts.map(product => `
                <div class="product-card bg-white rounded-xl shadow-lg overflow-hidden fade-in flex">
                    <img src="${product.image}" alt="${product.name}" class="w-32 h-32 object-cover" onerror="this.src=''; this.alt='Imagem não disponível'; this.outerHTML='<div class=\\'w-32 h-32 flex items-center justify-center bg-gray-200 text-gray-400 text-xs text-center\\'>Sem imagem</div>';">
                    <div class="p-4 flex-1 flex flex-col justify-between">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 mb-1">${product.name}</h3>
                            <p class="text-gray-600 text-sm mb-3">${product.description}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-2xl font-bold text-green-600">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
                            <button onclick="addToCart('${product.id}')" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // ===================================
        // MODAL DE PERSONALIZAÇÃO
        // Variáveis de estado
        // ===================================
        
        let customizingProduct = null;      // Produto sendo customizado
        let customizeQuantity = 1;          // Quantidade do produto
        let selectedRemoveIngredients = []; // Ingredientes a remover
        let selectedAddIngredients = [];    // Ingredientes a adicionar

        // ===================================
        // ADICIONAR AO CARRINHO
        // ===================================
        
        /**
         * Adiciona produto ao carrinho (abre modal de customização para hambúrgueres)
         * @param {string} productId - ID do produto
         */
        function addToCart(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            // Se for hambúrguer, abrir modal de personalização
            if (product.category === 'burger') {
                openCustomizeModal(product);
            } else {
                // Outros produtos vão direto para o carrinho
                addDirectToCart(product);
            }
        }

        /**
         * Adiciona produto direto ao carrinho sem customização
         */
        function addDirectToCart(product, customization = null) {
            const cartItem = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                product_id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: customization ? customization.quantity : 1,
                customization: customization
            };

            // Ajustar preço se houver customização
            if (customization) {
                cartItem.price = customization.total_price / customization.quantity;
            }

            cart.push(cartItem);
            updateCartUI();
            showMessage(`${product.name} adicionado ao carrinho!`, 'success');
        }

        /**
         * Abre modal de personalização do produto
         */
        function openCustomizeModal(product) {
            customizingProduct = product;
            customizeQuantity = 1;
            selectedRemoveIngredients = [];
            selectedAddIngredients = [];

            // Preencher informações do produto
            document.getElementById('customize-product-name').textContent = product.name;
            document.getElementById('customize-product-image').src = product.image;
            document.getElementById('customize-product-description').textContent = product.description;
            document.getElementById('customize-product-price').textContent = `R$ ${product.price.toFixed(2).replace('.', ',')}`;
            document.getElementById('customize-quantity').textContent = '1';
            document.getElementById('product-notes').value = '';

            // Renderizar lista de ingredientes para remover
            const removeList = document.getElementById('remove-ingredients-list');
            if (product.base_ingredients && product.base_ingredients.length > 0) {
                removeList.innerHTML = product.base_ingredients.map(ingredient => `
                    <label class="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input type="checkbox" value="${ingredient}" class="remove-ingredient mr-3 w-5 h-5 text-red-600 rounded focus:ring-red-500">
                        <span class="flex-1">${ingredient}</span>
                    </label>
                `).join('');

                // Adicionar event listeners
                document.querySelectorAll('.remove-ingredient').forEach(checkbox => {
                    checkbox.addEventListener('change', updateCustomizePrice);
                });
            } else {
                document.getElementById('remove-ingredients-section').style.display = 'none';
            }

            // Renderizar lista de ingredientes para adicionar
            const addList = document.getElementById('add-ingredients-list');
            addList.innerHTML = availableIngredients.add.map(ingredient => `
                <label class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div class="flex items-center flex-1">
                        <input type="checkbox" value="${ingredient.name}" data-price="${ingredient.price}" class="add-ingredient mr-3 w-5 h-5 text-red-600 rounded focus:ring-red-500">
                        <span>${ingredient.name}</span>
                    </div>
                    <span class="text-green-600 font-semibold ml-4">+ R$ ${ingredient.price.toFixed(2).replace('.', ',')}</span>
                </label>
            `).join('');

            // Adicionar event listeners
            document.querySelectorAll('.add-ingredient').forEach(checkbox => {
                checkbox.addEventListener('change', updateCustomizePrice);
            });

            updateCustomizePrice();
            document.getElementById('customize-modal').classList.remove('hidden');
        }

        function closeCustomizeModal() {
            document.getElementById('customize-modal').classList.add('hidden');
            customizingProduct = null;
        }

        function increaseCustomizeQuantity() {
            customizeQuantity++;
            document.getElementById('customize-quantity').textContent = customizeQuantity;
            updateCustomizePrice();
        }

        function decreaseCustomizeQuantity() {
            if (customizeQuantity > 1) {
                customizeQuantity--;
                document.getElementById('customize-quantity').textContent = customizeQuantity;
                updateCustomizePrice();
            }
        }

        /**
         * Atualiza o preço total na modal de customização
         */
        function updateCustomizePrice() {
            if (!customizingProduct) return;

            let totalPrice = customizingProduct.price;

            // Adicionar preço dos ingredientes extras
            document.querySelectorAll('.add-ingredient:checked').forEach(checkbox => {
                totalPrice += parseFloat(checkbox.dataset.price);
            });

            // Multiplicar pela quantidade
            const finalPrice = totalPrice * customizeQuantity;

            document.getElementById('customize-total-price').textContent = `R$ ${finalPrice.toFixed(2).replace('.', ',')}`;
        }

        /**
         * Adiciona produto customizado ao carrinho
         */
        function addCustomizedToCart() {
            if (!customizingProduct) return;

            // Coletar ingredientes removidos
            selectedRemoveIngredients = [];
            document.querySelectorAll('.remove-ingredient:checked').forEach(checkbox => {
                selectedRemoveIngredients.push(checkbox.value);
            });

            // Coletar ingredientes adicionados
            selectedAddIngredients = [];
            document.querySelectorAll('.add-ingredient:checked').forEach(checkbox => {
                selectedAddIngredients.push({
                    name: checkbox.value,
                    price: parseFloat(checkbox.dataset.price)
                });
            });

            const notes = document.getElementById('product-notes').value;

            // Calcular preço total
            let itemPrice = customizingProduct.price;
            selectedAddIngredients.forEach(ingredient => {
                itemPrice += ingredient.price;
            });

            const customization = {
                quantity: customizeQuantity,
                remove_ingredients: selectedRemoveIngredients,
                add_ingredients: selectedAddIngredients,
                notes: notes,
                total_price: itemPrice * customizeQuantity
            };

            addDirectToCart(customizingProduct, customization);
            closeCustomizeModal();
        }

        // ===================================
        // GERENCIAMENTO DO CARRINHO
        // ===================================
        
        /**
         * Remove item do carrinho
         */
        function removeFromCart(productId) {
            const index = cart.findIndex(item => item.id === productId);
            if (index !== -1) {
                cart.splice(index, 1);
                updateCartUI();
                renderCartItems();
            }
        }

        /**
         * Atualiza quantidade de um item
         */
        function updateQuantity(productId, change) {
            const item = cart.find(item => item.id === productId);
            if (!item) return;

            item.quantity += change;
            
            if (item.quantity <= 0) {
                removeFromCart(productId);
            } else {
                updateCartUI();
                renderCartItems();
            }
        }

        /**
         * Atualiza interface do carrinho
         */
        function updateCartUI() {
            const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
            const cartFloat = document.getElementById('cart-float');
            
            document.getElementById('cart-count').textContent = cartCount;
            
            // Sempre manter o carrinho visível
            cartFloat.classList.remove('hidden');

            // Atualizar carrinho lateral
            updateSidebarCart();
            
            // Atualizar seção de entrega
            updateDeliverySection();
        }

        /**
         * Atualiza seção de cálculo de frete
         */
        function updateDeliverySection() {
            const sidebarLoggedDelivery = document.getElementById('sidebar-logged-delivery');
            const sidebarGuestDelivery = document.getElementById('sidebar-guest-delivery');
            const modalLoggedDelivery = document.getElementById('modal-logged-delivery');
            const modalGuestDelivery = document.getElementById('modal-guest-delivery');

            // Mostrar opção correta baseado se usuário está logado e tem endereços
            if (currentUser && userAddresses.length > 0) {
                sidebarLoggedDelivery.classList.remove('hidden');
                sidebarGuestDelivery.classList.add('hidden');
                modalLoggedDelivery.classList.remove('hidden');
                modalGuestDelivery.classList.add('hidden');
                
                populateAddressSelects();
            } else {
                sidebarLoggedDelivery.classList.add('hidden');
                sidebarGuestDelivery.classList.remove('hidden');
                modalLoggedDelivery.classList.add('hidden');
                modalGuestDelivery.classList.remove('hidden');
            }
        }

        /**
         * Popula selects de endereço
         */
        function populateAddressSelects() {
            const sidebarSelect = document.getElementById('sidebar-address-select');
            const modalSelect = document.getElementById('modal-address-select');

            const optionsHtml = '<option value="">Selecione um endereço</option>' + 
                userAddresses.map(addr => 
                    `<option value="${addr.id}">${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city}/${addr.state}</option>`
                ).join('');

            sidebarSelect.innerHTML = optionsHtml;
            modalSelect.innerHTML = optionsHtml;

            // Manter seleção se já existir
            if (selectedAddress) {
                sidebarSelect.value = selectedAddress.id;
                modalSelect.value = selectedAddress.id;
            }
        }

        /**
         * Handler para mudança de endereço no sidebar
         */
        function handleSidebarAddressChange(e) {
            const addressId = e.target.value;
            if (addressId) {
                selectedAddress = userAddresses.find(addr => addr.id === addressId);
                calculatedCEP = selectedAddress.cep;
                calculateDeliveryFee(selectedAddress.cep);
                document.getElementById('sidebar-delivery-type').classList.remove('hidden');
                
                // Sincronizar com modal
                document.getElementById('modal-address-select').value = addressId;
            } else {
                document.getElementById('sidebar-delivery-type').classList.add('hidden');
                currentDeliveryFee = 0;
                updateCartTotals();
            }
        }

        /**
         * Handler para mudança de endereço no modal
         */
        function handleModalAddressChange(e) {
            const addressId = e.target.value;
            if (addressId) {
                selectedAddress = userAddresses.find(addr => addr.id === addressId);
                calculatedCEP = selectedAddress.cep;
                calculateDeliveryFee(selectedAddress.cep);
                document.getElementById('modal-delivery-type').classList.remove('hidden');
                
                // Sincronizar com sidebar
                document.getElementById('sidebar-address-select').value = addressId;
            } else {
                document.getElementById('modal-delivery-type').classList.add('hidden');
                currentDeliveryFee = 0;
                updateCartTotals();
            }
        }

        /**
         * Calcula frete no sidebar
         */
        function calculateSidebarDelivery() {
            const cepInput = document.getElementById('sidebar-cep-input');
            const cep = cepInput.value.replace(/\D/g, '');
            
            if (cep.length !== 8) {
                showMessage('Por favor, digite um CEP válido', 'error');
                return;
            }

            calculatedCEP = cepInput.value;
            calculateDeliveryFee(cep);
            document.getElementById('sidebar-delivery-type').classList.remove('hidden');
            
            // Sincronizar com modal
            document.getElementById('modal-cep-input').value = cepInput.value;
            document.getElementById('modal-delivery-type').classList.remove('hidden');
        }

        /**
         * Calcula frete no modal
         */
        function calculateModalDelivery() {
            const cepInput = document.getElementById('modal-cep-input');
            const cep = cepInput.value.replace(/\D/g, '');
            
            if (cep.length !== 8) {
                showMessage('Por favor, digite um CEP válido', 'error');
                return;
            }

            calculatedCEP = cepInput.value;
            calculateDeliveryFee(cep);
            document.getElementById('modal-delivery-type').classList.remove('hidden');
            
            // Sincronizar com sidebar
            document.getElementById('sidebar-cep-input').value = cepInput.value;
            document.getElementById('sidebar-delivery-type').classList.remove('hidden');
        }

        /**
         * Calcula taxa de entrega baseado no CEP
         * LÓGICA DE EXEMPLO:
         * - CEPs iniciados com 0-3: R$ 5,00
         * - CEPs iniciados com 4-6: R$ 8,00
         * - CEPs iniciados com 7-9: R$ 12,00
         */
        function calculateDeliveryFee(cep) {
            const firstDigit = parseInt(cep.charAt(0));
            let fee = defaultConfig.delivery_fee;
            
            if (firstDigit >= 0 && firstDigit <= 3) {
                fee = 5.00;
            } else if (firstDigit >= 4 && firstDigit <= 6) {
                fee = 8.00;
            } else {
                fee = 12.00;
            }

            // Atualizar preço exibido
            document.getElementById('sidebar-delivery-price').textContent = `R$ ${fee.toFixed(2).replace('.', ',')}`;
            document.getElementById('modal-delivery-price').textContent = `R$ ${fee.toFixed(2).replace('.', ',')}`;

            // Aplicar taxa se tipo for delivery
            if (currentDeliveryType === 'delivery') {
                currentDeliveryFee = fee;
            } else {
                currentDeliveryFee = 0;
            }

            updateCartTotals();
            showMessage(`Frete calculado: R$ ${fee.toFixed(2).replace('.', ',')}`, 'success');
        }

        /**
         * Atualiza tipo de entrega no sidebar
         */
        function updateSidebarDeliveryType(e) {
            currentDeliveryType = e.target.value;
            
            if (currentDeliveryType === 'pickup') {
                currentDeliveryFee = 0;
            } else if (calculatedCEP) {
                // Recalcular taxa baseado no CEP
                const cep = calculatedCEP.replace(/\D/g, '');
                const firstDigit = parseInt(cep.charAt(0));
                
                if (firstDigit >= 0 && firstDigit <= 3) {
                    currentDeliveryFee = 5.00;
                } else if (firstDigit >= 4 && firstDigit <= 6) {
                    currentDeliveryFee = 8.00;
                } else {
                    currentDeliveryFee = 12.00;
                }
            }

            updateCartTotals();
            
            // Sincronizar com modal
            const modalRadio = document.querySelector(`input[name="modal-delivery-type"][value="${currentDeliveryType}"]`);
            if (modalRadio) modalRadio.checked = true;
        }

        /**
         * Atualiza tipo de entrega no modal
         */
        function updateModalDeliveryType(e) {
            currentDeliveryType = e.target.value;
            
            if (currentDeliveryType === 'pickup') {
                currentDeliveryFee = 0;
            } else if (calculatedCEP) {
                // Recalcular taxa baseado no CEP
                const cep = calculatedCEP.replace(/\D/g, '');
                const firstDigit = parseInt(cep.charAt(0));
                
                if (firstDigit >= 0 && firstDigit <= 3) {
                    currentDeliveryFee = 5.00;
                } else if (firstDigit >= 4 && firstDigit <= 6) {
                    currentDeliveryFee = 8.00;
                } else {
                    currentDeliveryFee = 12.00;
                }
            }

            updateCartTotals();
            
            // Sincronizar com sidebar
            const sidebarRadio = document.querySelector(`input[name="sidebar-delivery-type"][value="${currentDeliveryType}"]`);
            if (sidebarRadio) sidebarRadio.checked = true;
        }

        /**
         * Atualiza carrinho lateral
         */
        function updateSidebarCart() {
            const sidebarCartItems = document.getElementById('sidebar-cart-items');
            const sidebarCheckoutBtn = document.getElementById('sidebar-checkout-btn');
            
            if (cart.length === 0) {
                sidebarCartItems.innerHTML = '<p class="text-center text-gray-500 py-8">Seu carrinho está vazio</p>';
                sidebarCheckoutBtn.disabled = true;
            } else {
                sidebarCheckoutBtn.disabled = false;
                
                // Renderizar itens
                sidebarCartItems.innerHTML = cart.map(item => {
                    let customizationText = '';
                    if (item.customization) {
                        const custom = item.customization;
                        const details = [];
                        
                        if (custom.remove_ingredients && custom.remove_ingredients.length > 0) {
                            details.push(`Sem: ${custom.remove_ingredients.join(', ')}`);
                        }
                        
                        if (custom.add_ingredients && custom.add_ingredients.length > 0) {
                            const addNames = custom.add_ingredients.map(ing => ing.name).join(', ');
                            details.push(`Extra: ${addNames}`);
                        }
                        
                        if (details.length > 0) {
                            customizationText = `<p class="text-xs text-gray-500 mt-1">${details.join(' • ')}</p>`;
                        }
                    }

                    return `
                        <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded" onerror="this.style.display='none'">
                            <div class="flex-1 min-w-0">
                                <h4 class="font-semibold text-sm text-gray-800 truncate">${item.name}</h4>
                                ${customizationText}
                                <div class="flex items-center justify-between mt-2">
                                    <div class="flex items-center space-x-2">
                                        <button onclick="updateQuantity('${item.id}', -1)" class="bg-white hover:bg-gray-100 text-gray-700 w-6 h-6 rounded-full font-bold text-sm">-</button>
                                        <span class="font-semibold text-sm">${item.quantity}</span>
                                        <button onclick="updateQuantity('${item.id}', 1)" class="bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full font-bold text-sm">+</button>
                                    </div>
                                    <span class="text-green-600 font-bold text-sm">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            updateCartTotals();
        }

        /**
         * Atualiza totais do carrinho
         */
        function updateCartTotals() {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + currentDeliveryFee;

            // Atualizar sidebar
            document.getElementById('sidebar-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('sidebar-delivery-fee').textContent = `R$ ${currentDeliveryFee.toFixed(2).replace('.', ',')}`;
            document.getElementById('sidebar-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

            // Atualizar modal
            document.getElementById('cart-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('cart-delivery-fee').textContent = `R$ ${currentDeliveryFee.toFixed(2).replace('.', ',')}`;
            document.getElementById('cart-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        // ===================================
        // MODAIS DO CARRINHO
        // ===================================
        
        function openCart() {
            renderCartItems();
            document.getElementById('cart-modal').classList.remove('hidden');
        }

        function closeCart() {
            document.getElementById('cart-modal').classList.add('hidden');
        }

        function openCheckout() {
            if (cart.length === 0) return;

            closeCart();

            // Mostrar formulário apropriado
            if (!currentUser) {
                document.getElementById('checkout-logged-section').classList.add('hidden');
                document.getElementById('checkout-guest-section').classList.remove('hidden');
                document.getElementById('checkout-modal').classList.remove('hidden');
            } else {
                renderAddressList();
                document.getElementById('checkout-logged-section').classList.remove('hidden');
                document.getElementById('checkout-guest-section').classList.add('hidden');
                document.getElementById('checkout-modal').classList.remove('hidden');
            }
        }

        function closeCheckout() {
            document.getElementById('checkout-modal').classList.add('hidden');
        }

        /**
         * Renderiza lista de endereços
         */
        function renderAddressList() {
            const addressList = document.getElementById('address-list');
            
            if (userAddresses.length === 0) {
                addressList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum endereço cadastrado</p>';
                return;
            }

            addressList.innerHTML = userAddresses.map(address => `
                <label class="flex items-start p-4 border-2 ${selectedAddress && selectedAddress.id === address.id ? 'border-red-500 bg-red-50' : 'border-gray-200'} rounded-lg cursor-pointer hover:border-red-500 transition-colors">
                    <input type="radio" name="selected-address" value="${address.id}" ${selectedAddress && selectedAddress.id === address.id ? 'checked' : ''} onchange="selectAddress('${address.id}')" class="mr-3 mt-1">
                    <div class="flex-1">
                        <div class="font-semibold text-gray-800">${address.street}, ${address.number}</div>
                        <div class="text-sm text-gray-600">${address.complement ? address.complement + ', ' : ''}${address.neighborhood}</div>
                        <div class="text-sm text-gray-600">${address.city}/${address.state} - CEP: ${address.cep}</div>
                    </div>
                </label>
            `).join('');

            // Selecionar primeiro endereço se nenhum estiver selecionado
            if (!selectedAddress && userAddresses.length > 0) {
                selectedAddress = userAddresses[0];
            }
        }

        function selectAddress(addressId) {
            selectedAddress = userAddresses.find(addr => addr.id === addressId);
        }

        // ===================================
        // GERENCIAMENTO DE ENDEREÇOS
        // ===================================
        
        function openAddressForm() {
            document.getElementById('new-address-form').reset();
            document.getElementById('address-form-modal').classList.remove('hidden');
        }

        function closeAddressForm() {
            document.getElementById('address-form-modal').classList.add('hidden');
        }

        /**
         * Salva novo endereço
         */
        async function saveNewAddress(e) {
            e.preventDefault();

            if (!currentUser) {
                showMessage('Erro: usuário não encontrado', 'error');
                return;
            }

            const button = e.target.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = 'Salvando...';
            button.disabled = true;

            const newAddress = {
                type: 'address',
                id: 'ADDR' + Date.now().toString(),
                user_id: currentUser.id,
                cep: document.getElementById('new-cep').value,
                state: document.getElementById('new-state').value.toUpperCase(),
                city: document.getElementById('new-city').value,
                neighborhood: document.getElementById('new-neighborhood').value,
                street: document.getElementById('new-street').value,
                number: document.getElementById('new-number').value,
                complement: document.getElementById('new-complement').value,
                created_at: new Date().toISOString()
            };

            if (window.dataSdk) {
                const result = await window.dataSdk.create(newAddress);
                if (result.isOk) {
                    showMessage('Endereço adicionado com sucesso!', 'success');
                    closeAddressForm();
                } else {
                    showMessage('Erro ao adicionar endereço', 'error');
                }
            }

            button.textContent = originalText;
            button.disabled = false;
        }

        /**
         * Continua checkout para usuário logado
         */
        function continueFromLoggedCheckout() {
            if (!selectedAddress) {
                showMessage('Por favor, selecione um endereço de entrega', 'error');
                return;
            }

            const deliveryType = document.querySelector('input[name="delivery-type-logged"]:checked').value;
            const deliveryFee = deliveryType === 'delivery' ? defaultConfig.delivery_fee : 0;

            closeCheckout();
            showOrderSummary({
                name: currentUser.name,
                phone: currentUser.phone,
                address: selectedAddress,
                deliveryType,
                deliveryFee
            });
        }

        /**
         * Handler para submit de endereço guest
         */
        async function handleGuestAddressSubmit(e) {
            e.preventDefault();

            guestOrderData = {
                name: document.getElementById('guest-name').value,
                phone: document.getElementById('guest-phone').value,
                address: {
                    cep: document.getElementById('guest-cep').value,
                    state: document.getElementById('guest-state').value.toUpperCase(),
                    city: document.getElementById('guest-city').value,
                    neighborhood: document.getElementById('guest-neighborhood').value,
                    street: document.getElementById('guest-street').value,
                    number: document.getElementById('guest-number').value,
                    complement: document.getElementById('guest-complement').value
                },
                deliveryType: document.querySelector('input[name="delivery-type-guest"]:checked').value
            };

            guestOrderData.deliveryFee = guestOrderData.deliveryType === 'delivery' ? defaultConfig.delivery_fee : 0;

            closeCheckout();
            document.getElementById('auth-modal').classList.remove('hidden');
        }

        // ===================================
        // AUTH MODAL
        // ===================================
        
        function closeAuthModal() {
            document.getElementById('auth-modal').classList.add('hidden');
        }

        function handleCreateAccount() {
            closeAuthModal();
            showSection('account');
            
            // Preencher formulário com dados do pedido
            if (guestOrderData) {
                document.getElementById('user-name').value = guestOrderData.name;
                document.getElementById('user-phone').value = guestOrderData.phone;
                document.getElementById('user-cep').value = guestOrderData.address.cep;
                document.getElementById('user-state').value = guestOrderData.address.state;
                document.getElementById('user-city').value = guestOrderData.address.city;
                document.getElementById('user-neighborhood').value = guestOrderData.address.neighborhood;
                document.getElementById('user-street').value = guestOrderData.address.street;
                document.getElementById('user-number').value = guestOrderData.address.number;
                document.getElementById('user-complement').value = guestOrderData.address.complement;
            }
            
            showMessage('Preencha seu e-mail para criar sua conta', 'success');
        }

        function handleLogin() {
            closeAuthModal();
            // Implementar lógica de login
        }

        function handleContinueAsGuest() {
            if (!guestOrderData) return;
            
            closeAuthModal();
            showOrderSummary(guestOrderData);
        }

        // ===================================
        // ORDER SUMMARY
        // ===================================
        
        /**
         * Mostra resumo do pedido antes de confirmar
         */
        function showOrderSummary(orderData) {
            const deliveryInfo = document.getElementById('order-delivery-info');
            
            // Exibir informações de entrega
            if (orderData.deliveryType === 'delivery') {
                const addr = orderData.address;
                deliveryInfo.innerHTML = `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Informações de Entrega</h3>
                        <p class="font-semibold">${orderData.name}</p>
                        <p class="text-gray-600">${orderData.phone}</p>
                        <p class="text-gray-600 mt-2">
                            ${addr.street}, ${addr.number}
                            ${addr.complement ? ` - ${addr.complement}` : ''}
                        </p>
                        <p class="text-gray-600">
                            ${addr.neighborhood} - ${addr.city}/${addr.state}
                        </p>
                        <p class="text-gray-600">CEP: ${addr.cep}</p>
                    </div>
                `;
            } else {
                deliveryInfo.innerHTML = `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Retirada no Local</h3>
                        <p class="font-semibold">${orderData.name}</p>
                        <p class="text-gray-600">${orderData.phone}</p>
                        <p class="text-gray-600 mt-2">Você retirará o pedido no restaurante</p>
                    </div>
                `;
            }

            // Renderizar itens
            const itemsContainer = document.getElementById('final-order-items');
            itemsContainer.innerHTML = cart.map(item => `
                <div class="flex justify-between text-sm">
                    <span>${item.quantity}x ${item.name}</span>
                    <span class="font-semibold">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                </div>
            `).join('');

            // Calcular totais
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + orderData.deliveryFee;

            document.getElementById('final-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('final-delivery-fee').textContent = `R$ ${orderData.deliveryFee.toFixed(2).replace('.', ',')}`;
            document.getElementById('final-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

            document.getElementById('order-summary-modal').classList.remove('hidden');
        }

        function closeOrderSummary() {
            document.getElementById('order-summary-modal').classList.add('hidden');
        }

        /**
         * Confirma e cria o pedido final
         */
        async function confirmFinalOrder() {
            const button = document.getElementById('confirm-final-order-btn');
            const originalText = button.textContent;
            button.textContent = 'Processando...';
            button.disabled = true;

            const orderData = guestOrderData || {
                name: currentUser.name,
                phone: currentUser.phone,
                address: selectedAddress,
                deliveryType: document.querySelector('input[name="delivery-type-logged"]:checked')?.value || 'delivery',
                deliveryFee: document.querySelector('input[name="delivery-type-logged"]:checked')?.value === 'delivery' ? defaultConfig.delivery_fee : 0
            };

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const total = subtotal + orderData.deliveryFee;

            const addr = orderData.address;
            const addressString = orderData.deliveryType === 'delivery' ? 
                `${addr.street}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}, ${addr.neighborhood}, ${addr.city}/${addr.state}, CEP: ${addr.cep}` : 
                '';

            const order = {
                type: 'order',
                id: 'ORD' + Date.now().toString(),
                user_id: currentUser ? currentUser.id : 'guest',
                customer_name: orderData.name,
                customer_phone: orderData.phone,
                customer_address: addressString,
                delivery_type: orderData.deliveryType,
                delivery_fee: orderData.deliveryFee,
                status: 'Cozinha',
                total: total,
                items: JSON.stringify(cart),
                created_at: new Date().toISOString()
            };

            if (window.dataSdk) {
                const result = await window.dataSdk.create(order);
                if (result.isOk) {
                    showMessage('Pedido realizado com sucesso!', 'success');
                    // Limpar carrinho e dados
                    cart = [];
                    guestOrderData = null;
                    selectedAddress = null;
                    updateCartUI();
                    closeOrderSummary();
                    showSection('menu');
                } else {
                    showMessage('Erro ao criar pedido. Tente novamente.', 'error');
                }
            }

            button.textContent = originalText;
            button.disabled = false;
        }

        /**
         * Renderiza itens do carrinho no modal
         */
        function renderCartItems() {
            const cartItemsContainer = document.getElementById('cart-items');
            
            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Seu carrinho está vazio</p>';
                document.getElementById('checkout-btn').disabled = true;
                return;
            }

            document.getElementById('checkout-btn').disabled = false;

            cartItemsContainer.innerHTML = cart.map(item => {
                let customizationHtml = '';
                
                // Montar HTML de customização se existir
                if (item.customization) {
                    const custom = item.customization;
                    customizationHtml = '<div class="text-xs text-gray-600 mt-1">';
                    
                    if (custom.remove_ingredients && custom.remove_ingredients.length > 0) {
                        customizationHtml += `<div>Sem: ${custom.remove_ingredients.join(', ')}</div>`;
                    }
                    
                    if (custom.add_ingredients && custom.add_ingredients.length > 0) {
                        const addNames = custom.add_ingredients.map(ing => ing.name).join(', ');
                        customizationHtml += `<div>Extra: ${addNames}</div>`;
                    }
                    
                    if (custom.notes) {
                        customizationHtml += `<div>Obs: ${custom.notes}</div>`;
                    }
                    
                    customizationHtml += '</div>';
                }

                return `
                    <div class="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                        <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-lg" onerror="this.src=''; this.alt=''; this.classList.add('hidden')">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800">${item.name}</h4>
                            ${customizationHtml}
                            <p class="text-green-600 font-bold mt-1">R$ ${item.price.toFixed(2).replace('.', ',')} ${item.quantity > 1 ? 'cada' : ''}</p>
                        </div>
                        <div class="flex items-center space-x-3">
                            <button onclick="updateQuantity('${item.id}', -1)" class="bg-gray-200 hover:bg-gray-300 text-gray-700 w-8 h-8 rounded-full font-bold">-</button>
                            <span class="font-semibold w-8 text-center">${item.quantity}</span>
                            <button onclick="updateQuantity('${item.id}', 1)" class="bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full font-bold">+</button>
                        </div>
                        <button onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                `;
            }).join('');

            updateCartTotals();
        }

        // ===================================
        // RENDERIZAÇÃO DE PEDIDOS
        // ===================================
        
        function renderOrders() {
            const ordersList = document.getElementById('orders-list');
            
            if (!currentUser) {
                ordersList.innerHTML = '<p class="text-center text-gray-500 py-8">Por favor, preencha suas informações na seção "Minha Conta" primeiro.</p>';
                return;
            }

            if (orders.length === 0) {
                ordersList.innerHTML = '<p class="text-center text-gray-500 py-8">Você ainda não fez nenhum pedido</p>';
                return;
            }

            // Ordenar por data (mais recente primeiro)
            const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            ordersList.innerHTML = sortedOrders.map(order => {
                const items = JSON.parse(order.items);
                const date = new Date(order.created_at).toLocaleString('pt-BR');
                
                // Cores de status
                const statusColors = {
                    'Cozinha': 'bg-yellow-100 text-yellow-800',
                    'Aguardando entrega': 'bg-blue-100 text-blue-800',
                    'Saiu para entrega': 'bg-orange-100 text-orange-800',
                    'Entregue': 'bg-green-100 text-green-800',
                    'Cancelados': 'bg-red-100 text-red-800'
                };

                return `
                    <div class="border border-gray-200 rounded-lg p-6 fade-in">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="text-lg font-bold text-gray-800">Pedido #${order.id.slice(-6)}</h3>
                                <p class="text-sm text-gray-600">${date}</p>
                            </div>
                            <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}">
                                ${order.status}
                            </span>
                        </div>
                        
                        <div class="space-y-2 mb-4">
                            ${items.map(item => `
                                <div class="flex justify-between text-sm">
                                    <span>${item.quantity}x ${item.name}</span>
                                    <span>R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="border-t pt-4">
                            <div class="flex justify-between">
                                <span class="text-gray-600">Entrega:</span>
                                <span class="text-gray-800">${order.delivery_type === 'delivery' ? 'Delivery' : 'Retirada'}</span>
                            </div>
                            <div class="flex justify-between font-bold text-lg mt-2">
                                <span>Total:</span>
                                <span class="text-green-600">R$ ${order.total.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ===================================
        // GERENCIAMENTO DE USUÁRIO
        // ===================================
        
        /**
         * Preenche formulário com dados do usuário
         */
        function populateUserForm() {
            if (!currentUser) return;

            document.getElementById('user-name').value = currentUser.name || '';
            document.getElementById('user-email').value = currentUser.email || '';
            document.getElementById('user-phone').value = currentUser.phone || '';
            document.getElementById('user-cep').value = currentUser.cep || '';
            document.getElementById('user-state').value = currentUser.state || '';
            document.getElementById('user-city').value = currentUser.city || '';
            document.getElementById('user-neighborhood').value = currentUser.neighborhood || '';
            document.getElementById('user-street').value = currentUser.street || '';
            document.getElementById('user-number').value = currentUser.number || '';
            document.getElementById('user-complement').value = currentUser.complement || '';
        }

        /**
         * Salva informações do usuário
         */
        async function saveUserInfo(e) {
            e.preventDefault();

            const button = e.target.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = 'Salvando...';
            button.disabled = true;

            const userData = {
                type: 'user',
                name: document.getElementById('user-name').value,
                email: document.getElementById('user-email').value,
                phone: document.getElementById('user-phone').value,
                cep: document.getElementById('user-cep').value,
                state: document.getElementById('user-state').value.toUpperCase(),
                city: document.getElementById('user-city').value,
                neighborhood: document.getElementById('user-neighborhood').value,
                street: document.getElementById('user-street').value,
                number: document.getElementById('user-number').value,
                complement: document.getElementById('user-complement').value,
                created_at: currentUser ? currentUser.created_at : new Date().toISOString()
            };

            if (window.dataSdk) {
                if (currentUser) {
                    // Atualizar usuário existente
                    userData.id = currentUser.id;
                    userData.__backendId = currentUser.__backendId;
                    const result = await window.dataSdk.update(userData);
                    if (result.isOk) {
                        showMessage('Informações atualizadas com sucesso!', 'success');
                    } else {
                        showMessage('Erro ao atualizar informações', 'error');
                    }
                } else {
                    // Criar novo usuário
                    userData.id = 'USER' + Date.now().toString();
                    const result = await window.dataSdk.create(userData);
                    if (result.isOk) {
                        showMessage('Informações salvas com sucesso!', 'success');
                    } else {
                        showMessage('Erro ao salvar informações', 'error');
                    }
                }
            }

            button.textContent = originalText;
            button.disabled = false;
        }

        /**
         * Atualiza dropdown de conta
         */
        function updateAccountDropdown() {
            const loggedOptions = document.getElementById('logged-options');
            const guestOptions = document.getElementById('guest-options');

            if (currentUser) {
                loggedOptions.classList.remove('hidden');
                guestOptions.classList.add('hidden');
            } else {
                loggedOptions.classList.add('hidden');
                guestOptions.classList.remove('hidden');
            }
        }

        /**
         * Faz logout do usuário
         */
        async function handleLogout() {
            if (currentUser && window.dataSdk) {
                const result = await window.dataSdk.delete(currentUser);
                if (result.isOk) {
                    currentUser = null;
                    userAddresses = [];
                    orders = [];
                    cart = [];
                    updateCartUI();
                    showMessage('Você saiu da sua conta com sucesso!', 'success');
                    showSection('menu');
                } else {
                    showMessage('Erro ao sair da conta', 'error');
                }
            }
        }

        // ===================================
        // MENSAGENS DE FEEDBACK
        // ===================================
        
        /**
         * Exibe mensagem temporária na tela
         * @param {string} message - Texto da mensagem
         * @param {string} type - Tipo da mensagem (success ou error)
         */
        function showMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
                type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            // Remover após 3 segundos
            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }
    {function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'99ca7bc2454c034b',t:'MTc2MjgyOTQ0MC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}}