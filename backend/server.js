const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 8080;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ADMIN-FOFSWAY';
const ADMIN_LOGIN = 'adm';
const ADMIN_SENHA = 'adm';
const INSTANCE_COOKIE_NAME = 'fofsway_instance_token';

app.use(cors()); // permite todas as origens
app.use(express.json());

// Tratar erros de parse JSON para evitar crash do servidor
app.use((err, req, res, next) => {
  if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed')) {
    console.warn('Erro de parse de JSON na requisição:', err.message || err);
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  return next(err);
});

// Arquivo para persistir pontos de fidelidade
const PONTOS_FILE = path.join(__dirname, 'pontos.json');

function carregarPontos() {
  try {
    const raw = fs.readFileSync(PONTOS_FILE, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function salvarPontos(pontos) {
  try {
    fs.writeFileSync(PONTOS_FILE, JSON.stringify(pontos, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar pontos:', e);
  }
}

function obterPontosPorToken(token) {
  const pontos = carregarPontos();
  return pontos[token] || 0;
}

function adicionarPontosACliente(token, quantidade) {
  const pontos = carregarPontos();
  pontos[token] = (pontos[token] || 0) + Number(quantidade || 0);
  salvarPontos(pontos);
  return pontos[token];
}

function resgatarPontosDoCliente(token, quantidade) {
  const pontos = carregarPontos();
  const atual = pontos[token] || 0;
  const q = Number(quantidade || 0);
  if (q <= 0 || atual < q) return null;
  pontos[token] = atual - q;
  salvarPontos(pontos);
  return pontos[token];
}

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Dados em memória
let pedidosRealizados = [];     // array de pedidos finalizados
let proximoIdPedido = 1;
const estadosPorToken = new Map();
const rotulosClientePorToken = new Map();
let proximoIndiceCliente = 1;

function lerCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce((acumulado, parte) => {
    const [chaveBruta, ...valorPartes] = parte.split('=');
    const chave = chaveBruta.trim();
    if (!chave) {
      return acumulado;
    }
    const valor = valorPartes.join('=').trim();
    acumulado[chave] = decodeURIComponent(valor || '');
    return acumulado;
  }, {});
}

function definirCookieInstancia(res, token) {
  res.setHeader('Set-Cookie', `${INSTANCE_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
}

function isAdminToken(token) {
  return token === ADMIN_TOKEN;
}

function obterRotuloClientePorToken(token) {
  if (isAdminToken(token)) {
    return 'Cliente ADM';
  }

  if (!rotulosClientePorToken.has(token)) {
    rotulosClientePorToken.set(token, `Cliente ${proximoIndiceCliente++}`);
  }

  return rotulosClientePorToken.get(token);
}

function serializarPedido(pedido) {
  return {
    ...pedido,
    clienteRotulo: obterRotuloClientePorToken(pedido.instanceToken),
    tokenSessao: pedido.instanceToken,
    status: pedido.status || 'em produção'
  };
}

function localizarPedidoPorId(idPedido) {
  return pedidosRealizados.find((pedido) => String(pedido.id) === String(idPedido));
}

function calcularTotalItens(itens) {
  return (Array.isArray(itens) ? itens : []).reduce((total, item) => {
    const preco = Number(item?.preco) || 0;
    const quantidade = Number(item?.quantidade) || 1;
    return total + (preco * quantidade);
  }, 0);
}

function obterEstadoInstancia(token) {
  if (!estadosPorToken.has(token)) {
    estadosPorToken.set(token, {
      carrinho: [],
      pedidos: []
    });
  }

  return estadosPorToken.get(token);
}

function obterTokenRequisicao(req, res, criarSeAusente = true) {
  const headers = req.headers || {};
  const cookies = lerCookies(headers.cookie);
  const tokenInformado = String(
    headers['x-instance-token'] ||
    headers['x-admin-token'] ||
    req.body?.instanceToken ||
    cookies[INSTANCE_COOKIE_NAME] ||
    ''
  ).trim();

  if (tokenInformado) {
    res.setHeader('X-Instance-Token', tokenInformado);
    return tokenInformado;
  }

  if (!criarSeAusente) {
    return null;
  }

  const tokenGerado = crypto.randomUUID();
  definirCookieInstancia(res, tokenGerado);
  res.setHeader('X-Instance-Token', tokenGerado);
  return tokenGerado;
}

app.get('/obterTokenInstancia', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);
  res.json({ token, isAdmin: isAdminToken(token) });
});

app.post('/admin/login', (req, res) => {
  const login = String(req.body?.login || '').trim();
  const senha = String(req.body?.senha || '').trim();

  if (login !== ADMIN_LOGIN || senha !== ADMIN_SENHA) {
    return res.status(401).json({ erro: 'Credenciais de administrador inválidas.' });
  }

  res.json({ token: ADMIN_TOKEN, isAdmin: true });
});

// Rota para listar todos os pedidos
app.get('/listarPedidos', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);

  if (isAdminToken(token)) {
    res.json({ pedidos: pedidosRealizados.map(serializarPedido), token, isAdmin: true });
    return;
  }

  const pedidosDaInstancia = pedidosRealizados
    .filter((pedido) => pedido.instanceToken === token)
    .map(serializarPedido);
  res.json({ pedidos: pedidosDaInstancia, token, isAdmin: false });
});

// Rota para obter o carrinho atual
app.get('/listarCarrinho', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);
  const estado = obterEstadoInstancia(token);
  res.json({ carrinho: estado.carrinho, token, isAdmin: isAdminToken(token) });
});

// Rota para adicionar item ao carrinho
app.post('/adicionarCarrinho', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);
  const estado = obterEstadoInstancia(token);
  const { item } = req.body;
  if (!item) {
    return res.status(400).json({ erro: 'Item não fornecido' });
  }
  estado.carrinho.push(item);
  res.json({ mensagem: 'Item adicionado ao carrinho com sucesso', carrinho: estado.carrinho, token, isAdmin: isAdminToken(token) });
});

// Rota para deletar (limpar) o carrinho
app.delete('/deletarCarrinho', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);
  const estado = obterEstadoInstancia(token);
  estado.carrinho = [];
  res.json({ mensagem: 'Carrinho limpo com sucesso', carrinho: estado.carrinho, token, isAdmin: isAdminToken(token) });
});

// Rota para enviar pedido (converte carrinho em pedido)
app.put('/enviarPedido', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);
  const estado = obterEstadoInstancia(token);
  const { nomeCliente, observacaoPedido, usarPontosDesconto } = req.body;
  if (!nomeCliente || nomeCliente.trim() === '') {
    return res.status(400).json({ erro: 'Nome do cliente é obrigatório' });
  }
  if (estado.carrinho.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }

  const totalBruto = calcularTotalItens(estado.carrinho);
  const pontosAtuais = obterPontosPorToken(token);
  const aplicarDesconto = Boolean(usarPontosDesconto) && pontosAtuais >= 5;
  const desconto = aplicarDesconto ? Number((totalBruto * 0.2).toFixed(2)) : 0;
  const totalFinal = Number((totalBruto - desconto).toFixed(2));
  const pontosUsados = aplicarDesconto ? 5 : 0;
  const pontosRestantes = aplicarDesconto ? resgatarPontosDoCliente(token, 5) : pontosAtuais;

  if (Boolean(usarPontosDesconto) && !aplicarDesconto) {
    return res.status(400).json({ erro: 'Você precisa de pelo menos 5 pontos para usar o desconto.' });
  }
  
  const novoPedido = {
    id: proximoIdPedido++,
    instanceToken: token,
    isAdminToken: isAdminToken(token),
    cliente: nomeCliente,
    itens: [...estado.carrinho],
    observacao: observacaoPedido ? String(observacaoPedido).trim() : '',
    data: new Date().toISOString(),
    status: 'em produção',
    totalBruto,
    desconto,
    totalFinal,
    pontosUsados
  };
  pedidosRealizados.push(novoPedido);
  estado.pedidos.push(novoPedido);
  estado.carrinho = []; // esvazia carrinho após envio
  res.json({
    mensagem: aplicarDesconto
      ? 'Pedido enviado com 20% de desconto usando 5 pontos.'
      : 'Pedido enviado com sucesso',
    pedido: novoPedido,
    totalBruto,
    desconto,
    totalFinal,
    pontosUsados,
    pontosRestantes,
    token,
    isAdmin: isAdminToken(token)
  });
});

app.put('/finalizarPedido', (req, res) => {
  const token = obterTokenRequisicao(req, res, false);

  if (!isAdminToken(token)) {
    return res.status(401).json({ erro: 'Apenas administradores podem finalizar pedidos.' });
  }

  const idPedido = req.body?.idPedido;
  if (!idPedido) {
    return res.status(400).json({ erro: 'ID do pedido é obrigatório.' });
  }

  const pedido = localizarPedidoPorId(idPedido);
  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado.' });
  }

  pedido.status = 'pronto';

  // Atribuir pontos de fidelidade ao cliente responsável pelo pedido
  // Regra: somar a propriedade `quantidade` de cada item (fallback 1 por item)
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const pontosGanho = itens.reduce((soma, it) => soma + (Number(it.quantidade) || 1), 0);
  const pontosTotais = adicionarPontosACliente(pedido.instanceToken, pontosGanho);

  res.json({
    mensagem: 'Pedido finalizado com sucesso.',
    pedido: serializarPedido(pedido),
    pontosGanho,
    pontosTotais,
    token,
    isAdmin: true
  });
});

// Rota para consultar pontos de fidelidade
app.get('/pontos', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);

  if (isAdminToken(token)) {
    const todos = carregarPontos();
    res.json({ pontos: todos, token, isAdmin: true });
    return;
  }

  const pontos = obterPontosPorToken(token);
  res.json({ pontos, token, isAdmin: false });
});

// Rota para resgatar pontos (cliente)
app.post('/pontos/resgatar', (req, res) => {
  const token = obterTokenRequisicao(req, res, true);

  if (isAdminToken(token)) {
    return res.status(401).json({ erro: 'Administrador não pode resgatar pontos.' });
  }

  const quantidade = Number(req.body?.pontos);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade de pontos inválida.' });
  }

  const novoTotal = resgatarPontosDoCliente(token, quantidade);
  if (novoTotal === null) {
    return res.status(400).json({ erro: 'Pontos insuficientes.' });
  }

  res.json({ mensagem: 'Pontos resgatados com sucesso.', pontosRestantes: novoTotal, token });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
