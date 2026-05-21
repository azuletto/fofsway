// Configuração da API
const axiosInstance = axios.create(); // usa a mesma origem

// Estado global
let carrinho = [];

// Helpers para persistência local (fallback quando servidor estiver vazio)
function saveCarrinhoLocal() {
  try {
    localStorage.setItem('fofsway_carrinho', JSON.stringify(carrinho || []));
  } catch (e) {
    console.warn('Não foi possível salvar o carrinho localmente.', e);
  }
}

function loadCarrinhoLocal() {
  try {
    const raw = localStorage.getItem('fofsway_carrinho');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Erro ao ler carrinho local.', e);
    return [];
  }
}

function clearCarrinhoLocal() {
  try { localStorage.removeItem('fofsway_carrinho'); } catch (e) { /* ignore */ }
}

function mostrarNotificacao(mensagem, tipo = 'sucesso', titulo = 'Notificação') {
  const dialog = document.getElementById('itemAdicionadoDialog');
  const tituloElement = document.getElementById('itemAdicionadoTitulo');
  const textoElement = document.getElementById('itemAdicionadoTexto');
  const iconeElement = document.getElementById('itemAdicionadoIcone');

  if (!dialog || !tituloElement || !textoElement || !iconeElement) {
    return;
  }

  dialog.classList.remove('tipo-sucesso', 'tipo-aviso', 'tipo-erro');
  dialog.classList.remove('fechando');
  dialog.classList.add(`tipo-${tipo}`);
  tituloElement.textContent = titulo;
  textoElement.textContent = mensagem;

  const icones = {
    sucesso: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
    aviso: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
    erro: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>'
  };
  iconeElement.innerHTML = icones[tipo] || icones.sucesso;

  if (!dialog.open) {
    dialog.showModal();
  }

  clearTimeout(mostrarNotificacao.timeoutId);
  const duracao = tipo === 'sucesso' ? 1500 : 2400;
  mostrarNotificacao.timeoutId = setTimeout(() => {
    if (!dialog.open) return;
    dialog.classList.add('fechando');
    clearTimeout(mostrarNotificacao.closeTimeoutId);
    mostrarNotificacao.closeTimeoutId = setTimeout(() => {
      if (dialog.open) {
        dialog.close();
      }
      dialog.classList.remove('fechando');
    }, 140);
  }, duracao);
}

// Função para listar pedidos (GET)
async function listarPedidos() {
  try {
    const response = await axiosInstance.get('/listarPedidos');
    const pedidos = response.data.pedidos || [];
    exibirPedidos(pedidos);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    document.getElementById('pedidosLista').innerHTML = '<p>Erro ao carregar pedidos. Verifique se o backend está rodando.</p>';
  }
}

// Função para adicionar item ao carrinho (POST)
async function adicionarCarrinho(item) {
  try {
    const response = await axiosInstance.post('/adicionarCarrinho', { item });
    carrinho = response.data.carrinho;
    atualizarCarrinhoUI();
    mostrarNotificacao(`${item.nome} foi adicionado ao carrinho.`, 'sucesso', 'Item adicionado');
    return true;
  } catch (error) {
    console.error('Erro ao adicionar ao carrinho:', error);
    mostrarNotificacao('Não foi possível adicionar ao carrinho.', 'erro', 'Erro');
    return false;
  }
}

// Função para deletar/limpar carrinho (DELETE)
async function deletarCarrinho() {
  try {
    const response = await axiosInstance.delete('/deletarCarrinho');
    carrinho = response.data.carrinho;
    atualizarCarrinhoUI();
    // também limpa a cópia local para evitar restauração no reload
    clearCarrinhoLocal();
    mostrarNotificacao('Carrinho limpo com sucesso!', 'sucesso', 'Carrinho');
  } catch (error) {
    console.error('Erro ao limpar carrinho:', error);
    mostrarNotificacao('Erro ao limpar carrinho.', 'erro', 'Erro');
  }
}

// Função para enviar pedido (PUT)
async function enviarPedido() {
  const nomeCliente = document.getElementById('nomeCliente').value.trim();
  const observacaoPedido = document.getElementById('observacaoPedido')?.value.trim() || '';
  if (!nomeCliente) {
    mostrarNotificacao('Por favor, informe seu nome antes de enviar o pedido.', 'aviso', 'Campo obrigatório');
    return;
  }
  if (carrinho.length === 0) {
    mostrarNotificacao('Carrinho vazio. Adicione itens antes de enviar.', 'aviso', 'Carrinho vazio');
    return;
  }
  try {
    const response = await axiosInstance.put('/enviarPedido', { nomeCliente, observacaoPedido });
    mostrarNotificacao(response.data.mensagem ? `Pedido enviado! ${response.data.mensagem}` : 'Pedido enviado com sucesso!', 'sucesso', 'Pedido enviado');
    // Após enviar, o carrinho é esvaziado no backend, então atualizamos o estado local
    carrinho = [];
    clearCarrinhoLocal();
    atualizarCarrinhoUI();
    document.getElementById('nomeCliente').value = '';
    const observacaoField = document.getElementById('observacaoPedido');
    if (observacaoField) {
      observacaoField.value = '';
    }
    // Atualiza a lista de pedidos
    listarPedidos();
    // Desafio extra: adicionar pontos de fidelidade
    adicionarPontosFidelidade(nomeCliente);
  } catch (error) {
    console.error('Erro ao enviar pedido:', error);
    const msg = error.response?.data?.erro || 'Erro desconhecido.';
    mostrarNotificacao(`Falha ao enviar pedido: ${msg}`, 'erro', 'Erro');
  }
}

// Função para adicionar lanche pronto ao carrinho
async function adicionarLancheAoCarrinho(lanche, quantidade) {
  if (quantidade <= 0) {
    mostrarNotificacao('Quantidade deve ser maior que zero.', 'aviso', 'Quantidade inválida');
    return false;
  }
  const item = {
    tipo: 'pronto',
    nome: lanche.nome,
    descricao: lanche.descricao,
    preco: lanche.preco,
    quantidade: quantidade
  };
  return await adicionarCarrinho(item);
}

