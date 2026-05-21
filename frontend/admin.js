const axiosInstance = axios.create();
const ADMIN_TOKEN_STORAGE = 'fofsway_admin_token';

function getStoredAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE) || '';
  } catch (error) {
    return '';
  }
}

function setStoredAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE);
    }
  } catch (error) {
    // ignore
  }
}

function applyAdminToken(token) {
  if (token) {
    axiosInstance.defaults.headers.common['X-Admin-Token'] = token;
    return;
  }
  delete axiosInstance.defaults.headers.common['X-Admin-Token'];
}

function formatarData(iso) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function calcularTotalPedido(itens) {
  return (itens || []).reduce((acc, item) => acc + ((item.preco || 0) * (item.quantidade || 1)), 0);
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function normalizarStatusPedido(status) {
  const valor = String(status || 'em produção').trim().toLowerCase();
  if (valor === 'pronto' || valor === 'finalizado') {
    return 'pronto';
  }
  return 'em produção';
}

function formatarStatusPedido(status) {
  return normalizarStatusPedido(status) === 'pronto' ? 'Pronto' : 'Em produção';
}

function mostrarLogin() {
  document.getElementById('adminLoginView').hidden = false;
  document.getElementById('adminDashboardView').hidden = true;
  document.getElementById('btnSairAdm').hidden = true;
}

function mostrarDashboard() {
  document.getElementById('adminLoginView').hidden = true;
  document.getElementById('adminDashboardView').hidden = false;
  document.getElementById('btnSairAdm').hidden = false;
}

function renderResumo(pedidos) {
  const container = document.getElementById('adminResumo');
  const clientes = new Set();
  pedidos.forEach((pedido) => {
    if (pedido?.tokenSessao) {
      clientes.add(pedido.tokenSessao);
    }
  });
  const totalPedidos = pedidos.length;
  const totalFaturado = pedidos.reduce((acc, pedido) => acc + calcularTotalPedido(pedido.itens), 0);

  container.innerHTML = `
    <div class="admin-metricas">
      <article class="admin-metrica-card">
        <span class="admin-metrica-label">Pedidos</span>
        <strong>${totalPedidos}</strong>
      </article>
      <article class="admin-metrica-card">
        <span class="admin-metrica-label">Clientes por token</span>
        <strong>${clientes.size}</strong>
      </article>
      <article class="admin-metrica-card">
        <span class="admin-metrica-label">Total faturado</span>
        <strong>${formatarMoeda(totalFaturado)}</strong>
      </article>
    </div>
  `;
}

function renderPedidos(pedidos) {
  const container = document.getElementById('adminPedidosLista');
  if (!pedidos.length) {
    container.innerHTML = '<p class="admin-vazio">Nenhum pedido encontrado.</p>';
    return;
  }

  const html = pedidos.slice().reverse().map((pedido) => {
    const statusNormalizado = normalizarStatusPedido(pedido.status);
    const pedidoFinalizado = statusNormalizado === 'pronto';
    const itens = (pedido.itens || []).map((item) => {
      const quantidade = item.quantidade || 1;
      const subtotal = (item.preco || 0) * quantidade;
      return `
        <div class="admin-item-linha">
          <div>
            <strong>${item.nome || 'Item'}</strong>
            ${item.descricao ? `<span class="admin-item-descricao">${item.descricao}</span>` : ''}
            <span>${quantidade}x</span>
          </div>
          <span>${formatarMoeda(subtotal)}</span>
        </div>
      `;
    }).join('');

    return `
      <article class="admin-pedido-card">
        <div class="admin-pedido-cabecalho">
          <div>
            <p class="admin-cliente-rotulo">${pedido.clienteRotulo || 'Cliente'}</p>
            <h3>${pedido.cliente || 'Sem nome'}</h3>
          </div>
          <div class="admin-pedido-status ${pedidoFinalizado ? 'status-pronto' : 'status-producao'}">${formatarStatusPedido(pedido.status)}</div>
        </div>
        <div class="admin-pedido-meta">
          <span class="admin-pedido-token">Sessão: ${pedido.tokenSessao || pedido.instanceToken || '-'}</span>
          <span class="admin-pedido-data">${formatarData(pedido.data)}</span>
        </div>
        <div class="admin-pedido-itens">${itens}</div>
        <div class="admin-pedido-acoes">
          <button class="btn-secundario admin-btn-finalizar" type="button" data-id="${pedido.id}" ${pedidoFinalizado ? 'disabled' : ''}>
            ${pedidoFinalizado ? 'Pedido finalizado' : 'Finalizar pedido'}
          </button>
        </div>
        <div class="admin-pedido-total">Total: ${formatarMoeda(calcularTotalPedido(pedido.itens || []))}</div>
      </article>
    `;
  }).join('');

  container.innerHTML = html;

  container.querySelectorAll('.admin-btn-finalizar').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const idPedido = botao.getAttribute('data-id');
      if (!idPedido || botao.disabled) {
        return;
      }

      botao.disabled = true;
      const textoOriginal = botao.textContent;
      botao.textContent = 'Finalizando...';

      try {
        await axiosInstance.put('/finalizarPedido', { idPedido });
        await carregarPedidosAdmin();
      } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        botao.disabled = false;
        botao.textContent = textoOriginal || 'Finalizar pedido';
      }
    });
  });
}

async function carregarPedidosAdmin() {
  const response = await axiosInstance.get('/listarPedidos');
  const pedidos = response.data.pedidos || [];
  if (!response.data.isAdmin) {
    setStoredAdminToken('');
    applyAdminToken('');
    mostrarLogin();
    return;
  }
  mostrarDashboard();
  renderResumo(pedidos);
  renderPedidos(pedidos);
}

async function tentarLogin(event) {
  event.preventDefault();
  const login = document.getElementById('adminLogin').value.trim();
  const senha = document.getElementById('adminSenha').value.trim();
  const erro = document.getElementById('adminLoginErro');
  erro.textContent = '';

  try {
    const response = await axiosInstance.post('/admin/login', { login, senha });
    const token = response.data.token || '';
    if (!token) {
      throw new Error('Token não retornado pelo backend.');
    }
    setStoredAdminToken(token);
    applyAdminToken(token);
    await carregarPedidosAdmin();
  } catch (error) {
    setStoredAdminToken('');
    applyAdminToken('');
    mostrarLogin();
    erro.textContent = error.response?.data?.erro || 'Não foi possível autenticar o administrador.';
  }
}

function sairAdmin() {
  setStoredAdminToken('');
  applyAdminToken('');
  document.getElementById('adminLogin').value = '';
  document.getElementById('adminSenha').value = '';
  document.getElementById('adminLoginErro').textContent = '';
  mostrarLogin();
}

function initAdmin() {
  const token = getStoredAdminToken();
  applyAdminToken(token);

  document.getElementById('btnVoltarLoja').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('adminLoginForm').addEventListener('submit', tentarLogin);
  document.getElementById('btnSairAdm').addEventListener('click', sairAdmin);
  document.getElementById('btnAtualizarPedidos').addEventListener('click', () => {
    carregarPedidosAdmin().catch((error) => {
      console.error('Erro ao atualizar pedidos do admin:', error);
    });
  });

  if (token) {
    carregarPedidosAdmin().catch((error) => {
      console.error('Erro ao carregar painel admin:', error);
      mostrarLogin();
    });
    return;
  }

  mostrarLogin();
}

document.addEventListener('DOMContentLoaded', initAdmin);
