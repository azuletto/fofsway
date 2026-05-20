> "Atue como um Desenvolvedor Fullstack Sênior. Preciso que você crie o código para um sistema web de comandas para a rede de restaurantes 'Fofsway' [6]. 
>
> **Restrições Técnicas:**
> - Você deve usar apenas HTML, CSS, JavaScript puro no frontend [1].
> - O backend será uma API simulada construída com Node.js e Express [1, 5].
> - A comunicação entre o frontend e a API deve ser feita usando Axios [1].
> - Todas as funções e lógicas adicionais do frontend devem ser centralizadas em um único arquivo chamado `pedido.js` (ou `pedidos.js`) [4, 5].
> 
> **Requisitos do Frontend:**
> 1. **Tela de Lanches:** Permitir escolher um lanche pré-definido e adicionar ao carrinho. Validar para não aceitar quantidade 0 ou negativa (exibir alert caso ocorra) [1].
> 2. **Tela de Montar Lanche (Customizado):** O cliente escolhe ingredientes. Itens com asterisco (*) são obrigatórios e o cliente só pode selecionar 1 opção de cada [1, 2]. As categorias 'Adicionais' e 'Temperos e molhos' são opcionais e permitem múltiplas escolhas [2]. Validar preenchimento obrigatório antes de adicionar ao carrinho (exibir alert se falhar) [1, 2].
> 3. **Gerenciamento do Carrinho:**
>    - Aceitar apenas 1 carrinho por cliente [3].
>    - Botão 'Inserir no carrinho': valida os dados das telas e insere o lanche/ingredientes e a quantidade no carrinho [2, 3].
>    - Botão 'Limpar carrinho': esvazia completamente o carrinho atual [3].
> 4. **Envio de Pedidos:** Botão 'Enviar pedido'. Validar se o carrinho não está vazio e se o campo 'Nome do cliente' está preenchido (se falhar, emitir alert) [3, 4]. Se for válido, inserir o carrinho na lista de pedidos geral e esvaziar o carrinho atual [3].
> 5. **Tela de Pedidos:** Exibir todos os pedidos finalizados [4].
> 6. **Funções obrigatórias no `pedido.js`:** `listarPedidos()`, `adicionarCarrinho()`, `deletarCarrinho()`, `enviarPedido()`, `adicionarLancheAoCarrinho()` e `adicionarMontagemLancheAoCarrinho()` [4, 5].
>
> **Requisitos do Backend (API Express):**
> - Criar rotas [5]:
>   - `GET /listarPedidos`: retorna a lista de pedidos em caso de sucesso.
>   - `POST /adicionarCarrinho`: recebe o item para o carrinho.
>   - `PUT /enviarPedido`: converte o carrinho atual em um pedido oficial.
>   - `DELETE /deletarCarrinho`: deleta os dados do carrinho atual.
> - Todas as respostas da API (exceto o sucesso do GET `listarPedidos`) devem obrigatoriamente retornar um objeto JSON contendo uma mensagem de sucesso ou de erro [5].
>
> **Desafio Extra:**
> Implemente e integre na interface e lógica uma funcionalidade criativa e inovadora que diferencie a Fofsway de sua concorrente (Subway) [5].
>
> Por favor, gere a estrutura de pastas e os códigos completos do Frontend (HTML, CSS, pedido.js) e do Backend (app.js / server.js)."