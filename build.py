#!/usr/bin/env python3
"""Mural - daily ai journal. Daily edition builder.

Pulls public RSS feeds, keeps AI stories from the last ~30h, ranks them,
and writes data/days/YYYY-MM-DD.json, data/index.json and feed.xml.
Standard library only, so the GitHub Action needs no installs.
"""
import html, json, os, re, sys, unicodedata, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime, parsedate_to_datetime
from xml.sax.saxutils import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DAYS = ROOT / "data" / "days"
TZ = timezone(timedelta(hours=-3))  # America/Sao_Paulo (no DST since 2019)

STORIES_PER_DAY = int(os.environ.get("MURAL_STORIES", "12"))
MAX_PT = int(os.environ.get("MURAL_MAX_PT", "4"))  # Brazilian slots; the rest is international
WINDOW_HOURS = 30
SITE = "https://aimural.danmagatti.com/"
FEED_DAYS = 14  # editions kept in feed.xml

# name, url, language, weight, ai_only (feed is already AI-scoped)
FEEDS = [
    ("The Guardian", "https://www.theguardian.com/technology/artificialintelligenceai/rss", "en", 1.0, True),
    ("MIT Technology Review", "https://www.technologyreview.com/topic/artificial-intelligence/feed", "en", 1.0, True),
    ("The Verge", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "en", 0.95, True),
    ("BBC News", "https://feeds.bbci.co.uk/news/technology/rss.xml", "en", 0.95, False),
    ("Wired", "https://www.wired.com/feed/tag/ai/latest/rss", "en", 0.9, True),
    ("Ars Technica", "https://arstechnica.com/ai/feed/", "en", 0.9, True),
    ("TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/", "en", 0.85, True),
    ("Engadget", "https://www.engadget.com/rss.xml", "en", 0.75, False),
    ("Folha de S.Paulo", "https://feeds.folha.uol.com.br/tec/rss091.xml", "pt", 0.9, False),
    ("g1", "https://g1.globo.com/rss/g1/tecnologia/", "pt", 0.85, False),
    ("Exame", "https://exame.com/feed/", "pt", 0.7, False),
    ("Tecnoblog", "https://tecnoblog.net/feed/", "pt", 0.75, False),
    ("Canaltech", "https://canaltech.com.br/rss/", "pt", 0.65, False),
    ("Olhar Digital", "https://olhardigital.com.br/feed/", "pt", 0.6, False),
]
# Coverage signal only (not shown): how many outlets carry the same story today.
SIGNALS = [
    "https://news.google.com/rss/search?q=%22artificial+intelligence%22+when:1d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=%22intelig%C3%AAncia+artificial%22+when:1d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
]

AI_RE = re.compile(
    r"\b(IA|IAs|AI)\b|intelig[êe]ncia artificial|artificial intelligence|OpenAI|ChatGPT|"
    r"Anthropic|Claude|Gemini|DeepMind|LLMs?|chatbots?|Copilot|Mistral|DeepSeek|Llama|"
    r"machine learning|aprendizado de m[áa]quina|GPT-?\d|Grok|xAI|Perplexity|Nvidia|"
    r"deepfakes?|agentes? de IA|IA generativa|generative AI")
AI_CASE_SENSITIVE = re.compile(r"\b(IA|IAs|AI)\b")
STOP = set(("a o os as de do da dos das e em no na nos nas um uma para por com que se ao à diz sobre mais como veja entenda quem qual quando onde porque após the "
            "the of to in and for on is with its it's new says ia ai inteligência artificial intelligence").split())
