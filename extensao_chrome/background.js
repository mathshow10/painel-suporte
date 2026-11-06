// Menu do botão direito do Painel de Suporte.
// Cada opção avisa o programa (painel_suporte.py, que escuta só em 127.0.0.1),
// e ele faz exatamente o mesmo que o atalho de teclado correspondente.
// Se mudar "menu_porta" no config_painel.json, mude aqui e no manifest.json também.
const PORTA = 47391;

const OPCOES = [
  { id: "sugerir",  titulo: "Sugerir resposta (Ctrl+F11)",       contextos: ["selection"] },
  { id: "melhorar", titulo: "Melhorar meu texto com IA (Ctrl+F10)", contextos: ["selection", "editable"] },
  { id: "resumo",   titulo: "Resumir o ticket (Ctrl+F8)",         contextos: ["page", "selection"] },
  { id: "reporte",  titulo: "Reporte para Discord (Ctrl+F7)", contextos: ["page", "selection"] },
  { id: "salvar",   titulo: "Guardar como nova resposta (Ctrl+F9)", contextos: ["selection", "editable"] },
  { id: "sep",      separador: true, contextos: ["page", "selection", "editable"] },
  { id: "painel",   titulo: "Abrir o painel",                     contextos: ["page", "selection", "editable"] },
];

function criarMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "painel", title: "Painel de Suporte", contexts: ["page", "selection", "editable"] });
    for (const o of OPCOES) {
      const item = { id: o.id, parentId: "painel", contexts: o.contextos };
      if (o.separador) item.type = "separator"; else item.title = o.titulo;
      chrome.contextMenus.create(item);
    }
  });
}

chrome.runtime.onInstalled.addListener(criarMenu);
chrome.runtime.onStartup.addListener(criarMenu);

// Lê o texto da página e o que está selecionado (no quadro onde você clicou),
// para o programa não depender de Ctrl+C logo depois do menu (que falhava).
async function lerTexto(info, tab) {
  if (!tab || tab.id == null) return { selecao: info.selectionText || "" };
  const ler = () => ({ pagina: document.body ? document.body.innerText : "", selecao: String(getSelection() || "") });
  try {
    const frameIds = info.frameId ? [info.frameId] : [0];
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds }, func: ler });
    const dados = (r && r.result) || {};
    if (info.frameId) {                       // clicou dentro de um quadro: a página inteira está no quadro principal
      const [p] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: ler });
      if (p && p.result && p.result.pagina) dados.pagina = p.result.pagina + "\n" + (dados.pagina || "");
    }
    return dados;
  } catch (e) {
    console.warn("Não consegui ler a página:", e);
    return { selecao: info.selectionText || "" };
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!OPCOES.some((o) => o.id === info.menuItemId && !o.separador)) return;
  try {
    const leitura = ["resumo", "reporte", "sugerir"].includes(info.menuItemId);
    const corpo = leitura ? JSON.stringify(await lerTexto(info, tab)) : "{}";
    const r = await fetch(`http://127.0.0.1:${PORTA}/acao?modo=${info.menuItemId}`, {
      method: "POST",
      headers: { "X-Painel": "1", "Content-Type": "application/json" },
      body: corpo,
    });
    chrome.action.setBadgeText({ text: "" });
    if (!r.ok) console.warn("Painel de Suporte respondeu", r.status, await r.text());
  } catch (e) {
    // programa fechado: avisa no ícone da extensão
    chrome.action.setBadgeText({ text: "off" });
    console.warn("Painel de Suporte não está aberto.", e);
  }
});

// ===========================================================================
// PONTE: o programa pede para ler/colar no ticket sem teclas simuladas
// (com o jogo aberto, o anti-cheat barra Ctrl+C/Ctrl+V/Enter simulados).
// O offscreen.js fica esperando os pedidos do programa e passa para cá.
// ===========================================================================

async function garantirOffscreen() {
  try {
    if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS"],
      justification: "Espera pedidos do programa Painel de Suporte (127.0.0.1) para ler e colar no ticket.",
    });
  } catch (e) {
    // já existe (ou duas tentativas ao mesmo tempo): tudo bem
  }
}

