const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

app.use(cors()); // permite todas as origens
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Dados em memória
let carrinhoAtual = [];        // array de itens do carrinho
let pedidosRealizados = [];     // array de pedidos finalizados
let proximoIdPedido = 1;

// Rota para listar todos os pedidos
app.get('/listarPedidos', (req, res) => {
  res.json({ pedidos: pedidosRealizados });
});

// Rota para obter o carrinho atual
app.get('/listarCarrinho', (req, res) => {
  res.json({ carrinho: carrinhoAtual });
});

// (removido) endpoint /listarImagensCustom — frontend usa caminhos estáticos

// Rota para adicionar item ao carrinho
app.post('/adicionarCarrinho', (req, res) => {
  const { item } = req.body;
  if (!item) {
    return res.status(400).json({ erro: 'Item não fornecido' });
  }
  carrinhoAtual.push(item);
  res.json({ mensagem: 'Item adicionado ao carrinho com sucesso', carrinho: carrinhoAtual });
});

// Rota para deletar (limpar) o carrinho
app.delete('/deletarCarrinho', (req, res) => {
  carrinhoAtual = [];
  res.json({ mensagem: 'Carrinho limpo com sucesso', carrinho: carrinhoAtual });
});

// Rota para enviar pedido (converte carrinho em pedido)
app.put('/enviarPedido', (req, res) => {
  const { nomeCliente, observacaoPedido } = req.body;
  if (!nomeCliente || nomeCliente.trim() === '') {
    return res.status(400).json({ erro: 'Nome do cliente é obrigatório' });
  }
  if (carrinhoAtual.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }
  
  const novoPedido = {
    id: proximoIdPedido++,
    cliente: nomeCliente,
    itens: [...carrinhoAtual],
    observacao: observacaoPedido ? String(observacaoPedido).trim() : '',
    data: new Date().toISOString(),
    status: 'recebido'
  };
  pedidosRealizados.push(novoPedido);
  carrinhoAtual = []; // esvazia carrinho após envio
  res.json({ mensagem: 'Pedido enviado com sucesso', pedido: novoPedido });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
