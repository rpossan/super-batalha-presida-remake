/* Camada de rede do modo online.
   Duas implementações com a mesma interface:
     - "supabase": Supabase Realtime (broadcast + presence), usado em produção;
     - "local":    BroadcastChannel entre abas do mesmo navegador, só para testes (?net=local).
   Sem configuração (js/online-config.js vazio) o modo fica "off": o jogo ainda oferece partidas contra jogadores simulados.

   Interface de um canal:
     ch.on(evento, fn)      recebe mensagens (fn(payload))
     ch.send(evento, obj)   envia para os outros participantes
     ch.track(estado)       publica a presença deste jogador (null remove)
     ch.onPresence(fn)      fn(lista) a cada mudança; lista = [{ key, ...estado }]
     ch.presence()          lista atual
     ch.close()             sai do canal                                                       */
const SPBNet = (() => {
  const cfg = window.SPB_ONLINE || {};
  const forced = (() => { try { return new URLSearchParams(location.search).get("net"); } catch (e) { return null; } })();
  const mode = forced === "local" ? "local" : (cfg.supabaseUrl && cfg.supabaseKey ? "supabase" : "off");

  /* ---------------------------------------------------- Supabase */
  let sbClient = null, sbLoading = null;
  function loadSupabase() {
    if (sbClient) return Promise.resolve(sbClient);
    if (sbLoading) return sbLoading;
    sbLoading = new Promise((resolve, reject) => {
      const make = () => { try { sbClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { realtime: { params: { eventsPerSecond: 20 } } }); resolve(sbClient); } catch (e) { reject(e); } };
      if (window.supabase && window.supabase.createClient) return make();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
      s.onload = make; s.onerror = () => reject(new Error("Não foi possível carregar o Supabase."));
      document.head.appendChild(s);
    });
    sbLoading.catch(() => { sbLoading = null; });
    return sbLoading;
  }
  async function supabaseChannel(name, key) {
    const sb = await loadSupabase();
    const rc = sb.channel(name, { config: { broadcast: { self: false }, presence: { key } } });
    const handlers = {}, presFns = [];
    const list = () => Object.entries(rc.presenceState()).map(([k, metas]) => ({ key: k, ...(metas[metas.length - 1] || {}) }));
    rc.on("broadcast", { event: "*" }, msg => (handlers[msg.event] || []).forEach(fn => { try { fn(msg.payload); } catch (e) { console.error(e); } }));
    rc.on("presence", { event: "sync" }, () => presFns.forEach(fn => { try { fn(list()); } catch (e) { console.error(e); } }));
    await new Promise((res, rej) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; rej(new Error("Tempo esgotado ao conectar.")); } }, 10000);
      rc.subscribe(status => {
        if (done) return;
        if (status === "SUBSCRIBED") { done = true; clearTimeout(t); res(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { done = true; clearTimeout(t); rej(new Error("Falha ao conectar (" + status + ").")); }
      });
    });
    return {
      on(e, fn) { (handlers[e] = handlers[e] || []).push(fn); },
      send(e, payload) { rc.send({ type: "broadcast", event: e, payload }); },
      track(state) { return state ? rc.track(state) : rc.untrack(); },
      onPresence(fn) { presFns.push(fn); },
      presence: list,
      close() { try { sb.removeChannel(rc); } catch (e) {} },
    };
  }

  /* ---------------------------------------------------- local (abas) */
  const inst = Math.random().toString(36).slice(2);
  function localChannel(name, key) {
    const bc = new BroadcastChannel("spb:" + name), handlers = {}, presFns = [], peers = {};
    let mine = null;
    const list = () => Object.entries(peers).map(([k, v]) => ({ key: k, ...v.state }));
    const fire = () => presFns.forEach(fn => fn(list()));
    const post = m => { try { bc.postMessage({ ...m, from: inst }); } catch (e) {} };
    bc.onmessage = ev => {
      const m = ev.data; if (!m || m.from === inst) return;
      if (m.t === "ev") (handlers[m.e] || []).forEach(fn => fn(m.p));
      else if (m.t === "pres") { if (m.state) peers[m.key] = { state: m.state, inst: m.from }; else delete peers[m.key]; fire(); }
      else if (m.t === "hello" && mine) post({ t: "pres", key, state: mine });
      else if (m.t === "bye") { Object.keys(peers).forEach(k => { if (peers[k].inst === m.from) delete peers[k]; }); fire(); }
    };
    post({ t: "hello" });
    const bye = () => post({ t: "bye" });
    addEventListener("pagehide", bye);
    return Promise.resolve({
      on(e, fn) { (handlers[e] = handlers[e] || []).push(fn); },
      send(e, payload) { post({ t: "ev", e, p: JSON.parse(JSON.stringify(payload)) }); },
      track(state) { mine = state; post({ t: "pres", key, state }); },
      onPresence(fn) { presFns.push(fn); },
      presence() { const l = list(); if (mine) l.push({ key, ...mine }); return l; },
      close() { bye(); try { bc.close(); } catch (e) {} },
    });
  }

  /* ---------------------------------------------------- canal em memória (para o jogador simulado) */
  function loopbackPair() {
    const mk = () => ({ h: {}, peer: null, closed: false,
      on(e, fn) { (this.h[e] = this.h[e] || []).push(fn); },
      send(e, payload) { const p = this.peer, data = JSON.parse(JSON.stringify(payload)); if (this.closed) return; setTimeout(() => { if (!p.closed) (p.h[e] || []).forEach(fn => fn(data)); }, 40 + Math.random() * 140); },
      track() {}, onPresence() {}, presence() { return []; }, close() { this.closed = true; } });
    const a = mk(), b = mk(); a.peer = b; b.peer = a; return [a, b];
  }

  return {
    mode, available: mode !== "off",
    /* entra num canal e resolve quando estiver pronto */
    channel(name, key) {
      if (mode === "supabase") return supabaseChannel(name, key);
      if (mode === "local") return localChannel(name, key);
      return Promise.reject(new Error("Modo online indisponível."));
    },
    loopbackPair,
  };
})();