// Função para adicionar lanche montado customizado ao carrinho
async function adicionarMontagemLancheAoCarrinho(montagem) {
  const { ingredientes, quantidade, precoBase } = montagem;
  if (quantidade <= 0) {
    mostrarNotificacao('Quantidade inválida.', 'aviso', 'Quantidade inválida');
    return false;
  }
  const descricao = gerarDescricaoMontagem(montagem);
  const item = {
    tipo: 'customizado',
    nome: 'Lanche Customizado',
    descricao: descricao || 'Lanche customizado',
    ingredientes: ingredientes,
    preco: precoBase,
    quantidade: quantidade
  };
  return await adicionarCarrinho(item);
}

// ---------- FUNÇÕES DE UI e RENDERIZAÇÃO ----------

// Dados extraídos do LANCHES.MD
const lanchesProntos = [
  { nome: 'FofFrango Club', descricao: 'Frango grelhado, queijo, tomate, alface, maionese especial e pão macio.', preco: 28.90, categoria: 'geral' },
  { nome: 'FofChipotle Especial', descricao: 'Frango, queijo derretido, tomate, molho chipotle defumado e maionese cremosa.', preco: 28.90, categoria: 'geral' },
  { nome: 'FofFrango Club (Pesto)', descricao: 'Frango grelhado, queijo, tomate, alface e molho pesto artesanal.', preco: 28.90, categoria: 'geral' },
  { nome: 'FofVeggie Supreme (Clássico)', descricao: 'Queijo vegano, tomate, alface, cebola roxa, orégano e molho especial da casa.', preco: 28.90, categoria: 'vegana' },
  { nome: 'FofVeggie Supreme (Parmesão)', descricao: 'Queijo parmesão vegano, tomate, alface, orégano e maionese temperada vegana.', preco: 28.90, categoria: 'vegana' },
  { nome: 'FofVeggie Supreme (Defumado)', descricao: 'Queijo vegano, tomate, alface, picles, molho defumado e toque de ervas.', preco: 28.90, categoria: 'vegana' },
  { nome: 'FofBacon Crunch', descricao: 'Hambúrguer artesanal, cheddar cremoso, bacon crocante, cebola caramelizada e molho barbecue.', preco: 28.90, categoria: 'geral' },
  { nome: 'FofGreen Garden', descricao: 'Hambúrguer de grão-de-bico, queijo vegano, rúcula fresca, tomate seco e molho de alho vegano.', preco: 28.90, categoria: 'vegana' }
];

const imagensLanches = {
  'FofFrango Club': 'assets/lanches_prontos/img/FofFrango Club.png',
  'FofChipotle Especial': 'assets/lanches_prontos/img/FofChipotle Especial.png',
  'FofVeggie Supreme (Clássico)': 'assets/lanches_prontos/img/FofVeggie Supreme (Clássico).png',
  'FofVeggie Supreme (Parmesão)': 'assets/lanches_prontos/img/FofVeggie Supreme (Parmesão).png',
  'FofVeggie Supreme (Defumado)': 'assets/lanches_prontos/img/FofVeggie Supreme (Defumado).png',
  'FofFrango Club (Pesto)': 'assets/lanches_prontos/img/FofFrango Club (Pesto).png'
};

// Mapa estático de imagens para itens customizados (nomes -> arquivo)
const customImageMap = {
  'Aioli': 'aioli.jpg',
  'Barbecue': 'barbecue.jpg',
  'Carne Bovina': 'carne_bovina.jpg',
  'Frango': 'carne_frango.jpg',
  'Cebola Roxa': 'cebola_rocha.jpg',
  'Bacon': 'fatias_bacon.jpg',
  'Alface': 'fatias_de_alface.jpg',
  'Tomate': 'fatias_de_tomate.jpg',
  'Mussarela': 'fatias_mussarela.jpg',
  'Peru': 'fatias_peru.jpg',
  'Cheddar': 'fatias_queijo_cheddar.jpg',
  'Prato': 'fatias_queijo_prato.jpg',
  'Hambúrguer': 'hamburguer.jpg',
  'Ketchup': 'ketchup.jpg',
  'Maionese': 'maionese.jpg',
  'Molho Especial': 'molho_especial.jpg',
  'Mostarda': 'mostarda.jpg',
  'Ovo': 'ovos.jpg',
  'Pão Australiano': 'pao_australiano.jpg',
  'Pão Brioche': 'pao_briochi.jpg',
  'Pão Ciabatta': 'pao_ciabatta.jpg',
  'Pão de Trigo': 'pao_de_trigo.jpg',
  'Pão Integral': 'pao_integral.jpg',
  'Pepino': 'pepino.jpg',
  'Pesto': 'pesto.jpg',
  'Gouda': 'queijo_gouda.jpg',
  'Queijo Vegano': 'queijo_vegano.jpg',
  'Rúcula': 'rucula.jpg',
  'Tofu': 'tofu.jpg'
};

// Use caminhos estáticos já definidos; não há lookups dinâmicos aqui.

