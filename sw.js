const CACHE_NAME = "meu-mercado-v8";

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

        caches.match(event.request)
            .then(function (resposta) {

                return resposta || fetch(event.request);

            })

    );
});