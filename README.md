# Meu Mercado

Aplicativo instalável (PWA) para organizar compras de supermercado.

Os ícones instaláveis do app estão disponíveis nos tamanhos PNG de 192×192 e 512×512 pixels, com a versão de 512×512 preparada também para máscaras adaptáveis.

## Páginas

- **Lista:** mantenha uma lista separada por mês, com os meses exibidos em português; os produtos aparecem agrupados em categorias expansíveis. Pesquise produtos cadastrados por nome ou código de barras, adicione quantidades, marque itens como comprados e remova itens. O total estimado usa o último preço registrado para cada produto. Copie a lista para o próximo mês e edite os itens sem afetar a lista original.
- **Compras:** selecione o supermercado (a última escolha fica como padrão), informe a quantidade comprada e o preço por unidade e use **Registrar compra** para salvar. O histórico recente, agrupado em categorias expansíveis, mostra quantidade, preço unitário, mercado e data. Ao registrar uma compra, o produto correspondente é marcado como comprado na lista; se ainda não estiver nela, é adicionado já marcado.
- **Cadastros:** mantenha seus produtos, códigos de barras, supermercados e categorias.

## Leitor de código de barras

O botão de câmera usa a API `BarcodeDetector` do navegador e requer permissão para acessar a câmera. O leitor está disponível em navegadores compatíveis, como versões recentes do Chrome para Android, e precisa de uma conexão segura (HTTPS ou `localhost`). Quando indisponível, o código pode ser digitado no campo de busca.

## Dados e publicação

Os dados ficam no IndexedDB do navegador e não são enviados para o GitHub. Use **Backup dos dados** no rodapé para baixar um arquivo JSON ou restaurá-lo. Guarde backups em local privado.

O workflow publica os arquivos estáticos no GitHub Pages a cada atualização da branch `main`. Na primeira publicação, habilite **Settings > Pages > GitHub Actions**.
