// --- IMPORTAÇÃO DOS MÓDULOS FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO SEU FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBVQIjxjUyvRJTNDU5nyhKbjH4TS3c0MNY",
  authDomain: "dindelicia-397c0.firebaseapp.com",
  projectId: "dindelicia-397c0",
  storageBucket: "dindelicia-397c0.firebasestorage.app",
  messagingSenderId: "324178802093",
  appId: "1:324178802093:web:d70634c3235ec02fc21d24"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONFIGURAÇÕES GERAIS ---
const CONFIG = {
  whats: "558597124169",
  loja: "DinDelicia",
  senha: "29032015",
  pixChave: "b30d05e0-de4f-46bf-9902-e146b53fa33e", 
  pixNome: "DinDelicia Gourmet",
  pixCidade: "BEBERIBE"
};

// --- ESTADO DA APLICAÇÃO ---
let sabores = [];
let banners = [];
let historicoVendas = [];
let taxaEntregaConfig = 5.00;
let carrinho = [];
let currentSlide = 0;

// --- SINCRONIZAÇÃO EM TEMPO REAL (FIREBASE) ---

// Escutar Sabores
onSnapshot(collection(db, "sabores"), (snapshot) => {
  sabores = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderVitrine();
  if(document.getElementById('view-admin').style.display === 'block') renderAdmin();
});

// Escutar Configurações (Banners e Taxa)
onSnapshot(collection(db, "config"), (snapshot) => {
  snapshot.forEach(d => {
    if(d.id === "banners") { 
        banners = d.data().lista || []; 
        renderCarrossel(); 
        // ATUALIZAÇÃO AUTOMÁTICA NO PAINEL ADM
        if(document.getElementById('view-admin').style.display === 'block') renderAdmin();
    }
    if(d.id === "taxa") { 
        taxaEntregaConfig = parseFloat(d.data().valor) || 0; 
        if(document.getElementById('view-admin').style.display === 'block') renderAdmin();
    }
  });
});

// Escutar Vendas
onSnapshot(query(collection(db, "vendas"), orderBy("data", "desc")), (snapshot) => {
  historicoVendas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if(document.getElementById('view-admin').style.display === 'block') renderRelatorios();
});

// --- FUNÇÕES DE AUXÍLIO ---
function calcularCRC16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// --- NAVEGAÇÃO ---
window.showTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  if(event) event.currentTarget.classList.add('active');
  if(tabId === 'tab-relatorios') renderRelatorios();
}

