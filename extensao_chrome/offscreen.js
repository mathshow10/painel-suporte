// Ponte com o programa Painel de Suporte (documento invisível da extensão, fica aberto o tempo todo).
// Fica esperando em GET /esperar; quando o programa pede "ler" ou "colar", passa para o background.js,
// que faz isso direto na aba do ticket (sem teclas simuladas, que o anti-cheat do jogo barra),
// e devolve o resultado em POST /resposta.
// Se mudar "menu_porta" no config_painel.json, mude aqui, no background.js e no manifest.json também.
const BASE = "http://127.0.0.1:47391";
const CABECALHO = { "X-Painel": "1" };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function laco() {
  for (;;) {
    try {
      const r = await fetch(`${BASE}/esperar`, { headers: CABECALHO, cache: "no-store" });
      if (r.status === 200) {
        const pedido = await r.json();
        let resultado;
        try {
          resultado = await chrome.runtime.sendMessage({ tipo: "pedido", pedido });
        } catch (e) {
          resultado = { id: pedido.id, ok: false, motivo: String(e) };
        }
        await fetch(`${BASE}/resposta`, {
          method: "POST",
          headers: { ...CABECALHO, "Content-Type": "application/json" },
          body: JSON.stringify(resultado || { id: pedido.id, ok: false }),
        });
      } else if (r.status !== 204) {
        await dormir(3000);
      }
    } catch (e) {
      await dormir(3000);             // programa fechado: tenta de novo daqui a pouco
    }
  }
}

laco();
