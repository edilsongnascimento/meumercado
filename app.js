// =====================================================
// MEU MERCADO
// APP.JS COMPLETO
// =====================================================

const CHAVE_PRODUTOS = "meuMercadoProdutos";
const CHAVE_LISTA = "meuMercadoLista";
const CHAVE_CATEGORIAS = "meuMercadoCategorias";

let produtos = [];
let lista = [];

let produtoEditandoId = null;

let leitor = null;
let scannerAtivo = false;
let moduloZXing = null;


// =====================================================
// CATEGORIAS
// =====================================================

const categorias = {
    "Açougue": "🥩",
    "Aves": "🐔",
    "Peixaria": "🐟",
    "Hortifruti": "🥬",
    "Laticínios": "🥛",
    "Ovos": "🥚",
    "Padaria": "🍞",
    "Mercearia": "🥫",
    "Massas e grãos": "🍝",
    "Bebidas": "🥤",
    "Congelados": "🧊",
    "Frios e embutidos": "🥓",
    "Chocolates e doces": "🍫",
    "Biscoitos e snacks": "🍪",
    "Cafés e matinais": "☕",
    "Temperos e condimentos": "🧂",
    "Enlatados e conservas": "🥫",
    "Higiene pessoal": "🧴",
    "Limpeza": "🧹",
    "Papelaria e descartáveis": "🧻",
    "Bebês": "👶",
    "Pet shop": "🐶",
    "Produtos naturais": "🌿",
    "Utilidades domésticas": "🏠",
    "Lavanderia": "🧺",
    "Perfumaria": "🧴",
    "Outros": "📦"
};


// =====================================================
// ORDEM DOS SETORES
// =====================================================

const ordemCategorias = [
    "Açougue",
    "Aves",
    "Peixaria",
    "Hortifruti",
    "Laticínios",
    "Ovos",
    "Padaria",
    "Mercearia",
    "Massas e grãos",
    "Bebidas",
    "Congelados",
    "Frios e embutidos",
    "Chocolates e doces",
    "Biscoitos e snacks",
    "Cafés e matinais",
    "Temperos e condimentos",
    "Enlatados e conservas",
    "Higiene pessoal",
    "Limpeza",
    "Papelaria e descartáveis",
    "Bebês",
    "Pet shop",
    "Produtos naturais",
    "Utilidades domésticas",
    "Lavanderia",
    "Perfumaria",
    "Outros"
];


// =====================================================
// LOCAL STORAGE
// =====================================================

function podeUsarLocalStorage() {

    try {

        return typeof localStorage !== "undefined";

    } catch (erro) {

        return false;

    }

}


function preencherCategorias() {

    const campoCategoria = document.getElementById("categoriaProduto");

    if (!campoCategoria) {
        return;
    }

    const selecionada = campoCategoria.value || "Mercearia";
    campoCategoria.replaceChildren();

    const nomes = [
        ...ordemCategorias,
        ...Object.keys(categorias)
            .filter(nome => !ordemCategorias.includes(nome))
            .sort((a, b) => a.localeCompare(b, "pt-BR"))
    ];

    nomes.forEach(nome => {
        if (!categorias[nome]) {
            return;
        }

        const opcao = document.createElement("option");
        opcao.value = nome;
        opcao.textContent = `${categorias[nome]} ${nome}`;
        campoCategoria.appendChild(opcao);
    });

    campoCategoria.value = nomes.includes(selecionada)
        ? selecionada
        : "Mercearia";

}


function adicionarCategoria() {

    const campoNome = document.getElementById("nomeNovaCategoria");
    const nome = campoNome ? campoNome.value.trim() : "";

    if (!nome) {
        mostrarMensagem("Digite o nome da categoria.");
        if (campoNome) {
            campoNome.focus();
        }
        return;
    }

    const existente = Object.keys(categorias)
        .find(categoria => categoria.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));

    if (existente) {
        mostrarMensagem("Essa categoria já existe.");
        document.getElementById("categoriaProduto").value = existente;
        return;
    }

    Object.defineProperty(categorias, nome, {
        value: "📦",
        enumerable: true,
        configurable: true,
        writable: true
    });
    preencherCategorias();
    document.getElementById("categoriaProduto").value = nome;

    if (campoNome) {
        campoNome.value = "";
    }

    salvarDados();
    mostrarMensagem("Categoria cadastrada.");

}