function renderizarCardsLanches() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';
  const lanchesGerais = lanchesProntos.filter((lanche) => lanche.categoria !== 'vegana');
  const lanchesVeganos = lanchesProntos.filter((lanche) => lanche.categoria === 'vegana');

  const criarCard = (lanche, idx) => {
    const card = document.createElement('div');
    card.className = 'card-lanche';
    const caminhoImagem = imagensLanches[lanche.nome] ? encodeURI(imagensLanches[lanche.nome]) : encodeURI(`assets/lanches_prontos/img/${lanche.nome}.png`);
    const quantidadeId = `quantidade-${lanche.nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${idx}`;
    card.innerHTML = `
      <div class="card-conteudo">
        <img class="card-imagem" src="${caminhoImagem}" alt="${lanche.nome}" loading="lazy">
        <h3>${lanche.nome}</h3>
        <p>${lanche.descricao}</p>
        <div class="quantidade-card card-quantidade-card">
          <label for="${quantidadeId}">Quantidade</label>
          <div class="card-quantidade-stepper" role="group" aria-label="Quantidade de ${lanche.nome}">
            <button type="button" class="card-quantidade-btn card-quantidade-menos" aria-label="Diminuir quantidade">−</button>
            <input type="number" id="${quantidadeId}" class="card-quantidade-input" min="1" value="1" step="1" inputmode="numeric">
            <button type="button" class="card-quantidade-btn card-quantidade-mais" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
        <button class="btn-adicionar" type="button">ADICIONAR AO CARRINHO R$ ${lanche.preco.toFixed(2)}</button>
      </div>
    `;

    const botao = card.querySelector('.btn-adicionar');
    const quantidadeInput = card.querySelector('.card-quantidade-input');
    const botaoMenos = card.querySelector('.card-quantidade-menos');
    const botaoMais = card.querySelector('.card-quantidade-mais');

    const ajustarQuantidade = (delta) => {
      const atual = parseInt(quantidadeInput.value, 10);
      const base = Number.isInteger(atual) && atual > 0 ? atual : 1;
      const novaQuantidade = Math.max(1, base + delta);
      quantidadeInput.value = novaQuantidade;
      return novaQuantidade;
    };

    botaoMenos.addEventListener('click', () => ajustarQuantidade(-1));
    botaoMais.addEventListener('click', () => ajustarQuantidade(1));
    botao.addEventListener('click', () => {
      const quantidade = parseInt(quantidadeInput.value, 10);
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        mostrarNotificacao('Quantidade deve ser maior que zero.', 'aviso', 'Quantidade inválida');
        quantidadeInput.focus();
        return;
      }
      adicionarLancheAoCarrinho(lanche, quantidade);
    });
    grid.appendChild(card);
  };

  lanchesGerais.forEach(criarCard);

  if (lanchesVeganos.length > 0) {
    const separador = document.createElement('div');
    separador.className = 'cards-separador';
    separador.innerHTML = '<h3>Opções veganas</h3>';
    grid.appendChild(separador);
    lanchesVeganos.forEach(criarCard);
  }

}

// Configuração das categorias para montagem de lanche
const categoriasMontagem = {
  pao: {
    nome: 'Pão *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Pão Australiano', 'Pão Integral', 'Pão de Trigo', 'Pão Brioche', 'Pão Ciabatta']
  },
  carne: {
    nome: 'Carne *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Tofu', 'Carne Bovina', 'Peru', 'Hambúrguer', 'Frango', 'Bacon']
  },
  queijo: {
    nome: 'Queijo *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Mussarela', 'Prato', 'Queijo Vegano', 'Gouda', 'Cheddar']
  },
  adicionais: {
    nome: 'Adicionais (opcional, múltipla escolha)',
    obrigatorio: false,
    tipo: 'checkbox',
    opcoes: ['Alface', 'Tomate', 'Cebola Roxa', 'Pepino', 'Rúcula', 'Ovo']
  },
  molhos: {
    nome: 'Temperos e molhos (opcional, múltipla escolha)',
    obrigatorio: false,
    tipo: 'checkbox',
    opcoes: ['Maionese', 'Ketchup', 'Mostarda', 'Barbecue', 'Pesto', 'Aioli', 'Molho Especial']
  }
};

/* --- Nova UI de etapas para "Montar Lanche" --- */
const optionPrices = {
  'Pão Australiano': 2.0,
  'Pão Integral': 1.8,
  'Pão de Trigo': 1.5,
  'Pão Brioche': 2.5,
  'Pão Ciabatta': 2.2,
  'Frango': 5.0,
  'Carne Bovina': 6.5,
  'Peru': 5.5,
  'Hambúrguer': 6.0,
  'Tofu': 4.0,
  'Mussarela': 1.8,
  'Prato': 1.9,
  'Cheddar': 2.5,
  'Gouda': 2.2,
  'Queijo Vegano': 2.4,
  'Bacon': 2.0,
  'Ovo': 1.5,
  'Tomate': 0.8,
  'Alface': 0.5,
  'Cebola Roxa': 0.6,
  'Pepino': 0.6,
  'Rúcula': 0.9,
  'Maionese': 0.3,
  'Ketchup': 0.2,
  'Mostarda': 0.2,
  'Barbecue': 0.5,
  'Pesto': 0.7,
  'Aioli': 0.6,
  'Molho Especial': 0.9
};

const montagemSteps = [
  { key: 'pao', label: 'BASE' },
  { key: 'carne', label: 'PROTEÍNA' },
  { key: 'queijo', label: 'QUEIJO' },
  { key: 'adicionais', label: 'SALADAS' },
  { key: 'molhos', label: 'ADICIONAIS' }
];

let montagemState = {
  currentStep: 0,
  selecionados: {
    pao: null,
    carne: [],
    queijo: [],
    adicionais: [],
    molhos: []
  },
  quantidades: {
    carne: {},
    queijo: {},
    adicionais: {},
    molhos: {}
  }
};

function isCategoriaUnica(key) {
  return key === 'pao';
}

function estaSelecionadoMontagem(key, option) {
  if (isCategoriaUnica(key)) {
    return montagemState.selecionados.pao === option;
  }
  return (montagemState.selecionados[key] || []).includes(option);
}

function obterQuantidadeMontagem(key, option) {
  if (isCategoriaUnica(key)) {
    return 1;
  }
  return montagemState.quantidades[key]?.[option] || 1;
}

function atualizarBotaoMontagemTopo() {
  const botao = document.getElementById('btnAdicionarMontagemTopo');
  if (!botao) return;

  const possuiPao = Boolean(montagemState.selecionados.pao);
  const possuiOutroItem = montagemSteps.some((step) => {
    if (step.key === 'pao') {
      return false;
    }
    return (montagemState.selecionados[step.key] || []).length > 0;
  });

  const habilitado = possuiPao && possuiOutroItem;
  botao.disabled = !habilitado;
  botao.setAttribute('aria-disabled', String(!habilitado));
  botao.title = habilitado
    ? 'Adicionar ao carrinho'
    : 'Selecione pão e ao menos um item de outra categoria';
}

