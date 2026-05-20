// Configuração da API
const axiosInstance = axios.create(); // usa a mesma origem

// Estado global
let carrinho = [];

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
    mostrarNotificacao('Carrinho limpo com sucesso!', 'sucesso', 'Carrinho');
  } catch (error) {
    console.error('Erro ao limpar carrinho:', error);
    mostrarNotificacao('Erro ao limpar carrinho.', 'erro', 'Erro');
  }
}

// Função para enviar pedido (PUT)
async function enviarPedido() {
  const nomeCliente = document.getElementById('nomeCliente').value.trim();
  if (!nomeCliente) {
    mostrarNotificacao('Por favor, informe seu nome antes de enviar o pedido.', 'aviso', 'Campo obrigatório');
    return;
  }
  if (carrinho.length === 0) {
    mostrarNotificacao('Carrinho vazio. Adicione itens antes de enviar.', 'aviso', 'Carrinho vazio');
    return;
  }
  try {
    const response = await axiosInstance.put('/enviarPedido', { nomeCliente });
    mostrarNotificacao(response.data.mensagem ? `Pedido enviado! ${response.data.mensagem}` : 'Pedido enviado com sucesso!', 'sucesso', 'Pedido enviado');
    // Após enviar, o carrinho é esvaziado no backend, então atualizamos o estado local
    carrinho = [];
    atualizarCarrinhoUI();
    document.getElementById('nomeCliente').value = '';
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
  const item = {
    tipo: 'customizado',
    nome: 'Lanche Customizado',
    ingredientes: ingredientes,
    preco: precoBase,
    quantidade: quantidade
  };
  return await adicionarCarrinho(item);
}

// ---------- FUNÇÕES DE UI e RENDERIZAÇÃO ----------

// Dados extraídos do LANCHES.MD
const lanchesProntos = [
  { nome: 'FofFrango Club', descricao: 'Frango grelhado, queijo, tomate, alface, maionese especial e pão macio.', preco: 28.90 },
  { nome: 'FofChipotle Especial', descricao: 'Frango, queijo derretido, tomate, molho chipotle defumado e maionese cremosa.', preco: 28.90 },
  { nome: 'FofVeggie Supreme (Clássico)', descricao: 'Queijo vegano, tomate, alface, cebola roxa, orégano e molho especial da casa.', preco: 28.90 },
  { nome: 'FofVeggie Supreme (Parmesão)', descricao: 'Queijo parmesão vegano, tomate, alface, orégano e maionese temperada vegana.', preco: 28.90 },
  { nome: 'FofVeggie Supreme (Defumado)', descricao: 'Queijo vegano, tomate, alface, picles, molho defumado e toque de ervas.', preco: 28.90 },
  { nome: 'FofFrango Club (Pesto)', descricao: 'Frango grelhado, queijo, tomate, alface e molho pesto artesanal.', preco: 28.90 }
];

function renderizarCardsLanches() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';
  lanchesProntos.forEach((lanche, idx) => {
    const card = document.createElement('div');
    card.className = 'card-lanche';
    card.innerHTML = `
      <div class="card-conteudo">
        <h3>${lanche.nome}</h3>
        <p>${lanche.descricao}</p>
        <button class="btn-adicionar" data-idx="${idx}">ADICIONAR AO CARRINHO R$ ${lanche.preco.toFixed(2)}</button>
      </div>
    `;
    grid.appendChild(card);
  });
  // Adiciona eventos aos botões
  document.querySelectorAll('.btn-adicionar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = btn.getAttribute('data-idx');
      const lanche = lanchesProntos[idx];
      adicionarLancheAoCarrinho(lanche, 1);
    });
  });
}