// --- CARROSSEL ---
function renderCarrossel() {
  const header = document.getElementById('header-carrossel');
  if(!header || !banners.length) return;
  header.innerHTML = banners.map((url, i) => `<img src="${url}" class="slide ${i === 0 ? 'active' : ''}">`).join('') + `<div class="header-overlay"></div>`;
  
  clearInterval(window.carrosselTimer);
  if (banners.length > 1) { 
    window.carrosselTimer = setInterval(() => {
      const slides = document.querySelectorAll('.slide');
      if(!slides.length) return;
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 4000); 
  }
}

// --- VITRINE ---
function renderVitrine() {
  const cardapio = document.getElementById('cardapio');
  if(!cardapio) return;
  cardapio.innerHTML = sabores.map(s => {
    const esgotado = s.estoque <= 0;
    return `
    <div class="item-dindin">
      <div class="img-container"><img src="${s.foto || 'https://via.placeholder.com/150'}"></div>
      <div class="item-info">
        <h3>${s.nome}</h3>
        <p>R$ ${parseFloat(s.preco).toFixed(2).replace('.',',')}</p>
        <small style="color:${esgotado ? 'red' : 'green'}">${esgotado ? 'ESGOTADO' : 'Estoque: ' + s.estoque}</small>
      </div>
      <button class="btn-add" ${esgotado ? 'disabled' : ''} onclick="addCarrinho('${s.id}')">
        ${esgotado ? 'INDISPONÍVEL' : 'ADICIONAR'}
      </button>
    </div>`}).join('');
  atualizarBarra();
}

window.addCarrinho = function(id) {
  const sabor = sabores.find(s => s.id === id);
  const qtdNoCart = carrinho.filter(c => c.id === id).length;
  if(qtdNoCart >= sabor.estoque) return alert("Limite de estoque atingido!");
  carrinho.push({...sabor});
  atualizarBarra();
}

function atualizarBarra() {
  const sub = carrinho.reduce((a, b) => a + parseFloat(b.preco), 0);
  document.getElementById('cart-count').innerText = carrinho.length;
  document.getElementById('cart-total').innerText = `R$ ${sub.toFixed(2).replace('.',',')}`;
}

// --- PIX E TOTAIS ---
window.atualizarTotais = function() {
  const sub = carrinho.reduce((a, b) => a + parseFloat(b.preco), 0);
  const metodo = document.getElementById('metodo-entrega').value;
  const taxa = metodo === 'entrega' ? taxaEntregaConfig : 0;
  const total = sub + taxa;
  const totalF = total.toFixed(2);

  document.getElementById('campo-endereco').style.display = metodo === 'entrega' ? 'block' : 'none';
  document.getElementById('row-taxa').style.display = metodo === 'entrega' ? 'flex' : 'none';
  document.getElementById('sub-val').innerText = `R$ ${sub.toFixed(2).replace('.',',')}`;
  document.getElementById('tax-val').innerText = `R$ ${taxa.toFixed(2).replace('.',',')}`;
  document.getElementById('total-val').innerText = `R$ ${total.toFixed(2).replace('.',',')}`;

  const chave = CONFIG.pixChave.trim();
  const nome = CONFIG.pixNome.trim();
  const cidade = CONFIG.pixCidade.trim();
  let pix = "000201010211";
  let merchantInfo = `0014br.gov.bcb.pix01${chave.length.toString().padStart(2, '0')}${chave}`;
  pix += `26${merchantInfo.length.toString().padStart(2, '0')}${merchantInfo}`;
  pix += `52040000530398654${totalF.length.toString().padStart(2, '0')}${totalF}5802BR`;
  pix += `59${nome.length.toString().padStart(2, '0')}${nome}`;
  pix += `60${cidade.length.toString().padStart(2, '0')}${cidade}62190515PAGAMENTODINDIN6304`;
  document.getElementById('pix-code').innerText = pix + calcularCRC16(pix);
}

// --- MODAL ---
window.abrirModal = function() {
  if (!carrinho.length) return;
  document.getElementById('modal-cart').style.display = 'block';
  const resumo = carrinho.reduce((acc, item) => { acc[item.nome] = (acc[item.nome] || 0) + 1; return acc; }, {});
  document.getElementById('lista-itens-carrinho').innerHTML = Object.keys(resumo).map(nome => `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #f0f0f0;">
      <span><strong>${resumo[nome]}x</strong> ${nome}</span>
      <button onclick="remover('${nome}')" style="color:red; border:none; background:none; cursor:pointer;">🗑️</button>
    </div>`).join('');
  atualizarTotais();
  alternarPixVisual();
}

window.alternarPixVisual = function() {
  const p = document.getElementById('metodo-pagamento').value;
  document.getElementById('area-pix').style.display = p === 'Pix' ? 'block' : 'none';
  document.getElementById('campo-troco').style.display = p === 'Dinheiro' ? 'block' : 'none';
}

window.remover = function(nome) {
  const idx = carrinho.findIndex(c => c.nome === nome);
  if (idx > -1) carrinho.splice(idx, 1);
  if (!carrinho.length) fecharModal(); else abrirModal();
  atualizarBarra();
}

window.fecharModal = function() { document.getElementById('modal-cart').style.display = 'none'; }

// --- FINALIZAR (FIREBASE) ---
window.enviarWhats = async function() {
  const nome = document.getElementById('c-nome').value;
  const mEntrega = document.getElementById('metodo-entrega').value;
  const mPag = document.getElementById('metodo-pagamento').value;
  const end = document.getElementById('c-end').value;
  const totalStr = document.getElementById('total-val').innerText;

  if (!nome) return alert("Digite seu nome!");

  for (let item of carrinho) {
    const dindinRef = doc(db, "sabores", item.id);
    const snap = await getDoc(dindinRef);
    if (snap.exists()) {
      let novoEstoque = Math.max(0, snap.data().estoque - 1);
      await updateDoc(dindinRef, { estoque: novoEstoque });
    }
  }

  await addDoc(collection(db, "vendas"), {
    cliente: nome,
    total: parseFloat(totalStr.replace('R$ ','').replace(',','.')),
    itens: carrinho.map(i => ({nome: i.nome, id: i.id})),
    data: new Date().toISOString()
  });

  const resumo = carrinho.reduce((acc, item) => { acc[item.nome] = (acc[item.nome] || 0) + 1; return acc; }, {});
  let itensTxt = ""; for (let s in resumo) { itensTxt += `*${resumo[s]}x* ${s}%0A`; }
  const entregaTxt = mEntrega === 'entrega' ? `📍 *Entrega:* ${end}` : `🏪 *Retirada no Local*`;
  
  window.open(`https://wa.me/${CONFIG.whats}?text=🍦 *PEDIDO: ${CONFIG.loja}*%0A👤 *Cliente:* ${nome}%0A${entregaTxt}%0A💳 *Pagamento:* ${mPag}%0A🛒 *Itens:*%0A${itensTxt}%0A💰 *TOTAL:* ${totalStr}`);
  
  carrinho = []; atualizarBarra(); fecharModal();
}

// --- RELATÓRIOS (FIREBASE) ---
window.renderRelatorios = function() {
  const fInicio = document.getElementById('filtro-inicio').value;
  const fFim = document.getElementById('filtro-fim').value;
  let filtrados = historicoVendas;

  if(fInicio && fFim) {
    const dInicio = new Date(fInicio + "T00:00:00");
    const dFim = new Date(fFim + "T23:59:59");
    filtrados = filtrados.filter(v => {
      const dataVenda = new Date(v.data);
      return dataVenda >= dInicio && dataVenda <= dFim;
    });
  }

  const faturamento = filtrados.reduce((a, b) => a + (b.total || 0), 0);
  document.getElementById('dash-pedidos').innerText = filtrados.length;
  document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.',',')}`;

  const contagem = {};
  filtrados.forEach(v => v.itens.forEach(i => contagem[i.nome] = (contagem[i.nome] || 0) + 1));
  const ord = Object.entries(contagem).sort((a,b) => b[1]-a[1]);
  document.getElementById('sabor-campeao').innerText = ord.length ? ord[0][0] : "---";

  document.getElementById('lista-historico').innerHTML = filtrados.slice(0, 20).map(v => `
    <div style="border-bottom:1px solid #eee; padding:5px 0; display:flex; justify-content:space-between;">
      <span>${new Date(v.data).toLocaleDateString()} - ${v.cliente}</span>
      <strong>R$ ${v.total.toFixed(2).replace('.',',')}</strong>
    </div>`).join('');
}

// --- ADMIN (FIREBASE) ---
window.verificarAcesso = function() { if (prompt("Senha:") === CONFIG.senha) { document.getElementById('view-cliente').style.display = 'none'; document.getElementById('view-admin').style.display = 'block'; renderAdmin(); } }
window.sairPainel = function() { document.getElementById('view-cliente').style.display = 'block'; document.getElementById('view-admin').style.display = 'none'; renderCarrossel(); renderVitrine(); }

function renderAdmin() {
  document.getElementById('adm-taxa').value = taxaEntregaConfig;
  document.getElementById('lista-banners-admin').innerHTML = banners.map((url, i) => `<div class="admin-item-lista"><img src="${url}" class="admin-foto-mini"> <button onclick="excluirBanner(${i})" style="color:red; background:none; border:none; cursor:pointer;">Remover</button></div>`).join('');
  document.getElementById('lista-admin').innerHTML = sabores.map(s => `
    <div class="admin-item-lista">
      <div style="display:flex;align-items:center;">
        <img src="${s.foto}" class="admin-foto-mini">
        <div style="display:flex; flex-direction:column;">
          <strong>${s.nome}</strong>
          <span>R$ ${parseFloat(s.preco).toFixed(2).replace('.',',')}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="number" class="input-estoque-adm" value="${s.estoque}" onchange="alterarQtdEstoque('${s.id}', this.value)">
        <button onclick="excluirSabor('${s.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button>
      </div>
    </div>`).join('');
}

window.alterarQtdEstoque = async function(id, novaQtd) {
  await updateDoc(doc(db, "sabores", id), { estoque: parseInt(novaQtd) || 0 });
}

window.adicionarSabor = async function() {
  const n = document.getElementById('novo-nome').value, p = parseFloat(document.getElementById('novo-preco').value), e = parseInt(document.getElementById('novo-estoque').value) || 0, f = document.getElementById('nova-foto').value || "https://via.placeholder.com/150";
  if (n && p) { 
    await addDoc(collection(db, "sabores"), { nome: n, preco: p, estoque: e, foto: f });
    document.getElementById('novo-nome').value = ''; document.getElementById('novo-preco').value = ''; document.getElementById('novo-estoque').value = ''; document.getElementById('nova-foto').value = '';
    renderAdmin(); // Força atualização visual
  }
}

window.adicionarBanner = async function() { 
  const u = document.getElementById('novo-banner').value; 
  if(u){ 
    const novaLista = [...banners, u];
    await updateDoc(doc(db, "config", "banners"), { lista: novaLista });
    document.getElementById('novo-banner').value=''; 
    renderAdmin(); // Força atualização visual
  }
}

window.excluirBanner = async function(i) { 
  const novaLista = banners.filter((_, index) => index !== i);
  await updateDoc(doc(db, "config", "banners"), { lista: novaLista });
  renderAdmin(); // Força atualização visual
}

window.salvarTaxa = async function() { 
  const v = parseFloat(document.getElementById('adm-taxa').value);
  await updateDoc(doc(db, "config", "taxa"), { valor: v });
  alert("Salvo!"); 
}

window.excluirSabor = async function(id) { 
  if(confirm("Excluir sabor?")) await deleteDoc(doc(db, "sabores", id)); 
}

window.copiarPix = function() { 
  const texto = document.getElementById('pix-code').innerText;
  navigator.clipboard.writeText(texto).then(() => alert("Código Copiado!")).catch(() => alert("Erro ao copiar."));
}

window.limparVendas = async function() { 
  if(confirm("Zerar Relatórios?")) {
     alert("Para segurança, apague a coleção 'vendas' manualmente no painel do Firebase.");
  }
}

// Inicializar vitrine e carrossel
renderCarrossel();
renderVitrine();