function definirQuantidadeMontagem(key, option, quantidade) {
  if (isCategoriaUnica(key)) {
    return;
  }
  const quantidadeValida = Math.max(1, parseInt(quantidade, 10) || 1);
  if (!montagemState.quantidades[key]) {
    montagemState.quantidades[key] = {};
  }
  montagemState.quantidades[key][option] = quantidadeValida;
  if (!estaSelecionadoMontagem(key, option)) {
    montagemState.selecionados[key].push(option);
  }
  renderResumo();
  atualizarBotaoMontagemTopo();
  renderCardsForStep(key);
}

function alternarSelecaoMontagem(key, option) {
  if (isCategoriaUnica(key)) {
    montagemState.selecionados.pao = option;
    renderResumo();
    atualizarBotaoMontagemTopo();
    renderCardsForStep(key);
    return;
  }

  const selecionados = montagemState.selecionados[key] || (montagemState.selecionados[key] = []);
  const indice = selecionados.indexOf(option);

  if (indice >= 0) {
    selecionados.splice(indice, 1);
    if (montagemState.quantidades[key]) {
      delete montagemState.quantidades[key][option];
    }
  } else {
    selecionados.push(option);
    if (!montagemState.quantidades[key]) {
      montagemState.quantidades[key] = {};
    }
    montagemState.quantidades[key][option] = montagemState.quantidades[key][option] || 1;
  }

  renderResumo();
  atualizarBotaoMontagemTopo();
  renderCardsForStep(key);
}

function obterItensResumoMontagem() {
  const itens = [];

  if (montagemState.selecionados.pao) {
    itens.push({ categoria: 'PÃO', nome: montagemState.selecionados.pao, quantidade: 1 });
  }

  for (const step of montagemSteps) {
    if (step.key === 'pao') continue;
    const selecionados = montagemState.selecionados[step.key] || [];
    selecionados.forEach((nome) => {
      itens.push({
        categoria: step.label,
        nome,
        quantidade: obterQuantidadeMontagem(step.key, nome)
      });
    });
  }

  return itens;
}

function gerarDescricaoMontagem(montagem) {
  const selecionados = montagem?.ingredientes?.selecionados || {};
  const quantidades = montagem?.ingredientes?.quantidades || {};
  const partes = [];

  if (selecionados.pao) {
    partes.push(`Base: ${selecionados.pao}`);
  }

  for (const step of montagemSteps) {
    if (step.key === 'pao') continue;
    const valores = Array.isArray(selecionados[step.key]) ? selecionados[step.key] : [];
    if (!valores.length) continue;

    const detalhes = valores.map((nome) => {
      const quantidade = quantidades?.[step.key]?.[nome] || 1;
      return quantidade > 1 ? `${nome} x${quantidade}` : nome;
    });

    partes.push(`${step.label}: ${detalhes.join(', ')}`);
  }

  return partes.join(' | ');
}

function obterNomePreviewIngrediente(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const preview = obterNomePreviewIngrediente(item);
      if (preview) return preview;
    }
    return null;
  }
  if (typeof valor === 'object') {
    if (typeof valor.nome === 'string' && valor.nome.trim()) {
      return valor.nome;
    }
    for (const item of Object.values(valor)) {
      const preview = obterNomePreviewIngrediente(item);
      if (preview) return preview;
    }
  }
  return null;
}

function setupMontagemUI() {
  // initial render
  renderMontagemStep(montagemState.currentStep);
  atualizarBotaoMontagemTopo();

  // buttons
  document.getElementById('btnProximaEtapa').addEventListener('click', () => goToStep(montagemState.currentStep + 1));
  document.getElementById('btnEtapaAnterior').addEventListener('click', () => goToStep(montagemState.currentStep - 1));
  document.getElementById('btnAdicionarMontagemTopo').addEventListener('click', async () => {
    const botaoAdicionar = document.getElementById('btnAdicionarMontagemTopo');
    if (!botaoAdicionar || botaoAdicionar.disabled) {
      mostrarNotificacao('Selecione pão e ao menos um item de outra categoria.', 'aviso', 'Seleção obrigatória');
      return;
    }

    const ingredientes = {
      selecionados: montagemState.selecionados,
      quantidades: montagemState.quantidades
    };
    const quantidade = parseInt(document.getElementById('quantidadeMontagem').value) || 1;
    if (quantidade <= 0) {
      mostrarNotificacao('Quantidade deve ser maior que zero.', 'aviso', 'Quantidade inválida');
      return;
    }
    const precoBase = calcularPrecoMontagem();
    const montagem = { ingredientes, quantidade, precoBase };
    const sucesso = await adicionarMontagemLancheAoCarrinho(montagem);
    if (sucesso) {
      mostrarNotificacao('Montagem adicionada ao carrinho', 'sucesso', 'Adicionado');
    }
  });

  // tags click
  document.querySelectorAll('.passo-tag').forEach(el => {
    el.addEventListener('click', () => {
      const step = parseInt(el.getAttribute('data-step'));
      goToStep(step);
    });
  });
  atualizarBotaoMontagemTopo();
}

function calcularPrecoMontagem(ingredientes) {
  return Number(
    obterItensResumoMontagem().reduce((total, item) => {
      const price = optionPrices[item.nome] || 0;
      return total + (price * item.quantidade);
    }, 0).toFixed(2)
  );
}

function goToStep(stepIndex) {
  if (stepIndex < 0) stepIndex = 0;
  if (stepIndex >= montagemSteps.length) stepIndex = montagemSteps.length - 1;
  if (stepIndex === montagemState.currentStep) return;
  // animate exit then enter
  const centro = document.getElementById('montagemCentro');
  centro.classList.add('step-anim-exit');
  setTimeout(() => {
    centro.classList.remove('step-anim-exit');
    montagemState.currentStep = stepIndex;
    renderMontagemStep(stepIndex);
    centro.classList.add('step-anim-enter');
    setTimeout(() => centro.classList.remove('step-anim-enter'), 350);
  }, 200);
}

