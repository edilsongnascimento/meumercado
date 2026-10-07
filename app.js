"use strict";

const NOME_BANCO = "meuMercado";
const VERSAO_BANCO = 1;
const CHAVE_ESTADO = "principal";
const CATEGORIAS_INICIAIS = ["Mercearia", "Hortifruti", "Laticínios", "Carnes", "Limpeza", "Higiene", "Bebidas", "Outros"];
let estado = {
    products: [],
    supermarkets: [],
    categories: CATEGORIAS_INICIAIS.map(function (name) { return { id: criarId(), name: name }; }),
    shoppingList: [],
    purchases: [],
    lastSupermarketId: ""
};
let mesListaSelecionado = obterMesAtual();
const categoriasExpandidas = new Set();
let bancoPromise;
let scannerStream = null;
let scannerFrame = null;
let campoScanner = null;

function criarId() {
    return (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function abrirBanco() {
    if (!("indexedDB" in window)) {
        return Promise.reject(new Error("Este navegador não oferece armazenamento local compatível."));
    }
    if (!bancoPromise) {
        bancoPromise = new Promise(function (resolve, reject) {
            const request = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
            request.onupgradeneeded = function () {
                if (!request.result.objectStoreNames.contains("estado")) {
                    request.result.createObjectStore("estado", { keyPath: "id" });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }
    return bancoPromise;
}

async function lerEstado() {
    const db = await abrirBanco();
    return new Promise(function (resolve, reject) {
        const request = db.transaction("estado", "readonly").objectStore("estado").get(CHAVE_ESTADO);
        request.onsuccess = function () { resolve(request.result ? request.result.data : null); };
        request.onerror = function () { reject(request.error); };
    });
}

async function gravarEstado() {
    const db = await abrirBanco();
    return new Promise(function (resolve, reject) {
        const transaction = db.transaction("estado", "readwrite");
        transaction.objectStore("estado").put({ id: CHAVE_ESTADO, data: estado });
        transaction.oncomplete = resolve;
        transaction.onerror = function () { reject(transaction.error); };
        transaction.onabort = function () { reject(transaction.error || new Error("Não foi possível salvar os dados.")); };
    });
}

function definirStatusBackup(texto, erro) {
    const status = document.getElementById("status-backup");
    status.textContent = texto;
    status.style.color = erro ? "#b42318" : "";
}

async function salvar() {
    try {
        await gravarEstado();
        definirStatusBackup("Dados salvos automaticamente neste dispositivo.");
    } catch (erro) {
        console.error("Não foi possível salvar os dados:", erro);
        definirStatusBackup("Falha ao salvar. Verifique o espaço e as permissões do navegador.", true);
    }
}

function validarEstado(dados) {
    const chaves = ["products", "supermarkets", "categories", "shoppingList", "purchases"];
    if (!dados || typeof dados !== "object" || chaves.some(function (key) { return !Array.isArray(dados[key]); })) {
        throw new Error("O arquivo não contém um backup Meu Mercado válido.");
    }
    const idsPorColecao = {};
    chaves.forEach(function (key) {
        idsPorColecao[key] = new Set();
        dados[key].forEach(function (item) {
            if (!item || typeof item.id !== "string" || !item.id || idsPorColecao[key].has(item.id)) {
                throw new Error("O backup contém um registro inválido.");
            }
            idsPorColecao[key].add(item.id);
        });
    });
    const textoValido = function (value) { return typeof value === "string"; };
    if (
        dados.products.some(function (item) {
            return !textoValido(item.name) || !item.name.trim() ||
                !textoValido(item.barcode) || !textoValido(item.categoryId) ||
                (item.categoryId && !idsPorColecao.categories.has(item.categoryId));
        }) ||
        dados.supermarkets.some(function (item) { return !textoValido(item.name) || !item.name.trim(); }) ||
        dados.categories.some(function (item) { return !textoValido(item.name) || !item.name.trim(); }) ||
        dados.shoppingList.some(function (item) {
            return !textoValido(item.productId) || !idsPorColecao.products.has(item.productId) ||
                !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
                typeof item.bought !== "boolean" ||
                (item.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.month));
        }) ||
        dados.purchases.some(function (item) {
            return !textoValido(item.productId) || !idsPorColecao.products.has(item.productId) ||
                !Number.isFinite(Number(item.price)) || Number(item.price) <= 0 ||
                (item.quantity !== undefined && (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) ||
                !textoValido(item.supermarketId) || !textoValido(item.date) ||
                (item.supermarketId && !idsPorColecao.supermarkets.has(item.supermarketId)) ||
                !Number.isFinite(new Date(item.date).getTime());
        })
    ) {
        throw new Error("O backup contém dados inválidos ou referências inexistentes.");
    }
    const validado = JSON.parse(JSON.stringify(dados));
    validado.shoppingList.forEach(function (item) {
        if (!item.month) item.month = obterMesAtual();
    });
    validado.purchases.forEach(function (item) {
        if (item.quantity === undefined) item.quantity = 1;
    });
    validado.lastSupermarketId = typeof dados.lastSupermarketId === "string" &&
        idsPorColecao.supermarkets.has(dados.lastSupermarketId)
        ? dados.lastSupermarketId
        : "";
    return validado;
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarQuantidade(valor) {
    return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function textoNormalizado(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function obterMesAtual() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function adicionarMes(mes, quantidade) {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const data = new Date(ano, numeroMes - 1 + quantidade, 1);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function formatarMes(mes) {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const nome = new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric"
    }).format(new Date(ano, numeroMes - 1, 1));
    return nome.charAt(0).toLocaleUpperCase("pt-BR") + nome.slice(1);
}

function obterPrecoMaisRecente(productId) {
    return estado.purchases
        .filter(function (item) { return item.productId === productId; })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })[0] || null;
}

function obterProduto(productId) {
    return estado.products.find(function (item) { return item.id === productId; });
}

function obterSupermercado(supermarketId) {
    return estado.supermarkets.find(function (item) { return item.id === supermarketId; });
}

function buscarProdutos(termo) {
    const query = textoNormalizado(termo);
    if (!query) return [];
    return estado.products.filter(function (product) {
        return textoNormalizado(product.name).includes(query) || String(product.barcode || "").includes(query);
    }).slice(0, 8);
}

function criarBotao(texto, classe, rotulo, acao) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = classe;
    button.textContent = texto;
    button.setAttribute("aria-label", rotulo);
    button.addEventListener("click", acao);
    return button;
}

function renderizarSugestoes(campo, container, aoSelecionar) {
    const produtos = buscarProdutos(campo.value);
    container.replaceChildren();
    container.hidden = produtos.length === 0;
    produtos.forEach(function (product) {
        const button = document.createElement("button");
        const info = document.createElement("span");
        const name = document.createElement("strong");
        const details = document.createElement("small");
        const latest = obterPrecoMaisRecente(product.id);
        button.type = "button";
        button.className = "sugestao";
        name.textContent = product.name;
        details.textContent = product.barcode ? `Código ${product.barcode}` : "Sem código de barras";
        info.append(name, details);
        button.appendChild(info);
        if (latest && container.id === "sugestoes-compra") {
            const price = document.createElement("strong");
            price.textContent = formatarMoeda(latest.price);
            button.appendChild(price);
        }
        button.addEventListener("click", function () { aoSelecionar(product); });
        container.appendChild(button);
    });
}

function adicionarALista(product, quantity) {
    const existente = estado.shoppingList.find(function (item) {
        return item.productId === product.id && item.month === mesListaSelecionado && !item.bought;
    });
    if (existente) {
        existente.quantity = Number(existente.quantity) + Number(quantity);
    } else {
        estado.shoppingList.push({
            id: criarId(),
            productId: product.id,
            quantity: Number(quantity),
            bought: false,
            month: mesListaSelecionado
        });
    }
    document.getElementById("busca-lista").value = "";
    document.getElementById("quantidade-lista").value = "1";
    document.getElementById("sugestoes-lista").hidden = true;
    atualizarInterface();
    salvar();
}

function renderizarLista() {
    const container = document.getElementById("lista-compras");
    const vazio = document.getElementById("vazio-lista");
    const seletorMes = document.getElementById("mes-lista");
    container.replaceChildren();
    const itens = estado.shoppingList.filter(function (item) {
        return item.month === mesListaSelecionado;
    }).sort(function (a, b) {
        return Number(a.bought) - Number(b.bought);
    });
    vazio.hidden = itens.length > 0;
    const quantidadeAtiva = itens.filter(function (item) { return !item.bought; }).length;
    document.getElementById("contador-lista").textContent = `${quantidadeAtiva} ${quantidadeAtiva === 1 ? "item" : "itens"}`;
    const totalEstimado = itens.reduce(function (total, item) {
        const preco = obterPrecoMaisRecente(item.productId);
        return total + (preco ? Number(preco.price) * Number(item.quantity) : 0);
    }, 0);
    document.getElementById("total-estimado").textContent = formatarMoeda(totalEstimado);
    const mesesDisponiveis = new Set([mesListaSelecionado]);
    for (let diferenca = -12; diferenca <= 12; diferenca += 1) {
        mesesDisponiveis.add(adicionarMes(obterMesAtual(), diferenca));
    }
    estado.shoppingList.forEach(function (item) { mesesDisponiveis.add(item.month); });
    seletorMes.replaceChildren();
    Array.from(mesesDisponiveis).sort().reverse().forEach(function (mes) {
        seletorMes.appendChild(new Option(formatarMes(mes), mes));
    });
    seletorMes.value = mesListaSelecionado;

    const grupos = new Map();
    itens.forEach(function (item) {
        const product = obterProduto(item.productId);
        if (!product) return;
        const categoria = estado.categories.find(function (entry) {
            return entry.id === product.categoryId;
        });
        const chave = categoria ? categoria.id : "sem-categoria";
        if (!grupos.has(chave)) {
            grupos.set(chave, {
                id: chave,
                nome: categoria ? categoria.name : "Sem categoria",
                itens: []
            });
        }
        grupos.get(chave).itens.push(item);
    });
    const ordemCategorias = estado.categories
        .map(function (categoria) { return categoria.id; })
        .concat("sem-categoria");
    Array.from(grupos.values())
        .sort(function (a, b) { return ordemCategorias.indexOf(a.id) - ordemCategorias.indexOf(b.id); })
        .forEach(function (grupo, indice) {
            const secao = document.createElement("section");
            const titulo = document.createElement("button");
            const nome = document.createElement("strong");
            const quantidade = document.createElement("span");
            const produtos = document.createElement("div");
            const expandida = categoriasExpandidas.has(grupo.id);
            const produtosId = `itens-categoria-${indice}`;

            secao.className = "categoria-grupo";
            nome.textContent = grupo.nome;
            quantidade.textContent = `${grupo.itens.length} ${grupo.itens.length === 1 ? "produto" : "produtos"}`;
            titulo.type = "button";
            titulo.className = "categoria-toggle";
            titulo.setAttribute("aria-expanded", String(expandida));
            titulo.setAttribute("aria-controls", produtosId);
            titulo.append(nome, quantidade);
            produtos.id = produtosId;
            produtos.className = "categoria-produtos lista-itens";
            produtos.hidden = !expandida;

            grupo.itens.forEach(function (item) {
                const product = obterProduto(item.productId);
                const row = document.createElement("div");
                const info = document.createElement("div");
                const title = document.createElement("strong");
                const details = document.createElement("small");
                const latest = obterPrecoMaisRecente(product.id);
                row.className = `item-compra${item.bought ? " comprado" : ""}`;
                title.textContent = product.name;
                details.textContent = `Qtd.: ${formatarQuantidade(item.quantity)}${latest ? ` · Último preço: ${formatarMoeda(latest.price)} / un.` : ""}`;
                info.className = "item-detalhes";
                info.append(title, details);
                row.appendChild(criarBotao(item.bought ? "✓" : "", "check-item", item.bought ? "Marcar como não comprado" : "Marcar como comprado", function () {
                    item.bought = !item.bought;
                    atualizarInterface();
                    salvar();
                }));
                row.appendChild(info);
                row.appendChild(criarBotao("⌫", "botao-lixeira", `Remover ${product.name} da lista`, function () {
                    estado.shoppingList = estado.shoppingList.filter(function (entry) { return entry.id !== item.id; });
                    atualizarInterface();
                    salvar();
                }));
                produtos.appendChild(row);
            });

            titulo.addEventListener("click", function () {
                if (categoriasExpandidas.has(grupo.id)) categoriasExpandidas.delete(grupo.id);
                else categoriasExpandidas.add(grupo.id);
                atualizarInterface();
            });
            secao.append(titulo, produtos);
            container.appendChild(secao);
    });
}

function copiarListaParaProximoMes() {
    const itensOrigem = estado.shoppingList.filter(function (item) {
        return item.month === mesListaSelecionado;
    });
    if (itensOrigem.length === 0) {
        alert("A lista deste mês está vazia. Adicione produtos antes de copiá-la.");
        return;
    }

    const mesDestino = adicionarMes(mesListaSelecionado, 1);
    const produtosDestino = new Set(
        estado.shoppingList
            .filter(function (item) { return item.month === mesDestino; })
            .map(function (item) { return item.productId; })
    );
    const itensNovos = itensOrigem.filter(function (item) {
        return !produtosDestino.has(item.productId);
    });
    if (itensNovos.length === 0) {
        alert("O próximo mês já contém todos os produtos desta lista.");
        return;
    }

    itensNovos.forEach(function (item) {
        estado.shoppingList.push({
            id: criarId(),
            productId: item.productId,
            quantity: Number(item.quantity),
            bought: false,
            month: mesDestino
        });
    });
    mesListaSelecionado = mesDestino;
    atualizarInterface();
    salvar();
}

function selecionarProdutoCompra(product) {
    document.getElementById("busca-compra").value = product.name;
    document.getElementById("sugestoes-compra").hidden = true;
    document.getElementById("form-registro-compra").hidden = false;
    const selected = document.getElementById("produto-selecionado");
    const latest = obterPrecoMaisRecente(product.id);
    selected.replaceChildren();
    const name = document.createElement("span");
    const detail = document.createElement("small");
    name.textContent = product.name;
    detail.textContent = latest
        ? `Último preço: ${formatarMoeda(latest.price)} por unidade · ${new Date(latest.date).toLocaleDateString("pt-BR")}${obterSupermercado(latest.supermarketId) ? ` · ${obterSupermercado(latest.supermarketId).name}` : ""}`
        : "Ainda não há preço registrado para este produto.";
    selected.append(name, detail);
    selected.hidden = false;
    document.getElementById("form-registro-compra").dataset.productId = product.id;
    document.getElementById("quantidade-compra").value = "1";
    document.getElementById("preco-compra").value = latest ? Number(latest.price).toFixed(2) : "";
    document.getElementById("btn-registrar-compra").disabled = false;
}

function renderizarHistorico() {
    const container = document.getElementById("historico-compras");
    const vazio = document.getElementById("vazio-historico");
    container.replaceChildren();
    const purchases = [...estado.purchases].sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 30);
    const comprasValidas = purchases.filter(function (purchase) {
        return Boolean(obterProduto(purchase.productId));
    });
    vazio.hidden = comprasValidas.length > 0;
    const grupos = new Map();
    comprasValidas.forEach(function (purchase) {
        const product = obterProduto(purchase.productId);
        const categoria = estado.categories.find(function (entry) {
            return entry.id === product.categoryId;
        });
        const chave = categoria ? categoria.id : "sem-categoria";
        if (!grupos.has(chave)) {
            grupos.set(chave, {
                id: chave,
                nome: categoria ? categoria.name : "Sem categoria",
                compras: []
            });
        }
        grupos.get(chave).compras.push(purchase);
    });
    const ordemCategorias = estado.categories
        .map(function (categoria) { return categoria.id; })
        .concat("sem-categoria");
    Array.from(grupos.values())
        .sort(function (a, b) { return ordemCategorias.indexOf(a.id) - ordemCategorias.indexOf(b.id); })
        .forEach(function (grupo, indice) {
            const secao = document.createElement("section");
            const titulo = document.createElement("button");
            const nome = document.createElement("strong");
            const quantidade = document.createElement("span");
            const comprasGrupo = document.createElement("div");
            const expandida = categoriasExpandidas.has(grupo.id);
            const comprasId = `historico-itens-categoria-${indice}`;

            secao.className = "categoria-grupo";
            nome.textContent = grupo.nome;
            quantidade.textContent = `${grupo.compras.length} ${grupo.compras.length === 1 ? "compra" : "compras"}`;
            titulo.type = "button";
            titulo.className = "categoria-toggle";
            titulo.setAttribute("aria-expanded", String(expandida));
            titulo.setAttribute("aria-controls", comprasId);
            titulo.append(nome, quantidade);
            comprasGrupo.id = comprasId;
            comprasGrupo.className = "categoria-produtos lista-itens";
            comprasGrupo.hidden = !expandida;

            grupo.compras.forEach(function (purchase) {
                const product = obterProduto(purchase.productId);
                const row = document.createElement("div");
                const info = document.createElement("div");
                const name = document.createElement("strong");
                const details = document.createElement("small");
                const price = document.createElement("strong");
                const supermarket = obterSupermercado(purchase.supermarketId);
                row.className = "registro-compra";
                name.textContent = product.name;
                details.textContent = `Qtd.: ${formatarQuantidade(purchase.quantity || 1)} · ${supermarket ? supermarket.name : "Supermercado não informado"} · ${new Date(purchase.date).toLocaleDateString("pt-BR")}`;
                price.textContent = `${formatarMoeda(purchase.price)} / un.`;
                info.append(name, details);
                row.append(info, price);
                comprasGrupo.appendChild(row);
            });

            titulo.addEventListener("click", function () {
                if (categoriasExpandidas.has(grupo.id)) categoriasExpandidas.delete(grupo.id);
                else categoriasExpandidas.add(grupo.id);
                atualizarInterface();
            });
            secao.append(titulo, comprasGrupo);
            container.appendChild(secao);
        });
}

function renderizarOpcoes() {
    const categoria = document.getElementById("categoria-produto");
    const supermercado = document.getElementById("supermercado-compra");
    const categoryValue = categoria.value;
    const supermarketValue = estado.lastSupermarketId || supermercado.value ||
        (estado.purchases.slice().sort(function (a, b) {
            return new Date(b.date) - new Date(a.date);
        }).find(function (purchase) {
            return purchase.supermarketId && obterSupermercado(purchase.supermarketId);
        }) || {}).supermarketId || "";
    categoria.replaceChildren();
    estado.categories.forEach(function (item) {
        const option = new Option(item.name, item.id);
        categoria.appendChild(option);
    });
    if (estado.categories.some(function (item) { return item.id === categoryValue; })) categoria.value = categoryValue;
    supermercado.replaceChildren(new Option(
        estado.supermarkets.length ? "Selecione um supermercado" : "Cadastre um supermercado primeiro",
        ""
    ));
    estado.supermarkets.forEach(function (item) { supermercado.appendChild(new Option(item.name, item.id)); });
    if (estado.supermarkets.some(function (item) { return item.id === supermarketValue; })) {
        supermercado.value = supermarketValue;
        estado.lastSupermarketId = supermarketValue;
    } else {
        estado.lastSupermarketId = "";
    }
    renderizarCadastros("cadastro-produtos", estado.products, function (item) {
        const category = estado.categories.find(function (entry) { return entry.id === item.categoryId; });
        return `${item.name}${category ? ` · ${category.name}` : ""}${item.barcode ? ` · ${item.barcode}` : ""}`;
    }, excluirProduto);
    renderizarCadastros("cadastro-supermercados", estado.supermarkets, function (item) { return item.name; }, excluirSupermercado);
    renderizarCadastros("cadastro-categorias", estado.categories, function (item) { return item.name; }, excluirCategoria);
}

function renderizarCadastros(id, items, legenda, excluir) {
    const container = document.getElementById(id);
    container.replaceChildren();
    items.forEach(function (item) {
        const row = document.createElement("div");
        const text = document.createElement("span");
        text.textContent = legenda(item);
        row.className = "linha-cadastro";
        row.append(text, criarBotao("⌫", "", `Excluir ${legenda(item)}`, function () { excluir(item); }));
        container.appendChild(row);
    });
}

function atualizarInterface() {
    renderizarLista();
    renderizarHistorico();
    renderizarOpcoes();
}

function excluirProduto(product) {
    if (estado.shoppingList.some(function (item) { return item.productId === product.id; }) ||
        estado.purchases.some(function (item) { return item.productId === product.id; })) {
        alert("Este produto está na lista ou no histórico de compras e não pode ser excluído.");
        return;
    }
    estado.products = estado.products.filter(function (item) { return item.id !== product.id; });
    atualizarInterface();
    salvar();
}

function excluirSupermercado(supermarket) {
    if (estado.purchases.some(function (item) { return item.supermarketId === supermarket.id; })) {
        alert("Este supermercado aparece no histórico de compras e não pode ser excluído.");
        return;
    }
    estado.supermarkets = estado.supermarkets.filter(function (item) { return item.id !== supermarket.id; });
    atualizarInterface();
    salvar();
}

function excluirCategoria(category) {
    if (estado.products.some(function (item) { return item.categoryId === category.id; })) {
        alert("Esta categoria está sendo usada por um produto e não pode ser excluída.");
        return;
    }
    estado.categories = estado.categories.filter(function (item) { return item.id !== category.id; });
    atualizarInterface();
    salvar();
}

function abrirPagina(page) {
    ["lista", "compras", "cadastros"].forEach(function (name) {
        document.getElementById(`pagina-${name}`).hidden = name !== page;
        const button = document.querySelector(`[data-pagina="${name}"]`);
        button.classList.toggle("ativo", name === page);
        if (name === page) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
    document.getElementById("subtitulo").textContent = {
        lista: "Sua lista de compras, sempre à mão.",
        compras: "Acompanhe e compare os preços que pagou.",
        cadastros: "Gerencie produtos, supermercados e categorias."
    }[page];
}

async function iniciarScanner(inputId) {
    const dialog = document.getElementById("dialogo-scanner");
    const video = document.getElementById("video-scanner");
    const status = document.getElementById("status-scanner");
    campoScanner = document.getElementById(inputId);
    if (!("BarcodeDetector" in window)) {
        alert("A leitura de código de barras não é compatível com este navegador. Você pode digitar o código no campo de busca.");
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Não foi possível acessar a câmera. Digite o código de barras no campo.");
        return;
    }
    try {
        const formatos = await BarcodeDetector.getSupportedFormats();
        const formatosBarras = formatos.filter(function (item) {
            return ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"].includes(item);
        });
        if (formatosBarras.length === 0) throw new Error("Este navegador não oferece formatos de código de barras compatíveis.");
        const detector = new BarcodeDetector({ formats: formatosBarras });
        scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        video.srcObject = scannerStream;
        status.textContent = "Aponte a câmera para o código de barras.";
        dialog.showModal();
        await video.play();
        async function procurarCodigo() {
            if (!scannerStream || dialog.open === false) return;
            try {
                const encontrados = await detector.detect(video);
                if (encontrados.length) {
                    campoScanner.value = encontrados[0].rawValue;
                    campoScanner.dispatchEvent(new Event("input", { bubbles: true }));
                    if (campoScanner.id === "busca-compra") {
                        const product = buscarProdutos(campoScanner.value)[0];
                        if (product) selecionarProdutoCompra(product);
                    } else if (campoScanner.id === "busca-lista") {
                        const product = buscarProdutos(campoScanner.value)[0];
                        if (product) adicionarALista(product, Number(document.getElementById("quantidade-lista").value) || 1);
                    }
                    fecharScanner();
                    return;
                }
            } catch (erro) {
                console.error("Falha na leitura do código:", erro);
                status.textContent = "Falha ao ler o código. Tente novamente ou digite-o.";
            }
            scannerFrame = requestAnimationFrame(procurarCodigo);
        }
        scannerFrame = requestAnimationFrame(procurarCodigo);
    } catch (erro) {
        fecharScanner();
        console.error("Não foi possível iniciar a câmera:", erro);
        alert(erro.name === "NotAllowedError"
            ? "A permissão da câmera foi negada. Autorize o acesso ou digite o código de barras."
            : `Não foi possível iniciar a leitura: ${erro.message}`);
    }
}

function fecharScanner() {
    if (scannerFrame !== null) cancelAnimationFrame(scannerFrame);
    scannerFrame = null;
    if (scannerStream) scannerStream.getTracks().forEach(function (track) { track.stop(); });
    scannerStream = null;
    document.getElementById("video-scanner").srcObject = null;
    const dialog = document.getElementById("dialogo-scanner");
    if (dialog.open) dialog.close();
}

function exportarBackup() {
    const blob = new Blob([JSON.stringify({ app: "Meu Mercado", versao: 1, atualizadoEm: new Date().toISOString(), dados: estado }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meu-mercado-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    definirStatusBackup("Backup baixado. Guarde-o em um local seguro.");
}

async function importarBackup(file) {
    try {
        const content = JSON.parse(await file.text());
        const imported = validarEstado(content.dados);
        if (!confirm("Restaurar este backup? Os dados atuais serão substituídos.")) return;
        estado = imported;
        atualizarInterface();
        await salvar();
        definirStatusBackup("Backup restaurado.");
    } catch (erro) {
        console.error("Não foi possível restaurar o backup:", erro);
        definirStatusBackup(`Não foi possível restaurar o backup: ${erro.message}`, true);
    }
}

function configurarEventos() {
    document.querySelectorAll("[data-pagina]").forEach(function (button) {
        button.addEventListener("click", function () { abrirPagina(button.dataset.pagina); });
    });
    document.getElementById("mes-lista").addEventListener("change", function (event) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(event.currentTarget.value)) return;
        mesListaSelecionado = event.currentTarget.value;
        categoriasExpandidas.clear();
        atualizarInterface();
    });
    document.getElementById("copiar-proximo-mes").addEventListener("click", copiarListaParaProximoMes);
    document.getElementById("busca-lista").addEventListener("input", function (event) {
        renderizarSugestoes(event.currentTarget, document.getElementById("sugestoes-lista"), function (product) {
            adicionarALista(product, Number(document.getElementById("quantidade-lista").value) || 1);
        });
    });
    document.getElementById("form-item-lista").addEventListener("submit", function (event) {
        event.preventDefault();
        const product = buscarProdutos(document.getElementById("busca-lista").value)[0];
        const quantity = Number(document.getElementById("quantidade-lista").value);
        if (!product) {
            alert("Cadastre o produto na página Cadastros antes de adicioná-lo à lista.");
            abrirPagina("cadastros");
            document.getElementById("nome-produto").focus();
            return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            alert("Informe uma quantidade válida.");
            return;
        }
        adicionarALista(product, quantity);
    });
    document.getElementById("busca-compra").addEventListener("input", function (event) {
        document.getElementById("form-registro-compra").hidden = true;
        document.getElementById("produto-selecionado").hidden = true;
        renderizarSugestoes(event.currentTarget, document.getElementById("sugestoes-compra"), selecionarProdutoCompra);
    });
    document.getElementById("form-registro-compra").addEventListener("submit", function (event) {
        event.preventDefault();
        const form = event.currentTarget;
        const productId = form.dataset.productId;
        const price = Number(document.getElementById("preco-compra").value);
        const quantity = Number(document.getElementById("quantidade-compra").value);
        const supermarketId = document.getElementById("supermercado-compra").value;
        if (
            !obterProduto(productId) ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !supermarketId
        ) {
            alert("Selecione um produto e um supermercado e informe uma quantidade e um preço válidos.");
            return;
        }
        estado.lastSupermarketId = supermarketId;
        estado.purchases.push({
            id: criarId(),
            productId: productId,
            price: price,
            quantity: quantity,
            supermarketId: supermarketId,
            date: new Date().toISOString()
        });
        const itemLista = estado.shoppingList.find(function (item) {
            return item.productId === productId && item.month === obterMesAtual() && !item.bought;
        });
        if (itemLista) {
            itemLista.bought = true;
        } else if (!estado.shoppingList.some(function (item) {
            return item.productId === productId && item.month === obterMesAtual();
        })) {
            estado.shoppingList.push({
                id: criarId(),
                productId: productId,
                quantity: 1,
                bought: true,
                month: obterMesAtual()
            });
        }
        form.reset();
        document.getElementById("quantidade-compra").value = "1";
        form.hidden = true;
        document.getElementById("produto-selecionado").hidden = true;
        document.getElementById("busca-compra").value = "";
        atualizarInterface();
        salvar();
    });
    document.getElementById("supermercado-compra").addEventListener("change", function (event) {
        estado.lastSupermarketId = event.currentTarget.value;
        salvar();
    });
    document.getElementById("form-produto").addEventListener("submit", function (event) {
        event.preventDefault();
        const name = document.getElementById("nome-produto").value.trim();
        const barcode = document.getElementById("codigo-produto").value.trim();
        if (barcode && estado.products.some(function (item) { return item.barcode === barcode; })) {
            alert("Já existe um produto cadastrado com esse código de barras.");
            return;
        }
        estado.products.push({ id: criarId(), name: name, barcode: barcode, categoryId: document.getElementById("categoria-produto").value });
        event.currentTarget.reset();
        atualizarInterface();
        salvar();
    });
    document.getElementById("form-supermercado").addEventListener("submit", function (event) {
        event.preventDefault();
        const name = document.getElementById("nome-supermercado").value.trim();
        if (estado.supermarkets.some(function (item) { return textoNormalizado(item.name) === textoNormalizado(name); })) {
            alert("Esse supermercado já está cadastrado.");
            return;
        }
        estado.supermarkets.push({ id: criarId(), name: name });
        event.currentTarget.reset();
        atualizarInterface();
        salvar();
    });
    document.getElementById("form-categoria").addEventListener("submit", function (event) {
        event.preventDefault();
        const name = document.getElementById("nome-categoria").value.trim();
        if (estado.categories.some(function (item) { return textoNormalizado(item.name) === textoNormalizado(name); })) {
            alert("Essa categoria já está cadastrada.");
            return;
        }
        estado.categories.push({ id: criarId(), name: name });
        event.currentTarget.reset();
        atualizarInterface();
        salvar();
    });
    document.querySelectorAll("[data-scanner]").forEach(function (button) {
        button.addEventListener("click", function () { iniciarScanner(button.dataset.scanner); });
    });
    document.getElementById("fechar-scanner").addEventListener("click", fecharScanner);
    document.getElementById("dialogo-scanner").addEventListener("close", fecharScanner);
    document.getElementById("btn-exportar").addEventListener("click", exportarBackup);
    document.getElementById("btn-importar").addEventListener("click", function () {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", function () {
            if (input.files && input.files[0]) importarBackup(input.files[0]);
        }, { once: true });
        input.click();
    });
}

document.addEventListener("DOMContentLoaded", async function () {
    let criarEstadoInicial = false;
    let migrarListaAntiga = false;
    try {
        const saved = await lerEstado();
        if (saved) {
            migrarListaAntiga = Array.isArray(saved.shoppingList) &&
                saved.shoppingList.some(function (item) { return !item.month; });
            estado = validarEstado(saved);
        }
        else criarEstadoInicial = true;
    } catch (erro) {
        console.error("Não foi possível carregar o armazenamento local:", erro);
        definirStatusBackup("Não foi possível carregar os dados salvos neste dispositivo.", true);
    }
    mesListaSelecionado = obterMesAtual();
    estado.shoppingList.forEach(function (item) {
        if (!item.month) item.month = mesListaSelecionado;
    });
    configurarEventos();
    atualizarInterface();
    if (!window.isSecureContext && location.hostname !== "localhost") {
        document.querySelectorAll("[data-scanner]").forEach(function (button) { button.disabled = true; });
    }
    if (criarEstadoInicial || migrarListaAntiga) await salvar();
});