garantirOffscreen();
chrome.runtime.onStartup.addListener(garantirOffscreen);
chrome.runtime.onInstalled.addListener(garantirOffscreen);
chrome.alarms.create("ponte", { periodInMinutes: 1 });   // se o documento sumir, volta em até 1 minuto
chrome.alarms.onAlarm.addListener(garantirOffscreen);

// --- roda DENTRO da página (precisa ser autossuficiente) -------------------
function lerNaPagina(expira) {
  if (Date.now() > expira) return { ok: false, motivo: "atrasado" };
  if (!document.hasFocus()) return { ok: false, motivo: "sem_foco" };   // você está em outra janela
  const a = document.activeElement;
  const ehTexto = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT");
  let selecao = "", selecao_html = "", editor = null, editor_html = null;
  if (ehTexto) {
    selecao = a.value.slice(a.selectionStart || 0, a.selectionEnd || 0);
    editor = a.value;
  } else {
    const s = getSelection();
    if (s && s.rangeCount && !s.isCollapsed) {
      selecao = String(s);
      const d = document.createElement("div");
      for (let i = 0; i < s.rangeCount; i++) d.appendChild(s.getRangeAt(i).cloneContents());
      selecao_html = d.innerHTML;
    }
    if (a && a.isContentEditable) {
      editor = a.innerText;
      editor_html = a.innerHTML;
    }
  }
  return { ok: true, selecao, selecao_html, editor, editor_html, pagina: document.body ? document.body.innerText : "" };
}

async function colarNaPagina(p) {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  if (Date.now() > p.expira) return { ok: false, motivo: "atrasado" };
  if (!document.hasFocus()) return { ok: false, motivo: "sem_foco" };
  const a = document.activeElement;
  const ehTexto = a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && /^(text|search|)$/i.test(a.type)));
  if (!a || !(a.isContentEditable || ehTexto)) return { ok: false, motivo: "sem_campo" };
  if (p.apagar) {                                   // o ";abc" digitado: confere que está antes do cursor
    let antes = "";
    if (ehTexto) {
      antes = a.value.slice(0, a.selectionStart || 0);
    } else {
      const s = getSelection();
      if (!s.rangeCount) return { ok: false, motivo: "sem_cursor" };
      const r = s.getRangeAt(0).cloneRange();
      r.collapse(true);
      r.setStart(a, 0);
      antes = r.toString();
    }
    if (!antes.toLowerCase().endsWith(String(p.apagar).toLowerCase())) return { ok: false, motivo: "nao_achei_atalho" };
    for (let i = 0; i < p.apagar.length; i++) document.execCommand("delete");
    await espera(40);
  } else if (p.tudo) {                              // o rascunho era a caixa inteira
    if (ehTexto) a.select();
    else {
      const r = document.createRange();
      r.selectNodeContents(a);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    await espera(60);                               // o editor (ProseMirror) lê a seleção nova
  }
  // daqui em diante já apagou o atalho: não devolve falha (senão o programa apagaria de novo pelo teclado)
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", p.texto || "");
    if (p.html) dt.setData("text/html", p.html);
    const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    if (!ev.defaultPrevented) {                      // campo comum: insere direto
      if (!ehTexto && p.html) document.execCommand("insertHTML", false, p.html);
      else document.execCommand("insertText", false, p.texto || "");
    }
  } catch (e) {
    return { ok: true, aviso: String(e) };
  }
  return { ok: true };
}
// ---------------------------------------------------------------------------

async function executarPedido(p) {
  try {
    const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!aba || aba.id == null) return { id: p.id, ok: false, motivo: "sem_aba" };
    const ler = p.acao === "ler";
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: aba.id },
      func: ler ? lerNaPagina : colarNaPagina,
      args: [ler ? p.expira : p],
    });
    return { id: p.id, ...((r && r.result) || { ok: false, motivo: "sem_resultado" }) };
  } catch (e) {
    // aba sem permissão (fora do site de tickets do manifest.json), chrome://, etc.: o programa usa o teclado
    return { id: p.id, ok: false, motivo: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg && msg.tipo === "pedido" && msg.pedido) {
    executarPedido(msg.pedido).then(responder);
    return true;                                    // resposta assíncrona
  }
  return false;
});