function renderMontagemStep(stepIndex) {
  const step = montagemSteps[stepIndex];
  const titulo = document.getElementById('passoTitulo');
  titulo.textContent = `PASSO ${stepIndex + 1} ESCOLHA ${step.label}`;

  // update tags
  document.querySelectorAll('.passo-tag').forEach(el => el.classList.toggle('active', parseInt(el.getAttribute('data-step')) === stepIndex));

  // render center and others
  renderCardsForStep(step.key);

  // show/hide buttons
  document.getElementById('btnEtapaAnterior').style.display = stepIndex === 0 ? 'none' : 'inline-block';
  document.getElementById('btnProximaEtapa').style.display = stepIndex === montagemSteps.length - 1 ? 'none' : 'inline-block';

  renderResumo();
  atualizarBotaoMontagemTopo();
}

function renderCardsForStep(key) {
  const principais = document.getElementById('principaisCards');
  const others = document.getElementById('othersCards');
  principais.innerHTML = '';
  others.innerHTML = '';
  const cat = categoriasMontagem[key];
  if (!cat) return;
  const opcoes = cat.opcoes.slice();

  const main = opcoes.slice(0, 3);
  const extra = opcoes.slice(3, 7);

  main.forEach(op => {
    const price = optionPrices[op] || 0;
    const card = document.createElement('div');
    card.className = `card-principal montagem-card ${estaSelecionadoMontagem(key, op) ? 'selected' : ''} ${key === 'pao' ? 'is-single' : ''}`;
    // caminho fixo para imagens de itens customizados via mapa estático
    const imgFile = customImageMap[op] || `${op}.jpg`;
    const imgSrc = encodeURI(`assets/itens_custom/img/${imgFile}`);
    const mostrarQuantidade = key !== 'pao';
    card.innerHTML = `
      <span class="card-selecionado-badge">(selecionado)</span>
      <img class="card-principal-img" src="${imgSrc}" alt="${op}" loading="lazy">
      <div class="nome-opcao">${op}</div>
      <div class="valor-opcao">R$ ${price.toFixed(2)}</div>
      ${mostrarQuantidade ? `
      <div class="card-montagem-quantidade">
        <label>Quantidade</label>
        <div class="card-quantidade-stepper">
          <button type="button" class="card-quantidade-btn card-qtd-menos" aria-label="Diminuir quantidade">−</button>
          <input type="number" class="card-quantidade-input" min="1" value="${obterQuantidadeMontagem(key, op)}" step="1" inputmode="numeric">
          <button type="button" class="card-quantidade-btn card-qtd-mais" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      ` : ''}
    `;

    const quantidadeInput = card.querySelector('.card-quantidade-input');
    const botaoMenos = card.querySelector('.card-qtd-menos');
    const botaoMais = card.querySelector('.card-qtd-mais');

    card.addEventListener('click', () => alternarSelecaoMontagem(key, op));
    if (mostrarQuantidade && quantidadeInput && botaoMenos && botaoMais) {
      botaoMenos.addEventListener('click', (e) => {
        e.stopPropagation();
        const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
        const novaQuantidade = Math.max(1, quantidadeAtual - 1);
        quantidadeInput.value = novaQuantidade;
        definirQuantidadeMontagem(key, op, novaQuantidade);
      });
      botaoMais.addEventListener('click', (e) => {
        e.stopPropagation();
        const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
        const novaQuantidade = quantidadeAtual + 1;
        quantidadeInput.value = novaQuantidade;
        definirQuantidadeMontagem(key, op, novaQuantidade);
      });
      quantidadeInput.addEventListener('change', (e) => {
        const valor = parseInt(e.target.value, 10);
        const quantidade = Number.isInteger(valor) && valor > 0 ? valor : 1;
        quantidadeInput.value = quantidade;
        definirQuantidadeMontagem(key, op, quantidade);
      });
    }
    principais.appendChild(card);
  });

  extra.forEach(op => {
    const price = optionPrices[op] || 0;
    const card = document.createElement('div');
    card.className = `other-card montagem-card ${estaSelecionadoMontagem(key, op) ? 'selected' : ''} ${key === 'pao' ? 'is-single' : ''}`;
    const imgFile = customImageMap[op] || `${op}.jpg`;
    const imgSrc = encodeURI(`assets/itens_custom/img/${imgFile}`);
    const mostrarQuantidade = key !== 'pao';
    card.innerHTML = `
      <span class="card-selecionado-badge">(selecionado)</span>
      <img class="other-card-thumb" src="${imgSrc}" alt="${op}" loading="lazy">
      <div class="other-card-info">
        <div class="other-card-text">${op}</div>
        <div class="valor-opcao">R$ ${price.toFixed(2)}</div>
      </div>
      ${mostrarQuantidade ? `
      <div class="card-montagem-quantidade">
        <label>Quantidade</label>
        <div class="card-quantidade-stepper">
          <button type="button" class="card-quantidade-btn card-qtd-menos" aria-label="Diminuir quantidade">−</button>
          <input type="number" class="card-quantidade-input" min="1" value="${obterQuantidadeMontagem(key, op)}" step="1" inputmode="numeric">
          <button type="button" class="card-quantidade-btn card-qtd-mais" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      ` : ''}
    `;

    const quantidadeInput = card.querySelector('.card-quantidade-input');
    const botaoMenos = card.querySelector('.card-qtd-menos');
    const botaoMais = card.querySelector('.card-qtd-mais');

    card.addEventListener('click', () => alternarSelecaoMontagem(key, op));
    if (mostrarQuantidade && quantidadeInput && botaoMenos && botaoMais) {
      botaoMenos.addEventListener('click', (e) => {
        e.stopPropagation();
        const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
        const novaQuantidade = Math.max(1, quantidadeAtual - 1);
        quantidadeInput.value = novaQuantidade;
        definirQuantidadeMontagem(key, op, novaQuantidade);
      });
      botaoMais.addEventListener('click', (e) => {
        e.stopPropagation();
        const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
        const novaQuantidade = quantidadeAtual + 1;
        quantidadeInput.value = novaQuantidade;
        definirQuantidadeMontagem(key, op, novaQuantidade);
      });
      quantidadeInput.addEventListener('change', (e) => {
        const valor = parseInt(e.target.value, 10);
        const quantidade = Number.isInteger(valor) && valor > 0 ? valor : 1;
        quantidadeInput.value = quantidade;
        definirQuantidadeMontagem(key, op, quantidade);
      });
    }
    others.appendChild(card);
  });

  // if no extras, show remaining opcoes as others
  if (extra.length === 0 && opcoes.length > 3) {
    opcoes.slice(3).forEach(op => {
      const price = optionPrices[op] || 0;
      const card = document.createElement('div');
      card.className = `other-card montagem-card ${estaSelecionadoMontagem(key, op) ? 'selected' : ''} ${key === 'pao' ? 'is-single' : ''}`;
      const imgFile = customImageMap[op] || `${op}.jpg`;
      const imgSrc = encodeURI(`assets/itens_custom/img/${imgFile}`);
      const mostrarQuantidade = key !== 'pao';
      card.innerHTML = `
        <span class="card-selecionado-badge">(selecionado)</span>
        <img class="other-card-thumb" src="${imgSrc}" alt="${op}" loading="lazy">
        <div class="other-card-info">
          <div class="other-card-text">${op}</div>
          <div class="valor-opcao">R$ ${price.toFixed(2)}</div>
        </div>
        ${mostrarQuantidade ? `
        <div class="card-montagem-quantidade">
          <label>Quantidade</label>
          <div class="card-quantidade-stepper">
            <button type="button" class="card-quantidade-btn card-qtd-menos" aria-label="Diminuir quantidade">−</button>
            <input type="number" class="card-quantidade-input" min="1" value="${obterQuantidadeMontagem(key, op)}" step="1" inputmode="numeric">
            <button type="button" class="card-quantidade-btn card-qtd-mais" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
        ` : ''}
      `;

      const quantidadeInput = card.querySelector('.card-quantidade-input');
      const botaoMenos = card.querySelector('.card-qtd-menos');
      const botaoMais = card.querySelector('.card-qtd-mais');

      card.addEventListener('click', () => alternarSelecaoMontagem(key, op));
      if (mostrarQuantidade && quantidadeInput && botaoMenos && botaoMais) {
        botaoMenos.addEventListener('click', (e) => {
          e.stopPropagation();
          const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
          const novaQuantidade = Math.max(1, quantidadeAtual - 1);
          quantidadeInput.value = novaQuantidade;
          definirQuantidadeMontagem(key, op, novaQuantidade);
        });
        botaoMais.addEventListener('click', (e) => {
          e.stopPropagation();
          const quantidadeAtual = parseInt(quantidadeInput.value, 10) || 1;
          const novaQuantidade = quantidadeAtual + 1;
          quantidadeInput.value = novaQuantidade;
          definirQuantidadeMontagem(key, op, novaQuantidade);
        });
        quantidadeInput.addEventListener('change', (e) => {
          const valor = parseInt(e.target.value, 10);
          const quantidade = Number.isInteger(valor) && valor > 0 ? valor : 1;
          quantidadeInput.value = quantidade;
          definirQuantidadeMontagem(key, op, quantidade);
        });
      }
      others.appendChild(card);
    });
  }
}

