(() => {
  const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const WEEK = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const parts = d => { const [y,m,dd] = d.split("-").map(Number); return {y,m,dd,wd:new Date(Date.UTC(y,m-1,dd)).getUTCDay()}; };
    const shortDate = d => { const p = parts(d); return `${String(p.dd).padStart(2,"0")}.${String(p.m).padStart(2,"0")}`; };
  const time = iso => (iso || "").slice(11,16).replace(":", "h");
  const pad = n => String(n).padStart(2,"0");

  let days = [];

  async function json(url){ const r = await fetch(url, {cache:"no-cache"}); if(!r.ok) throw new Error(url); return r.json(); }

  // size rhythm for 9 pages; repeats for more
  const SIZES = ["s-xl","s-w","s-m","s-m","s-l","s-s","s-s","s-s","s-s","s-s","s-s","s-s"];
  function hlSize(cls, len){
    const base = {"s-xl":[5.4,3.4], "s-l":[3.1,2.3], "s-m":[2.3,1.7], "s-w":[3.9,2.3], "s-s":[2.5,1.7]}[cls];
    const vw = {"s-xl":0.62, "s-l":0.5, "s-m":0.48, "s-w":0.46, "s-s":0.46}[cls];
    const k = Math.max(0.55, Math.min(1.15, 62 / Math.max(len, 20)));
    const narrow = window.innerWidth < 1000;
    const rem = (narrow ? base[1] : base[0]) * k;
    return narrow ? `${(rem*.95).toFixed(2)}rem` : `clamp(${(rem*.6).toFixed(2)}rem, ${(rem*vw*1.9).toFixed(2)}vw, ${rem.toFixed(2)}rem)`;
  }
  function piece(s, i){
    const cls = SIZES[i % SIZES.length];
    const p = parts(s.published.slice(0,10));
    const wd = WEEK[p.wd];
    const dl = s.lang === "en"
      ? `<span>Artificial Intelligence</span><span>${pad(p.dd)}.${pad(p.m)}.${p.y}</span>`
      : `<span>${wd}, ${p.dd} de ${MONTHS[p.m-1]} de ${p.y}</span><span>Inteligência Artificial</span>`;
    return `<a class="page ${cls}" href="${esc(s.url)}" target="_blank" rel="noopener" style="animation-delay:${i*60}ms" aria-label="${esc(s.title)} — ${esc(s.source)}">
      <div class="mast"><span class="name">${esc(s.source)}</span></div>
      <div class="dateline">${dl}</div>
      <h3 class="hl" style="font-size:${hlSize(cls, s.title.length)}">${esc(s.title)}</h3>
      ${s.dek ? `<p class="dek">${esc(s.dek)}</p>` : ""}
      <div class="cols" aria-hidden="true"></div>
      ${s.lang === "en" ? '<span class="en">EN</span>' : ""}
    </a>`;
  }

  async function show(day){
    const i = days.indexOf(day);
    const edition = days.length - i;
    $("edition").textContent = `Edição nº ${String(edition).padStart(3,"0")}`;
    const pd = parts(day); $("date").textContent = `${pd.dd} de ${MONTHS[pd.m-1]} de ${pd.y}`;
    document.title = `Mural — ${shortDate(day)}`;
    $("prev").href = i < days.length-1 ? `#${days[i+1]}` : "#"; $("prev").classList.toggle("off", i >= days.length-1);
    $("next").href = i > 0 ? `#${days[i-1]}` : "#"; $("next").classList.toggle("off", i <= 0);
    try {
      const data = await json(`data/days/${day}.json`);
      $("wall").innerHTML = data.stories.map(piece).join("");
    } catch(e) {
      $("wall").innerHTML = `<p class="empty">Esta edição não está disponível.</p>`;
    }
    $("archive").innerHTML = days.slice(0, 60).map(d => `<li><a href="#${d}"${d === day ? ' aria-current="page"' : ""}><small>${WEEK[parts(d).wd].slice(0,3).toUpperCase()}</small>${shortDate(d)}</a></li>`).join("");
    $("archive-wrap").hidden = days.length < 2;
  }

  function route(){ const h = location.hash.slice(1); show(days.includes(h) ? h : days[0]); window.scrollTo({top:0}); }
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (days.length) show(days.includes(location.hash.slice(1)) ? location.hash.slice(1) : days[0]); }, 250); });

  json("data/index.json").then(d => { days = d.days || []; if(!days.length) throw 0; route(); window.addEventListener("hashchange", route); })
    .catch(() => { $("wall").innerHTML = `<p class="empty">O mural abre amanhã cedo.</p>`; });
  if (location.search.includes("still")) document.documentElement.classList.add("still");
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" && !$("prev").classList.contains("off")) location.hash = $("prev").getAttribute("href");
    if (e.key === "ArrowRight" && !$("next").classList.contains("off")) location.hash = $("next").getAttribute("href");
  });
})();