// =====================================================
// CARREGAR DADOS
// =====================================================

function carregarDados() {

    if (!podeUsarLocalStorage()) {

        produtos = [];
        lista = [];

        return;

    }


    try {

        produtos =
            JSON.parse(
                localStorage.getItem(CHAVE_PRODUTOS)
            ) || [];


        lista =
            JSON.parse(
                localStorage.getItem(CHAVE_LISTA)
            ) || [];

        const categoriasSalvas =
            JSON.parse(
                localStorage.getItem(CHAVE_CATEGORIAS)
            ) || {};

        if (
            categoriasSalvas &&
            typeof categoriasSalvas === "object" &&
            !Array.isArray(categoriasSalvas)
        ) {
            Object.entries(categoriasSalvas).forEach(
                ([nome, emoji]) => {
                    if (
                        typeof nome === "string" &&
                        nome.trim() &&
                        typeof emoji === "string" &&
                        !Object.prototype.hasOwnProperty.call(categorias, nome.trim())
                    ) {
                        Object.defineProperty(categorias, nome.trim(), {
                            value: emoji || "📦",
                            enumerable: true,
                            configurable: true,
                            writable: true
                        });
                    }
                }
            );
        }


    } catch (erro) {

        console.error(
            "Erro ao carregar dados:",
            erro
        );

        produtos = [];
        lista = [];

    }


    // =================================================
    // CORRIGE / COMPLETA PRODUTOS ANTIGOS
    // =================================================

    produtos = produtos.map(
        (produto, indice) => {

            return {

                id:
                    produto.id ||
                    Date.now() + indice,

                nome:
                    produto.nome ||
                    "Produto",

                categoria:
                    produto.categoria &&
                    categorias[produto.categoria]
                        ? produto.categoria
                        : "Outros",

                codigoBarras:
                    produto.codigoBarras || "",

                ultimoPreco:
                    Number(
                        produto.ultimoPreco !== undefined
                            ? produto.ultimoPreco
                            : (
                                produto.preco || 0
                            )
                    ),

                precoAtual:
                    Number(
                        produto.precoAtual !== undefined
                            ? produto.precoAtual
                            : (
                                produto.preco || 0
                            )
                    ),

                comprado:
                    produto.comprado === true

            };

        }
    );


    // =================================================
    // RECUPERA MARCAÇÕES ANTIGAS
    // =================================================

    const marcadosAntigos = {};


    if (Array.isArray(lista)) {

        lista.forEach(
            item => {

                if (
                    item &&
                    item.nome
                ) {

                    marcadosAntigos[
                        item.nome
                            .toLowerCase()
                    ] =
                        Boolean(
                            item.comprado
                        );

                }

            }
        );

    }


    produtos.forEach(
        produto => {

            const nome =
                produto.nome
                    .toLowerCase();


            if (
                marcadosAntigos[nome]
            ) {

                produto.comprado = true;

            }

        }
    );


    salvarDados();

}


// =====================================================
// SALVAR DADOS
// =====================================================

function salvarDados() {

    if (!podeUsarLocalStorage()) {

        return;

    }


    try {

        localStorage.setItem(
            CHAVE_PRODUTOS,
            JSON.stringify(produtos)
        );


        localStorage.setItem(
            CHAVE_LISTA,
            JSON.stringify(lista)
        );

        const categoriasPersonalizadas = {};
        Object.keys(categorias).forEach(nome => {
            if (!ordemCategorias.includes(nome)) {
                categoriasPersonalizadas[nome] = categorias[nome];
            }
        });
        localStorage.setItem(
            CHAVE_CATEGORIAS,
            JSON.stringify(categoriasPersonalizadas)
        );


    } catch (erro) {

        console.error(
            "Erro ao salvar:",
            erro
        );

    }

}


// =====================================================
// FORMATAÇÃO DE PREÇO
// =====================================================

function moeda(valor) {

    return Number(
        valor || 0
    ).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );

}


// =====================================================
// PROTEÇÃO HTML
// =====================================================