function renderResumo() {
  const tbody = document.querySelector('#resumoTabela tbody');
  tbody.innerHTML = '';
  const itens = obterItensResumoMontagem();
  let total = 0;
  itens.forEach((item) => {
    const tr = document.createElement('tr');
    const tdNome = document.createElement('td');
    tdNome.textContent = `${item.categoria}: ${item.nome} x${item.quantidade}`;
    const tdVal = document.createElement('td');
    const price = (optionPrices[item.nome] || 0) * item.quantidade;
    tdVal.textContent = `R$ ${price.toFixed(2)}`;
    tr.appendChild(tdNome);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
    total += price;
  });
  document.getElementById('resumoTotal').textContent = `R$ ${total.toFixed(2)}`;
}


function obterDadosMontagem() {
  let selecionados = {};
  let obrigatoriosPreenchidos = true;
  for (const [key, cat] of Object.entries(categoriasMontagem)) {
    if (cat.tipo === 'radio') {
      const selecionado = document.querySelector(`input[name="${key}"]:checked`);
      if (cat.obrigatorio && !selecionado) {
        mostrarNotificacao(`Por favor, selecione uma opção para ${cat.nome}`, 'aviso', 'Seleção obrigatória');
        obrigatoriosPreenchidos = false;
        return null;
      }
      selecionados[key] = selecionado ? selecionado.value : null;
    } else { // checkbox
      const checkboxes = document.querySelectorAll(`input[name="${key}"]:checked`);
      selecionados[key] = Array.from(checkboxes).map(cb => cb.value);
    }
  }
  return selecionados;
}

// Evento de adicionar montagem
async function handleAdicionarMontagem() {
  const itens = obterItensResumoMontagem();
  if (!itens.length) {
    mostrarNotificacao('Selecione itens para montar o lanche.', 'aviso', 'Seleção obrigatória');
    return;
  }
  const quantidadeInput = document.getElementById('quantidadeMontagem');
  let quantidade = parseInt(quantidadeInput.value);
  if (isNaN(quantidade) || quantidade < 1) quantidade = 1;
  const montagem = {
    ingredientes: {
      selecionados: montagemState.selecionados,
      quantidades: montagemState.quantidades
    },
    quantidade: quantidade,
    precoBase: calcularPrecoMontagem()
  };
  const sucesso = await adicionarMontagemLancheAoCarrinho(montagem);
  if (sucesso) {
    document.getElementById('mensagemValidacaoMontagem').innerText = 'Item adicionado ao carrinho!';
    setTimeout(() => document.getElementById('mensagemValidacaoMontagem').innerText = '', 2000);
  }
}

