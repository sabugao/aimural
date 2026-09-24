(() => {
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const parts = d => { const [y,m,dd] = d.split("-").map(Number); return {y,m,dd,wd:new Date(Date.UTC(y,m-1,dd)).getUTCDay()}; };
    const shortDate = d => { const p = parts(d); return `${MONTHS[p.m-1].slice(0,3)} ${p.dd}`; };
  const time = iso => (iso || "").slice(11,16).replace(":", "h");
  const pad = n => String(n).padStart(2,"0");

  let days = [];

  async function json(url){ const r = await fetch(url, {cache:"no-cache"}); if(!r.ok) throw new Error(url); return r.json(); }

  // size rhythm for 9 pages; repeats for more
  const SIZES = ["s-xl","s-w","s-m","s-m","s-l","s-s","s-s","s-s","s-s","s-m","s-m","s-m"];
  function piece(s, i){
    const cls = SIZES[i % SIZES.length];
    const p = parts(s.published.slice(0,10));
    const wd = WEEK[p.wd];
    const dl = `${MONTHS[p.m-1]} ${p.dd}, ${time(s.published).replace("h", ":")}`;
    return `<a class="page ${cls}" href="${esc(s.url)}" target="_blank" rel="noopener" style="animation-delay:${i*60}ms" aria-label="${esc(s.title)} — ${esc(s.source)}">
      <div class="mast"><span class="name">${esc(s.source)}</span></div>
      <div class="dateline">${dl}</div>
      <h3 class="hl">${esc(s.title)}</h3>
      ${s.dek ? `<p class="dek">${esc(s.dek)}</p>` : ""}
      ${s.lang !== "en" ? `<span class="en">${esc((s.lang||"").toUpperCase())}</span>` : ""}
    </a>`;
  }

  async function show(day){
    const i = days.indexOf(day);
    const edition = days.length - i;
    $("edition").textContent = `No. ${String(edition).padStart(3,"0")}`;
    const pd = parts(day); $("date").textContent = `${MONTHS[pd.m-1]} ${pd.dd}, ${pd.y}`;
    document.title = `Mural — ${shortDate(day)}`;
    $("prev").href = i < days.length-1 ? `#${days[i+1]}` : "#"; $("prev").classList.toggle("off", i >= days.length-1);
    $("next").href = i > 0 ? `#${days[i-1]}` : "#"; $("next").classList.toggle("off", i <= 0);
    try {
      const data = await json(`data/days/${day}.json`);
      $("wall").innerHTML = data.stories.map(piece).join("");
    } catch(e) {
      $("wall").innerHTML = `<p class="empty">This edition is not available.</p>`;
    }
    $("archive").innerHTML = days.slice(0, 60).map(d => `<li><a href="#${d}"${d === day ? ' aria-current="page"' : ""}><small>${WEEK[parts(d).wd].slice(0,3).toUpperCase()}</small>${shortDate(d)}</a></li>`).join("");
    $("archive-wrap").hidden = days.length < 2;
  }

  function route(){ const h = location.hash.slice(1); show(days.includes(h) ? h : days[0]); window.scrollTo({top:0}); }
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (days.length) show(days.includes(location.hash.slice(1)) ? location.hash.slice(1) : days[0]); }, 250); });

  json("data/index.json").then(d => { days = d.days || []; if(!days.length) throw 0; route(); window.addEventListener("hashchange", route); })
    .catch(() => { $("wall").innerHTML = `<p class="empty">The first edition prints tomorrow at 7am.</p>`; });
  if (location.search.includes("still")) document.documentElement.classList.add("still");
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" && !$("prev").classList.contains("off")) location.hash = $("prev").getAttribute("href");
    if (e.key === "ArrowRight" && !$("next").classList.contains("off")) location.hash = $("next").getAttribute("href");
  });
})();
