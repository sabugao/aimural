(() => {
  const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const WEEK = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const parts = d => { const [y,m,dd] = d.split("-").map(Number); return {y,m,dd,wd:new Date(Date.UTC(y,m-1,dd)).getUTCDay()}; };
  const longDate = d => { const p = parts(d); return `${p.dd} de ${MONTHS[p.m-1]}<br><em>de ${p.y}</em>`; };
  const shortDate = d => { const p = parts(d); return `${String(p.dd).padStart(2,"0")}.${String(p.m).padStart(2,"0")}`; };
  const time = iso => (iso || "").slice(11,16).replace(":", "h");
  const pad = n => String(n).padStart(2,"0");

  let days = [];

  async function json(url){ const r = await fetch(url, {cache:"no-cache"}); if(!r.ok) throw new Error(url); return r.json(); }

  function piece(s, i){
    const lead = i === 0;
    const kicker = s.lang === "en" ? "Artificial Intelligence" : "Inteligência Artificial";
    const p = parts(s.published.slice(0,10));
    return `<article class="piece${lead ? " lead" : ""}" style="animation-delay:${80 + i*70}ms">
      <a class="print" href="${esc(s.url)}" target="_blank" rel="noopener">
        <div class="kicker"><span>${kicker}</span>${s.lang === "en" ? '<span class="lang">EN</span>' : ""}</div>
        <h3 class="hl">${esc(s.title)}</h3>
        ${s.dek ? `<p class="dek">${esc(s.dek)}</p>` : ""}
        <div class="imprint"><span class="src">${esc(s.source)}</span><span>${pad(p.dd)}.${pad(p.m)}.${p.y}</span></div>
      </a>
      <div class="label"><span class="n">${pad(i+1)}</span><span>${esc(s.source)}, ${time(s.published)}</span><a class="go" href="${esc(s.url)}" target="_blank" rel="noopener">Ler original</a></div>
    </article>`;
  }

  async function show(day){
    const i = days.indexOf(day);
    const edition = days.length - i;
    $("edition").textContent = `${WEEK[parts(day).wd]} · Edição nº ${String(edition).padStart(3,"0")}`;
    $("date").innerHTML = longDate(day);
    document.title = `Mural — ${shortDate(day)}`;
    $("prev").href = i < days.length-1 ? `#${days[i+1]}` : "#"; $("prev").classList.toggle("off", i >= days.length-1);
    $("next").href = i > 0 ? `#${days[i-1]}` : "#"; $("next").classList.toggle("off", i <= 0);
    try {
      const data = await json(`data/days/${day}.json`);
      $("count").textContent = `${data.stories.length} recortes do dia`;
      $("wall").innerHTML = data.stories.map(piece).join("");
    } catch(e) {
      $("count").textContent = "";
      $("wall").innerHTML = `<p class="empty">Esta edição não está disponível.</p>`;
    }
    $("archive").innerHTML = days.slice(0, 60).map(d => `<li><a href="#${d}"${d === day ? ' aria-current="page"' : ""}><small>${WEEK[parts(d).wd].slice(0,3)}</small>${shortDate(d)}</a></li>`).join("");
    $("archive-wrap").hidden = days.length < 2;
  }

  function route(){ const h = location.hash.slice(1); show(days.includes(h) ? h : days[0]); window.scrollTo({top:0}); }

  json("data/index.json").then(d => { days = d.days || []; if(!days.length) throw 0; route(); window.addEventListener("hashchange", route); })
    .catch(() => { $("wall").innerHTML = `<p class="empty">O mural abre amanhã cedo.</p>`; });
  if (location.search.includes("still")) document.documentElement.classList.add("still");
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" && !$("prev").classList.contains("off")) location.hash = $("prev").getAttribute("href");
    if (e.key === "ArrowRight" && !$("next").classList.contains("off")) location.hash = $("next").getAttribute("href");
  });
})();