NS = {"atom": "http://www.w3.org/2005/Atom"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Mural daily ai journal; +https://github.com)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def clean(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def dek_from(desc, title):
    d = clean(desc)
    if not d or d.lower().startswith(title.lower()[:40]):
        return ""
    # first sentence, capped
    m = re.match(r"(.{60,220}?[.!?])(\s|$)", d)
    s = m.group(1) if m else d[:200]
    if len(s) > 210:
        s = s[:200].rsplit(" ", 1)[0] + "…"
    return s


def parse_date(s):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d


def items(raw):
    root = ET.fromstring(raw)
    for it in root.iter("item"):
        sub = it.findtext("atom:subtitle", namespaces=NS)  # g1 ships a clean dek here
        yield it.findtext("title"), it.findtext("link"), sub or it.findtext("description"), it.findtext("pubDate")
    for it in root.iter("{http://www.w3.org/2005/Atom}entry"):
        link = it.find("atom:link[@rel='alternate']", NS) or it.find("atom:link", NS)
        yield (it.findtext("atom:title", namespaces=NS), link.get("href") if link is not None else None,
               it.findtext("atom:summary", namespaces=NS) or it.findtext("atom:content", namespaces=NS),
               it.findtext("atom:published", namespaces=NS) or it.findtext("atom:updated", namespaces=NS))


BRIDGE = {"espaço": "space", "satélite": "satellite", "órbita": "orbit", "orbital": "orbit", "governo": "government",
          "saúde": "health", "óculos": "glasses", "agente": "agent", "ligações": "calls", "chamadas": "calls",
          "enzimas": "enzymes", "eleições": "election", "elections": "election"}


def norm(w):
    w = BRIDGE.get(w.lower(), w.lower())
    w = "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn")
    return w[:5]  # crude stem: australia/austrália/australian -> austr


def entities(t):
    words = re.findall(r"\w+", t)
    return {norm(w) for w in words if w[:1].isupper() and len(w) > 2 and w.lower() not in STOP}


GIANTS = {norm(w) for w in "google meta openai microsoft apple amazon nvidia anthropic china eua trump brasil".split()}


def crowded(s, picked):
    """At most one story per niche name (e.g. a product), three per giant."""
    for e in s["_e"] | {w for w in s["_t"] if w in GIANTS}:
        n = sum(1 for p in picked if e in p["_e"] or e in p["_t"])
        if n >= (3 if e in GIANTS else 1):
            return True
    return False


def same_story(a, b):
    if a["lang"] != b["lang"] and (len(a["_ed"] & b["_ed"]) >= 2 or len(a["_t"] & b["_t"]) >= 2):
        return True  # same story told in PT and EN
    shared = a["_t"] & b["_t"]
    return len(shared) >= 3 or len(a["_e"] & b["_e"]) >= 2 or len(shared) / max(1, len(a["_t"] | b["_t"])) > 0.3


def tokens(t):
    return {norm(w) for w in re.findall(r"\w+", t.lower()) if len(w) > 2 and w not in STOP}


def is_ai(title, desc, ai_only):
    if ai_only:
        return True
    head = title + " " + clean(desc)[:300]
    return bool(AI_CASE_SENSITIVE.search(head) or re.search(AI_RE.pattern, head, re.I) and not re.fullmatch(r".*\bai\b.*", head))


def write_feed():
    """feed.xml at the site root: every story from the latest editions, newest edition first."""
    days = sorted((p.stem for p in DAYS.glob("*.json")), reverse=True)[:FEED_DAYS]
    out, seen, newest = [], set(), None
    for day in days:
        data = json.loads((DAYS / f"{day}.json").read_text())
        gen = parse_date(data.get("generated")) or datetime.fromisoformat(day).replace(tzinfo=TZ)
        newest = newest or gen
        for s in data.get("stories", []):
            if s["url"] in seen:
                continue
            seen.add(s["url"])
            pub = parse_date(s.get("published")) or gen
            desc = (s.get("dek") + " " if s.get("dek") else "") + f"({s['source']})"
            out.append(
                "<item>"
                f"<title>{escape(s['title'])}</title>"
                f"<link>{escape(s['url'])}</link>"
                f'<guid isPermaLink="false">{escape(s["url"])}</guid>'
                f"<pubDate>{format_datetime(pub)}</pubDate>"
                f"<category>{day}</category>"
                f"<description>{escape(desc)}</description>"
                "</item>")
    newest = newest or datetime.now(TZ)
    (ROOT / "feed.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n'
        "<title>Mural - daily ai journal</title>\n"
        f"<link>{SITE}</link>\n"
        f'<atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml"/>\n'
        "<description>The day's AI news, twelve front pages every morning at 7am (Sao Paulo).</description>\n"
        "<language>en</language>\n"
        f"<lastBuildDate>{format_datetime(newest)}</lastBuildDate>\n"
        "<ttl>360</ttl>\n"
        + "\n".join(out) + "\n</channel>\n</rss>\n")