function escapar(texto) {

    return String(texto)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


// =====================================================
// MENSAGEM
// =====================================================

function mostrarMensagem(mensagem) {

    const antiga =
        document.getElementById(
            "mensagemApp"
        );


    if (antiga) {

        antiga.remove();

    }


    const div =
        document.createElement(
            "div"
        );


    div.id =
        "mensagemApp";


    div.textContent =
        mensagem;


    div.style.position =
        "fixed";


    div.style.left =
        "50%";


    div.style.bottom =
        "20px";


    div.style.transform =
        "translateX(-50%)";


    div.style.background =
        "#16a34a";


    div.style.color =
        "white";


    div.style.padding =
        "12px 18px";


    div.style.borderRadius =
        "10px";


    div.style.fontWeight =
        "bold";


    div.style.fontSize =
        "13px";


    div.style.zIndex =
        "9999";


    div.style.boxShadow =
        "0 4px 12px rgba(0,0,0,.2)";


    document.body.appendChild(
        div
    );


    setTimeout(
        () => {

            div.remove();

        },
        2200
    );

}


// =====================================================
// MOSTRAR PRODUTOS
// =====================================================

function mostrarProdutos() {

    const container =
        document.getElementById(
            "listaProdutos"
        );


    if (!container) {

        return;

    }


    const campoPesquisa =
        document.getElementById(
            "pesquisa"
        );


    const termo =
        campoPesquisa
            ? campoPesquisa.value
                .trim()
                .toLowerCase()
            : "";


    let encontrados =
        produtos.filter(
            produto => {

                const nome =
                    String(
                        produto.nome || ""
                    ).toLowerCase();


                const codigo =
                    String(
                        produto.codigoBarras || ""
                    ).toLowerCase();


                const categoria =
                    String(
                        produto.categoria || ""
                    ).toLowerCase();


                return (

                    nome.includes(termo) ||

                    codigo.includes(termo) ||

                    categoria.includes(termo)

                );

            }
        );


    encontrados.sort(
        (a, b) => {

            if (
                a.comprado !==
                b.comprado
            ) {

                return a.comprado
                    ? 1
                    : -1;

            }


            return a.nome.localeCompare(
                b.nome,
                "pt-BR"
            );

        }
    );


    container.innerHTML = "";


    if (
        encontrados.length === 0
    ) {

        container.innerHTML = `
            <p class="lista-vazia">
                Sua lista de compras está vazia.
            </p>
        `;


        atualizarResumo();

        return;

    }


    // =================================================
    // AGRUPAR POR CATEGORIA
    // =================================================

    const grupos = Object.create(null);


    encontrados.forEach(
        produto => {

            const categoria =
                categorias[
                    produto.categoria
                ]
                    ? produto.categoria
                    : "Outros";


            if (!grupos[categoria]) {

                grupos[categoria] = [];

            }


            grupos[categoria].push(
                produto
            );

        }
    );


    // =================================================
    // CRIAR SETORES
    // =================================================

    ordemCategorias.forEach(
        categoria => {

            if (
                !grupos[categoria] ||
                grupos[categoria].length === 0
            ) {

                return;

            }


            const setor =
                document.createElement(
                    "section"
                );


            setor.className =
                "setor";


            const cabecalho =
                document.createElement(
                    "button"
                );


            cabecalho.type =
                "button";


            cabecalho.className =
                "cabecalho-setor";


            const quantidade =
                grupos[categoria].length;


            const emoji =
                categorias[categoria] ||
                "📦";


            cabecalho.innerHTML = `

                <span class="setor-nome">

                    <span>
                        ${escapar(emoji)}
                    </span>

                    <span>
                        ${escapar(categoria)}
                    </span>

                </span>


                <span class="setor-quantidade">

                    ${quantidade}

                    <span class="seta">
                        ▼
                    </span>

                </span>

            `;


            const conteudo =
                document.createElement(
                    "div"
                );


            conteudo.className =
                "conteudo-setor";


            grupos[categoria].forEach(
                produto => {

                    conteudo.appendChild(
                        criarProdutoElemento(
                            produto
                        )
                    );

                }
            );


            cabecalho.addEventListener(
                "click",
                () => {

                    setor.classList.toggle(
                        "fechado"
                    );

                }
            );


            setor.appendChild(
                cabecalho
            );


            setor.appendChild(
                conteudo
            );


            container.appendChild(
                setor
            );

        }
    );

    Object.keys(categorias)
        .filter(categoria => !ordemCategorias.includes(categoria))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .forEach(categoria => {
            if (!grupos[categoria]) {
                return;
            }

            const setor = document.createElement("section");
            setor.className = "setor";

            const cabecalho = document.createElement("button");
            cabecalho.type = "button";
            cabecalho.className = "cabecalho-setor";
            cabecalho.innerHTML = `
                <span class="setor-nome">
                    <span>${escapar(categorias[categoria] || "📦")}</span>
                    <span>${escapar(categoria)}</span>
                </span>
                <span class="setor-quantidade">
                    ${grupos[categoria].length}
                    <span class="seta">▼</span>
                </span>
            `;

            const conteudo = document.createElement("div");
            conteudo.className = "conteudo-setor";
            grupos[categoria].forEach(produto => {
                conteudo.appendChild(criarProdutoElemento(produto));
            });

            cabecalho.addEventListener("click", () => {
                setor.classList.toggle("fechado");
            });

            setor.appendChild(cabecalho);
            setor.appendChild(conteudo);
            container.appendChild(setor);
        });

    atualizarResumo();

}


// =====================================================
// CRIAR PRODUTO NA TELA
// =====================================================

function criarProdutoElemento(
    produto
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "produto" +
        (
            produto.comprado
                ? " comprado"
                : ""
        );


    item.innerHTML = `

        <button
            class="check ${
                produto.comprado
                    ? "marcado"
                    : ""
            }"
            type="button"
            title="Marcar como comprado">

            ${
                produto.comprado
                    ? "✓"
                    : ""
            }

        </button>


        <div class="produto-info">

            <strong>
                ${escapar(produto.nome)}
            </strong>

            ${
                produto.codigoBarras

                    ? `
                        <small>
                            🏷️
                            ${escapar(
                                produto.codigoBarras
                            )}
                        </small>
                    `

                    : `
                        <small>
                            Sem código de barras
                        </small>
                    `
            }

        </div>


        <div class="precos">

            <div>

                <span>
                    Último
                </span>

                <strong>
                    ${moeda(
                        produto.ultimoPreco
                    )}
                </strong>

            </div>


            <div>

                <span>
                    Atual
                </span>

                <strong
                    class="preco-atual">

                    ${moeda(
                        produto.precoAtual
                    )}

                </strong>

            </div>

        </div>


        <button
            class="btn-editar"
            type="button"
            title="Alterar preço">

            ✏️

        </button>

    `;


    const botaoCheck =
        item.querySelector(
            ".check"
        );


    botaoCheck.addEventListener(
        "click",
        () => {

            alternarComprado(
                produto.id
            );

        }
    );


    const botaoEditar =
        item.querySelector(
            ".btn-editar"
        );


    botaoEditar.addEventListener(
        "click",
        () => {

            editarPreco(
                produto.id
            );

        }
    );


    return item;

}


// =====================================================
// RESUMO
// =====================================================

function atualizarResumo() {

    const total =
        document.getElementById(
            "totalProdutos"
        );


    const comprados =
        document.getElementById(
            "totalComprados"
        );


    if (total) {

        total.textContent =
            produtos.length;

    }


    if (comprados) {

        comprados.textContent =
            produtos.filter(
                produto =>
                    produto.comprado
            ).length;

    }

}


// =====================================================
// MARCAR COMO COMPRADO
// =====================================================

function alternarComprado(
    id
) {

    const produto =
        produtos.find(
            produto =>
                produto.id === id
        );


    if (!produto) {

        return;

    }


    produto.comprado =
        !produto.comprado;


    salvarDados();


    mostrarProdutos();

}


// =====================================================
// DESMARCAR TODOS
// =====================================================

function desmarcarTodos() {

    produtos.forEach(
        produto => {

            produto.comprado =
                false;

        }
    );


    salvarDados();


    mostrarProdutos();


    mostrarMensagem(
        "Marcações limpas."
    );

}


// =====================================================
// ABRIR CADASTRO
// =====================================================

function abrirCadastro() {

    const telaLista =
        document.getElementById(
            "telaLista"
        );

    const telaCadastro =
        document.getElementById(
            "telaCadastro"
        );


    if (telaLista) {

        telaLista.classList.remove(
            "ativa"
        );

    }


    if (telaCadastro) {

        telaCadastro.classList.add(
            "ativa"
        );

    }

    const botoes = document.querySelectorAll(".nav-item");
    botoes.forEach(botao => {
        botao.classList.toggle("active", botao.textContent.includes("Novo"));
    });


    const categoria =
        document.getElementById(
            "categoriaProduto"
        );


    if (categoria) {

        categoria.value =
            "Mercearia";

    }

    preencherCategorias();

    setTimeout(
        () => {

            const nome =
                document.getElementById(
                    "nomeProduto"
                );


            if (nome) {

                nome.focus();

            }

        },
        100
    );

}


// =====================================================
// FECHAR CADASTRO
// =====================================================

function fecharCadastro() {

    const telaLista =
        document.getElementById(
            "telaLista"
        );

    const telaCadastro =
        document.getElementById(
            "telaCadastro"
        );


    if (telaLista) {

        telaLista.classList.add(
            "ativa"
        );

    }


    if (telaCadastro) {

        telaCadastro.classList.remove(
            "ativa"
        );

    }

    const botoes = document.querySelectorAll(".nav-item");
    botoes.forEach(botao => {
        botao.classList.toggle("active", botao.textContent.includes("Lista"));
    });

}


// =====================================================
// SALVAR NOVO PRODUTO
// =====================================================

function salvarNovoProduto() {

    const campoNome =
        document.getElementById(
            "nomeProduto"
        );


    const campoCategoria =
        document.getElementById(
            "categoriaProduto"
        );


    const campoCodigo =
        document.getElementById(
            "codigoBarras"
        );


    const campoUltimo =
        document.getElementById(
            "ultimoPreco"
        );


    const campoAtual =
        document.getElementById(
            "precoAtual"
        );


    const nome =
        campoNome.value.trim();


    const categoria =
        campoCategoria.value ||
        "Outros";


    const codigo =
        campoCodigo.value.trim();


    const ultimo =
        Number(
            String(
                campoUltimo.value || 0
            ).replace(
                ",",
                "."
            )
        );


    const atual =
        Number(
            String(
                campoAtual.value || 0
            ).replace(
                ",",
                "."
            )
        );


    if (!nome) {

        mostrarMensagem(
            "Digite o nome do produto."
        );

        campoNome.focus();

        return;

    }


    const duplicado =
        produtos.find(
            produto =>
                produto.nome
                    .toLowerCase() ===
                nome.toLowerCase()
        );


    if (duplicado) {

        mostrarMensagem(
            "Esse produto já está cadastrado."
        );

        return;

    }


    if (
        codigo &&
        produtos.some(
            produto =>
                String(
                    produto.codigoBarras
                ) === codigo
        )
    ) {

        mostrarMensagem(
            "Esse código de barras já está cadastrado."
        );

        return;

    }


    const novoProduto = {

        id: Date.now(),

        nome: nome,

        categoria:
            categorias[categoria]
                ? categoria
                : "Outros",

        codigoBarras:
            codigo,

        ultimoPreco:
            Number.isFinite(ultimo)
                ? ultimo
                : 0,

        precoAtual:
            Number.isFinite(atual)
                ? atual
                : 0,

        comprado: false

    };


    produtos.push(
        novoProduto
    );


    lista.push({

        id: novoProduto.id,

        nome: novoProduto.nome,

        comprado: false

    });


    salvarDados();


    limparFormulario();


    fecharCadastro();


    mostrarProdutos();


    mostrarMensagem(
        "Produto cadastrado com sucesso!"
    );

}


// =====================================================
// LIMPAR FORMULÁRIO
// =====================================================

function limparFormulario() {

    const nome =
        document.getElementById(
            "nomeProduto"
        );


    const codigo =
        document.getElementById(
            "codigoBarras"
        );


    const ultimo =
        document.getElementById(
            "ultimoPreco"
        );


    const atual =
        document.getElementById(
            "precoAtual"
        );


    const categoria =
        document.getElementById(
            "categoriaProduto"
        );


    if (nome) {

        nome.value = "";

    }


    if (codigo) {

        codigo.value = "";

    }


    if (ultimo) {

        ultimo.value = "";

    }


    if (atual) {

        atual.value = "";

    }


    if (categoria) {

        categoria.value =
            "Mercearia";

    }

}


// =====================================================
// ALTERAR PREÇO
// =====================================================

function editarPreco(id) {

    const produto =
        produtos.find(
            produto =>
                produto.id === id
        );


    if (!produto) {

        return;

    }


    produtoEditandoId =
        id;


    const modal =
        document.getElementById(
            "modalPreco"
        );


    const nome =
        document.getElementById(
            "nomeProdutoPreco"
        );


    const campo =
        document.getElementById(
            "novoPreco"
        );


    if (!modal) {

        return;

    }


    if (nome) {

        nome.textContent =
            produto.nome;

    }


    if (campo) {

        campo.value =
            Number(
                produto.precoAtual || 0
            ).toFixed(2);

    }


    modal.classList.remove(
        "oculto"
    );


    setTimeout(
        () => {

            if (campo) {

                campo.focus();

                campo.select();

            }

        },
        100
    );

}


// =====================================================
// SALVAR NOVO PREÇO
// =====================================================

function salvarNovoPreco() {

    if (
        produtoEditandoId === null
    ) {

        return;

    }


    const produto =
        produtos.find(
            produto =>
                produto.id ===
                produtoEditandoId
        );


    if (!produto) {

        fecharPreco();

        return;

    }


    const campo =
        document.getElementById(
            "novoPreco"
        );


    const valor =
        Number(
            String(
                campo.value || ""
            ).replace(
                ",",
                "."
            )
        );


    if (
        !Number.isFinite(valor) ||
        valor < 0
    ) {

        mostrarMensagem(
            "Digite um preço válido."
        );

        campo.focus();

        return;

    }


    produto.ultimoPreco =
        Number(
            produto.precoAtual || 0
        );


    produto.precoAtual =
        valor;


    salvarDados();


    fecharPreco();


    mostrarProdutos();


    mostrarMensagem(
        "Preço atualizado."
    );

}


// =====================================================
// FECHAR PREÇO
// =====================================================

function fecharPreco() {

    const modal =
        document.getElementById(
            "modalPreco"
        );


    if (modal) {

        modal.classList.add(
            "oculto"
        );

    }


    produtoEditandoId =
        null;

}


// =====================================================
// PESQUISA
// =====================================================

function configurarPesquisa() {

    const pesquisa =
        document.getElementById(
            "pesquisa"
        );


    if (!pesquisa) {

        return;

    }


    pesquisa.addEventListener(
        "input",
        mostrarProdutos
    );

}


// =====================================================
// SCANNER
// =====================================================

async function abrirScanner() {

    const modal =
        document.getElementById(
            "modalScanner"
        );


    const status =
        document.getElementById(
            "statusScanner"
        );


    const video =
        document.getElementById(
            "videoScanner"
        );


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "oculto"
    );


    if (status) {

        status.textContent =
            "Solicitando acesso à câmera...";

    }


    try {

        if (!moduloZXing) {
            moduloZXing = await import(
                "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm"
            );
        }


        leitor =
            new moduloZXing
                .BrowserMultiFormatReader();


        scannerAtivo = true;


        await leitor.decodeFromVideoDevice(
            undefined,
            video,
            (
                resultado,
                erro
            ) => {

                if (
                    !scannerAtivo ||
                    !resultado
                ) {

                    return;

                }


                const codigo =
                    resultado.getText();


                processarCodigo(
                    codigo
                );

            }
        );


    } catch (erro) {

        console.error(
            erro
        );


        if (status) {

            status.textContent =
                "Não foi possível acessar a câmera. Abra em um servidor HTTP/HTTPS e permita o uso da câmera.";

        }

        mostrarMensagem(
            "Scanner indisponível neste ambiente."
        );

    }

}


