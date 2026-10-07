const CACHE_NAME = "meu-mercado-v13";

const ARQUIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", function (event) {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(ARQUIVOS);
            })
    );

    self.skipWaiting();
});


self.addEventListener("activate", function (event) {

    event.waitUntil(
        caches.keys().then(function (nomes) {

            return Promise.all(
                nomes.map(function (nome) {

                    if (nome.startsWith("meu-mercado-") && nome !== CACHE_NAME) {
                        return caches.delete(nome);
                    }

                })
            );

        })
    );

    self.clients.claim();
});


self.addEventListener("fetch", function (event) {

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(function (resposta) {
                if (!resposta.ok) {
                    return resposta;
                }
                return caches.open(CACHE_NAME)
                    .then(function (cache) {
                        return cache.put(event.request, resposta.clone())
                            .then(function () { return resposta; });
                    })
                    .catch(function (erro) {
                        console.error("Não foi possível atualizar o cache offline:", erro);
                        return resposta;
                    });
            })
            .catch(async function (erro) {
                const respostaEmCache = await caches.match(event.request);
                if (respostaEmCache) {
                    return respostaEmCache;
                }
                throw erro;
            })
    );
});