def main():
    now = datetime.now(TZ)
    day = os.environ.get("MURAL_DATE") or now.strftime("%Y-%m-%d")
    cutoff = now - timedelta(hours=WINDOW_HOURS)
    pool, errors = [], []
    for name, url, lang, weight, ai_only in FEEDS:
        try:
            raw = fetch(url)
        except Exception as e:
            errors.append(f"{name}: {e}")
            continue
        for title, link, desc, pub in items(raw):
            title = clean(title)
            d = parse_date(pub)
            if not title or not link or not d or d < cutoff or d > now + timedelta(hours=1):
                continue
            if not is_ai(title, desc or "", ai_only):
                continue
            if name.split()[0].lower() in title.lower() or re.search(r"[–-] live$|\blive updates?\b", title, re.I):
                continue  # outlet self-promo and live blogs
            pool.append({"title": title, "dek": dek_from(desc, title), "url": link.strip(), "source": name,
                         "lang": lang, "published": d.astimezone(TZ).isoformat(timespec="minutes"),
                         "_w": weight, "_t": tokens(title), "_e": entities(title), "_ed": entities(title + " " + dek_from(desc, title)), "_d": d})
    signal = []
    for url in SIGNALS:
        try:
            signal += [tokens(clean(t)) for t, *_ in items(fetch(url))]
        except Exception as e:
            errors.append(f"signal: {e}")

    for s in pool:
        cover = sum(1 for o in pool if o is not s and o["source"] != s["source"] and len(s["_t"] & o["_t"]) >= 3)
        cover += sum(1 for g in signal if len(s["_t"] & g) >= 3)
        age_h = (now - s["_d"]).total_seconds() / 3600
        s["_score"] = s["_w"] * 2 + min(cover, 6) * 0.6 + max(0, 1 - age_h / WINDOW_HOURS)

    pool.sort(key=lambda s: s["_score"], reverse=True)
    picked, pt = [], 0
    for s in pool:
        if any(same_story(s, p) for p in picked) or crowded(s, picked):
            continue  # same story from another outlet
        if sum(1 for p in picked if p["source"] == s["source"]) >= 3:
            continue
        if s["lang"] == "pt":
            if pt >= MAX_PT:
                continue
            pt += 1
        picked.append(s)
        if len(picked) >= STORIES_PER_DAY:
            break

    stories = [{k: v for k, v in s.items() if not k.startswith("_")} for s in picked]
    if not stories:
        print("No stories found; keeping previous data.", errors, file=sys.stderr)
        write_feed()
        sys.exit(0)
    DAYS.mkdir(parents=True, exist_ok=True)
    (DAYS / f"{day}.json").write_text(json.dumps(
        {"date": day, "generated": now.isoformat(timespec="minutes"), "stories": stories},
        ensure_ascii=False, indent=1) + "\n")
    days = sorted((p.stem for p in DAYS.glob("*.json")), reverse=True)
    (ROOT / "data" / "index.json").write_text(json.dumps({"days": days}, indent=1) + "\n")
    write_feed()
    print(f"{day}: {len(stories)} stories ({pt} Brazilian). Pool {len(pool)}.")
    for e in errors:
        print("warn:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