// =====================================================
// PROCESSAR CÓDIGO
// =====================================================

function processarCodigo(
    codigo
) {

    const codigoLimpo =
        String(codigo)
            .trim();


    const produto =
        produtos.find(
            produto =>
                String(
                    produto.codigoBarras || ""
                ).trim() ===
                codigoLimpo
        );


    if (!produto) {

        const status =
            document.getElementById(
                "statusScanner"
            );


        if (status) {

            status.textContent =
                "Código não cadastrado.";

        }


        setTimeout(
            () => {

                fecharScanner();

                abrirCadastro();


                const campo =
                    document.getElementById(
                        "codigoBarras"
                    );


                if (campo) {

                    campo.value =
                        codigoLimpo;

                }


                mostrarMensagem(
                    "Código não cadastrado. Complete o cadastro do produto."
                );

            },
            800
        );


        return;

    }


    produto.comprado =
        !produto.comprado;


    salvarDados();


    mostrarProdutos();


    const status =
        document.getElementById(
            "statusScanner"
        );


    if (status) {

        status.textContent =
            produto.comprado
                ? `✓ ${produto.nome} marcado como comprado.`
                : `${produto.nome} desmarcado.`;

    }


    setTimeout(
        fecharScanner,
        900
    );

}


// =====================================================
// FECHAR SCANNER
// =====================================================