// Configuração das categorias para montagem de lanche
const categoriasMontagem = {
  pao: {
    nome: 'Pão *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Pão Australiano', 'Pão Integral', 'Pão de Trigo']
  },
  carne: {
    nome: 'Carne *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Frango', 'Carne Bovina', 'Peru']
  },
  queijo: {
    nome: 'Queijo *',
    obrigatorio: true,
    tipo: 'radio',
    opcoes: ['Mussarela', 'Prato', 'Cheddar']
  },
  adicionais: {
    nome: 'Adicionais (opcional, múltipla escolha)',
    obrigatorio: false,
    tipo: 'checkbox',
    opcoes: ['Bacon', 'Ovo', 'Tomate', 'Alface']
  },
  molhos: {
    nome: 'Temperos e molhos (opcional, múltipla escolha)',
    obrigatorio: false,
    tipo: 'checkbox',
    opcoes: ['Maionese', 'Ketchup', 'Mostarda', 'Barbecue', 'Pesto']
  }
};

function renderizarFormMontagem() {
  const container = document.querySelector('.categorias-container');
  container.innerHTML = '';
  for (const [key, cat] of Object.entries(categoriasMontagem)) {
    const divCategoria = document.createElement('div');
    divCategoria.className = 'categoria';
    divCategoria.innerHTML = `<h4>${cat.nome}</h4><div class="opcoes" id="${key}-opcoes"></div>`;
    container.appendChild(divCategoria);
    const opcoesDiv = divCategoria.querySelector('.opcoes');
    cat.opcoes.forEach(op => {
      const input = document.createElement('input');
      input.type = cat.tipo;
      input.name = key;
      input.value = op;
      const label = document.createElement('label');
      label.appendChild(input);
      label.appendChild(document.createTextNode(op));
      opcoesDiv.appendChild(label);
    });
  }
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
  const dados = obterDadosMontagem();
  if (!dados) return;
  const quantidadeInput = document.getElementById('quantidadeMontagem');
  let quantidade = parseInt(quantidadeInput.value);
  if (isNaN(quantidade) || quantidade < 1) quantidade = 1;
  const montagem = {
    ingredientes: dados,
    quantidade: quantidade,
    precoBase: 32.90 // preço do customizado
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
  let html = '';
  let total = 0;
  carrinho.forEach((item, idx) => {
    const subtotal = item.preco * item.quantidade;
    total += subtotal;
    if (item.tipo === 'pronto') {
      html += `<div class="item-carrinho">
        <strong>${item.nome}</strong> x${item.quantidade} - R$ ${subtotal.toFixed(2)}<br>
        <small>${item.descricao.substring(0, 50)}</small>
      </div>`;
    } else {
      let ingredientesStr = '';
      if (item.ingredientes) {
        const pao = item.ingredientes.pao || '';
        const carne = item.ingredientes.carne || '';
        const extras = [...(item.ingredientes.adicionais || []), ...(item.ingredientes.molhos || [])].join(', ');
        ingredientesStr = `${pao}, ${carne}, ${extras ? ' + ' + extras : ''}`;
      }
      html += `<div class="item-carrinho">
        <strong>Lanche Customizado</strong> x${item.quantidade} - R$ ${subtotal.toFixed(2)}<br>
        <small>${ingredientesStr.substring(0, 80)}</small>
      </div>`;
    }
  });
  html += `<div style="margin-top: 8px; font-weight: bold;">Total: R$ ${total.toFixed(2)}</div>`;
  container.innerHTML = html;
  atualizarBadgeCarrinho();
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
    html += `<div class="pedido-item">
      <strong>#${ped.id}</strong> - ${ped.cliente}<br>
      ${ped.itens.length} item(ns) - Total: R$ ${calcularTotalPedido(ped.itens).toFixed(2)}<br>
      <small>${new Date(ped.data).toLocaleString()}</small>
    </div>`;
  });
  container.innerHTML = html;
}

function calcularTotalPedido(itens) {
  return itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
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
  renderizarFormMontagem();
  listarPedidos();
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
    const largura = Math.min(760, window.innerWidth - 24);
    const esquerda = Math.max(12, referencia.right - largura);

    carrinhoDialog.style.width = `${largura}px`;
    carrinhoDialog.style.left = `${esquerda}px`;
    carrinhoDialog.style.right = 'auto';
    carrinhoDialog.style.top = `${Math.round(referencia.bottom + 12)}px`;
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
  document.getElementById('btnAdicionarMontagem').addEventListener('click', handleAdicionarMontagem);
}

// Aguarda o DOM carregar
document.addEventListener('DOMContentLoaded', init);