function atualizarCarrinhoUI() {
  const container = document.getElementById('carrinhoLista');
  if (!carrinho.length) {
    container.innerHTML = '<p>Carrinho vazio</p>';
    atualizarBadgeCarrinho();
    return;
  }
  let total = 0;
  container.innerHTML = '';
  carrinho.forEach((item, idx) => {
    const subtotal = item.preco * item.quantidade;
    total += subtotal;
    let thumbSrc = 'assets/itens_custom/default.png';
    if (item.tipo === 'pronto') {
      thumbSrc = imagensLanches[item.nome] ? encodeURI(imagensLanches[item.nome]) : encodeURI(`assets/lanches_prontos/img/${item.nome}.png`);
    } else if (item.tipo === 'customizado') {
      const ing = item.ingredientes?.selecionados || item.ingredientes || {};
      const candidateName = obterNomePreviewIngrediente(ing);
      if (candidateName) {
        const imgFile = customImageMap[candidateName] || `${candidateName}.jpg`;
        thumbSrc = encodeURI(`assets/itens_custom/img/${imgFile}`);
      } else {
        thumbSrc = 'assets/itens_custom/default.png';
      }
    } else {
      thumbSrc = imagensLanches[item.nome] ? encodeURI(imagensLanches[item.nome]) : encodeURI(`assets/lanches_prontos/img/${item.nome}.png`);
    }
    const detalhe = item.descricao ? item.descricao.substring(0, 60) : (item.ingredientes ? 'Lanche Customizado' : '');
    const itemHTML = document.createElement('div');
    itemHTML.className = 'item-carrinho';
    itemHTML.innerHTML = `
      <img class="thumb" src="${thumbSrc}" alt="${item.nome}">
      <div class="item-info">
        <div class="item-titulo">
          <div class="nome">${item.nome}</div>
          <span class="item-quantidade">x${item.quantidade}</span>
        </div>
        <div class="detalhe">${detalhe}</div>
      </div>
      <div class="item-acao">
        <div class="preco-item">R$ ${subtotal.toFixed(2)}</div>
        <button class="btn-pequeno btn-remover" data-idx="${idx}">Remover</button>
      </div>
    `;
    container.appendChild(itemHTML);
  });
  const totalDiv = document.createElement('div');
  totalDiv.style.marginTop = '8px';
  totalDiv.style.fontWeight = '800';
  totalDiv.textContent = `Total: R$ ${total.toFixed(2)}`;
  container.appendChild(totalDiv);
  atualizarBadgeCarrinho();

  // Attach remover handlers
  document.querySelectorAll('.btn-remover').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (isNaN(idx)) return;
      carrinho.splice(idx, 1);
      atualizarCarrinhoUI();
      // Sync to server: clear then re-add current items
      try {
        await axiosInstance.delete('/deletarCarrinho');
        for (const item of carrinho) {
          await axiosInstance.post('/adicionarCarrinho', { item });
        }
      } catch (error) {
        console.error('Erro ao sincronizar carrinho:', error);
      }
    });
  });
  // persistir localmente
  try { saveCarrinhoLocal(); } catch (e) { /* ignore */ }
}

function atualizarBadgeCarrinho() {
  const badge = document.getElementById('badgeCarrinho');
  if (!badge) return;
  const totalItens = carrinho.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  badge.textContent = totalItens > 0 ? String(totalItens) : '';
  badge.classList.toggle('is-empty', totalItens === 0);
}

function exibirPedidos(pedidos) {
  const container = document.getElementById('pedidosLista');
  if (!pedidos.length) {
    container.innerHTML = '<p>Nenhum pedido ainda.</p>';
    return;
  }
  let html = '';
  pedidos.slice().reverse().forEach(ped => {
    const statusNormalizado = normalizarStatusPedido(ped.status);
    const statusTexto = statusNormalizado === 'pronto' ? 'Pronto' : 'Em produção';
    html += `<div class="pedido-item">
      <div class="pedido-item-topo">
        <strong>#${ped.id}</strong> - ${ped.cliente}
        <span class="pedido-item-status ${statusNormalizado === 'pronto' ? 'status-pronto' : 'status-producao'}">${statusTexto}</span>
      </div>
      ${ped.itens.length} item(ns) - Total: R$ ${calcularTotalPedido(ped.itens).toFixed(2)}<br>
      ${ped.observacao ? `<small>Observação: ${ped.observacao}</small><br>` : ''}
      <small>${new Date(ped.data).toLocaleString()}</small>
    </div>`;
  });
  container.innerHTML = html;
}

function calcularTotalPedido(itens) {
  return itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
}

function normalizarStatusPedido(status) {
  const valor = String(status || 'em produção').trim().toLowerCase();
  if (valor === 'pronto' || valor === 'finalizado') {
    return 'pronto';
  }
  return 'em produção';
}

// Desafio extra: sistema de fidelidade (pontos)
let pontosFidelidade = JSON.parse(localStorage.getItem('fofsway_pontos')) || {};

function adicionarPontosFidelidade(cliente) {
  if (!cliente) return;
  const pontosAtuais = pontosFidelidade[cliente] || 0;
  const pontosGanhos = Math.floor(carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) / 5); // 1 ponto a cada R$5
  const novosPontos = pontosAtuais + pontosGanhos;
  pontosFidelidade[cliente] = novosPontos;
  localStorage.setItem('fofsway_pontos', JSON.stringify(pontosFidelidade));
}