function fecharScanner() {

    scannerAtivo =
        false;


    if (leitor) {

        try {

            leitor.reset();

        } catch (erro) {

            console.log(
                erro
            );

        }


        leitor =
            null;

    }


    const video =
        document.getElementById(
            "videoScanner"
        );


    if (
        video &&
        video.srcObject
    ) {

        video.srcObject
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        video.srcObject =
            null;

    }


    const modal =
        document.getElementById(
            "modalScanner"
        );


    if (modal) {

        modal.classList.add(
            "oculto"
        );

    }

}


// =====================================================
// FECHAR MODAIS AO CLICAR FORA
// =====================================================

function configurarModais() {

    const modalCadastro =
        document.getElementById(
            "modalCadastro"
        );


    const modalPreco =
        document.getElementById(
            "modalPreco"
        );


    const modalScanner =
        document.getElementById(
            "modalScanner"
        );


    if (modalCadastro) {

        modalCadastro.addEventListener(
            "click",
            evento => {

                if (
                    evento.target ===
                    modalCadastro
                ) {

                    fecharCadastro();

                }

            }
        );

    }


    if (modalPreco) {

        modalPreco.addEventListener(
            "click",
            evento => {

                if (
                    evento.target ===
                    modalPreco
                ) {

                    fecharPreco();

                }

            }
        );

    }


    if (modalScanner) {

        modalScanner.addEventListener(
            "click",
            evento => {

                if (
                    evento.target ===
                    modalScanner
                ) {

                    fecharScanner();

                }

            }
        );

    }

}


