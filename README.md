# Mural

Jornal diário de inteligência artificial: as notícias de IA do dia, penduradas como recortes numa parede.

- Todo dia às 07:00 (São Paulo) o workflow `Daily edition` roda `build.py`, lê os feeds RSS públicos das fontes, escolhe até 9 matérias de IA das últimas 30 horas (até 3 internacionais), salva `data/days/AAAA-MM-DD.json` e publica o site no GitHub Pages.
- Rodar na hora: Actions → Daily edition → Run workflow.
- Sem chaves, sem segredos, sem dependências. Cada recorte mostra só título, linha fina e fonte, e leva à matéria original.
- Ajustes: `MURAL_STORIES` (quantidade por dia) e `MURAL_MAX_EN` (vagas internacionais) no topo de `build.py`; fontes na lista `FEEDS`.