// Inicialização da página
function init() {
  renderizarCardsLanches();
  // inicializa UI de etapas para montar lanche
  try { setupMontagemUI(); } catch (e) { /* non-blocking */ }
  // melhora controle de quantidade: botão + / -
  try { enhanceQuantidadeControl(); } catch (e) { /* ignore */ }
  listarPedidos();
  // carregar carrinho do servidor para inicializar badge e UI
  (async () => {
    try {
      const resp = await axiosInstance.get('/listarCarrinho');
      carrinho = resp.data.carrinho || [];
      // if server returns empty but there is a local saved cart, restore it and sync to server
      if ((!carrinho || carrinho.length === 0)) {
        const local = loadCarrinhoLocal();
        if (local && local.length) {
          try {
            await axiosInstance.delete('/deletarCarrinho');
            for (const item of local) {
              await axiosInstance.post('/adicionarCarrinho', { item });
            }
            const fresh = await axiosInstance.get('/listarCarrinho');
            carrinho = fresh.data.carrinho || [];
          } catch (syncErr) {
            console.warn('Falha ao sincronizar carrinho local com servidor:', syncErr);
            // keep local cart as fallback
            carrinho = local;
          }
        }
      }
      atualizarCarrinhoUI();
    } catch (err) {
      console.warn('Não foi possível carregar o carrinho na inicialização.', err);
    }
  })();
  // Botões de navegação entre telas
  const btnProntos = document.getElementById('btnLanchesProntos');
  const btnMontar = document.getElementById('btnMontarLanche');
  const secaoProntos = document.getElementById('secaoLanchesProntos');
  const secaoMontar = document.getElementById('secaoMontarLanche');
  const navRealce = document.getElementById('navRealce');
  const btnAbrirCarrinho = document.getElementById('btnAbrirCarrinho');
  const btnFecharCarrinho = document.getElementById('btnFecharCarrinho');
  const carrinhoDialog = document.getElementById('carrinhoDialog');
  const itemAdicionadoDialog = document.getElementById('itemAdicionadoDialog');
  const itemAdicionadoTexto = document.getElementById('itemAdicionadoTexto');
  const btnFecharConfirmacao = document.getElementById('btnFecharConfirmacao');
  let botaoAtivoAtual = btnProntos;

  function atualizarRealce(botaoAtivo) {
    navRealce.style.left = `${botaoAtivo.offsetLeft}px`;
    navRealce.style.width = `${botaoAtivo.offsetWidth}px`;
  }

  atualizarRealce(btnProntos);
  atualizarBadgeCarrinho();

  function trocarRealce(botaoNovo) {
    if (botaoNovo === botaoAtivoAtual) {
      return;
    }

    navRealce.classList.remove('expandindo');
    navRealce.classList.add('encolhendo');

    navRealce.addEventListener('animationend', () => {
      atualizarRealce(botaoNovo);
      navRealce.classList.remove('encolhendo');
      navRealce.classList.add('expandindo');

      navRealce.addEventListener('animationend', () => {
        navRealce.classList.remove('expandindo');
      }, { once: true });
    }, { once: true });

    botaoAtivoAtual = botaoNovo;
  }

  function posicionarCarrinho() {
    const referencia = btnAbrirCarrinho.getBoundingClientRect();
    const maxWidth = 420;
    const largura = Math.min(maxWidth, window.innerWidth - 48);
    // try to align the dialog so its right edge matches the button right edge
    let esquerda = Math.round(referencia.right - largura + 4);
    // clamp
    esquerda = Math.max(12, Math.min(esquerda, window.innerWidth - largura - 12));

    carrinhoDialog.style.width = `${largura}px`;
    carrinhoDialog.style.left = `${esquerda}px`;
    carrinhoDialog.style.right = 'auto';
    carrinhoDialog.style.top = `${Math.round(referencia.bottom + 8)}px`;
  }

  function mostrarConfirmacaoItem(item) {
    const nomeItem = item?.nome || 'Item';
    itemAdicionadoTexto.textContent = `${nomeItem} foi adicionado ao carrinho.`;
    if (!itemAdicionadoDialog.open) {
      itemAdicionadoDialog.showModal();
    }
    clearTimeout(mostrarConfirmacaoItem.timeoutId);
    mostrarConfirmacaoItem.timeoutId = setTimeout(() => {
      if (itemAdicionadoDialog.open) {
        itemAdicionadoDialog.close();
      }
    }, 1800);
  }

  btnProntos.addEventListener('click', () => {
    btnProntos.classList.add('active');
    btnMontar.classList.remove('active');
    secaoProntos.classList.add('ativa');
    secaoMontar.classList.remove('ativa');
    trocarRealce(btnProntos);
  });
  btnMontar.addEventListener('click', () => {
    btnMontar.classList.add('active');
    btnProntos.classList.remove('active');
    secaoMontar.classList.add('ativa');
    secaoProntos.classList.remove('ativa');
    trocarRealce(btnMontar);
  });
  btnAbrirCarrinho.addEventListener('click', () => {
    if (!carrinhoDialog.open) {
      carrinhoDialog.showModal();
      requestAnimationFrame(posicionarCarrinho);
    }
  });
  btnFecharCarrinho.addEventListener('click', () => {
    carrinhoDialog.close();
  });
  carrinhoDialog.addEventListener('click', (event) => {
    if (event.target === carrinhoDialog) {
      carrinhoDialog.close();
    }
  });
  window.addEventListener('resize', () => {
    if (carrinhoDialog.open) {
      posicionarCarrinho();
    }
  });
  btnFecharConfirmacao.addEventListener('click', () => {
    itemAdicionadoDialog.close();
  });
  itemAdicionadoDialog.addEventListener('click', (event) => {
    if (event.target === itemAdicionadoDialog) {
      itemAdicionadoDialog.close();
    }
  });
  document.getElementById('btnLimparCarrinho').addEventListener('click', deletarCarrinho);
  document.getElementById('btnEnviarPedido').addEventListener('click', enviarPedido);
  const oldBtnAdd = document.getElementById('btnAdicionarMontagem');
  if (oldBtnAdd) oldBtnAdd.addEventListener('click', handleAdicionarMontagem);
}

function enhanceQuantidadeControl() {
  const container = document.querySelector('.montagem-quantidade');
  if (!container) return;
  container.innerHTML = '';
  const label = document.createElement('label');
  label.setAttribute('for', 'quantidadeMontagem');
  label.textContent = 'Quantidade:';
  const ctrl = document.createElement('div');
  ctrl.className = 'qty-control';
  ctrl.innerHTML = `
    <button type="button" id="qtyDec">−</button>
    <input type="number" id="quantidadeMontagem" min="1" value="1">
    <button type="button" id="qtyInc">+</button>
  `;
  container.appendChild(label);
  container.appendChild(ctrl);

  const input = ctrl.querySelector('#quantidadeMontagem');
  const btnDec = ctrl.querySelector('#qtyDec');
  const btnInc = ctrl.querySelector('#qtyInc');

  btnDec.addEventListener('click', () => {
    let v = parseInt(input.value) || 1;
    v = Math.max(1, v - 1);
    input.value = v;
  });
  btnInc.addEventListener('click', () => {
    let v = parseInt(input.value) || 1;
    v = v + 1;
    input.value = v;
  });
  input.addEventListener('change', () => {
    let v = parseInt(input.value) || 1;
    if (v < 1) v = 1;
    input.value = v;
  });
}

// Aguarda o DOM carregar
document.addEventListener('DOMContentLoaded', init);