// =====================================================
// INICIALIZAÇÃO
// =====================================================

function mostrarTela(nomeTela) {

    const telaLista = document.getElementById("telaLista");
    const telaCadastro = document.getElementById("telaCadastro");
    const botoes = document.querySelectorAll(".nav-item");

    const listaAtiva = nomeTela === "lista" || nomeTela === "produtos";
    const cadastroAtivo = nomeTela === "cadastro";

    if (telaLista) {
        telaLista.classList.toggle("ativa", listaAtiva);
    }

    if (telaCadastro) {
        telaCadastro.classList.toggle("ativa", cadastroAtivo);
    }

    botoes.forEach(botao => {
        const texto = botao.textContent || "";
        const ativa =
            (nomeTela === "lista" && texto.includes("Lista")) ||
            (nomeTela === "produtos" && texto.includes("Produtos")) ||
            (nomeTela === "cadastro" && texto.includes("Novo"));

        botao.classList.toggle("active", ativa);
    });

    if (listaAtiva) {
        mostrarProdutos();
    }

}

function iniciarAplicativo() {

    carregarDados();

    preencherCategorias();

    configurarPesquisa();

    configurarModais();

    mostrarProdutos();

    mostrarTela("lista");

}


// =====================================================
// INICIAR QUANDO A PÁGINA ESTIVER PRONTA
// =====================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        iniciarAplicativo
    );

} else {

    iniciarAplicativo();

}