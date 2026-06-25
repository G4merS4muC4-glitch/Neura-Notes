# 🧠 Neural — notas que se conectam

PWA **mobile-first** de notas em Markdown, no espírito do Obsidian, mas focado só em
**escrever** e em **enxergar a rede de conexões** entre as suas ideias. A tela inicial
é um **grafo neural vivo** — cada nota é um nó, cada `[[wikilink]]` é uma sinapse.

- 🌌 **Grafo é o lar** — abre direto na rede de notas, com física viva (nós que respiram,
  sinais de luz percorrendo as conexões), pan/zoom/arraste a 60fps em canvas.
- ✍️ **Edição prazerosa** — CodeMirror 6 com preview ao vivo inline, micro-animação ao
  digitar, cursor _candy_ com glow, tipografia serifada confortável.
- 🔗 **`[[wikilinks]]`** com autocomplete; ligar notas atualiza o grafo em tempo real.
- 📱 **Toolbar flutuante inferior** que sobe junto com o teclado (visualViewport API).
- 🌙 Tema **dark suave candy** com azul-esverdeado, cantos arredondados, motion polido.
- 📦 **PWA** instalável e **offline-first** (IndexedDB), com **sync opcional na nuvem** (Supabase).
- ♿ Respeita `prefers-reduced-motion`, contraste AA, alvos de toque ≥ 44px, navegação por teclado.

---

## 🚀 Rodando

```bash
npm install
npm run dev      # http://localhost:5173
```

Outros scripts:

```bash
npm run build    # typecheck (tsc) + build de produção (Vite + PWA)
npm run preview  # serve o build de produção
npm run lint     # só o typecheck
```

> **Sem configurar nada, o app já funciona 100% local** (IndexedDB). O sync em nuvem é opcional.

---

## ☁️ Ativando o sync (Supabase) — opcional

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Copie `.env.example` para `.env` e preencha:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```

3. No **SQL Editor** do Supabase, cole e rode o conteúdo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — ele cria a tabela
   `notes`, ativa **RLS** (cada usuário só vê as próprias notas) e liga o **realtime**.
   (Se usar a CLI do Supabase: `supabase db push`.)
4. Em **Authentication → Providers**, habilite **Email (magic link)** e/ou **Google**.
   No provedor de e-mail, adicione a URL do seu deploy em **Redirect URLs**.
5. Reinicie o `npm run dev`. Em **Ajustes** aparecerá o login. O modelo é offline-first com
   **write-through** no cache local e resolução de conflito **last-write-wins** por `updated_at`.

---

## ▲ Deploy na Vercel

O projeto já vem com [`vercel.json`](vercel.json) (framework Vite + rewrites de SPA para as
rotas `/note/:id`, `/list`, `/settings` funcionarem em refresh/acesso direto).

1. Suba o repositório para o GitHub:

   ```bash
   git remote add origin git@github.com:SEU_USUARIO/neural-notes.git
   git push -u origin main
   ```

2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório.
   A Vercel detecta o Vite automaticamente (build `npm run build`, saída `dist`).
3. Em **Settings → Environment Variables**, adicione (se for usar o sync em nuvem):

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```

   Sem essas variáveis, o app sobe e funciona **100% local** (IndexedDB) — o sync é opcional.
4. **Deploy**. Depois, copie a URL do projeto e cole em **Supabase → Auth → URL Configuration**
   (Site URL + Redirect URLs) para o magic link/Google funcionarem.

---

## 🧩 Arquitetura

```
src/
├── data/                 # camada de persistência ISOLADA e trocável
│   ├── repository.ts      #  interface única + factory (escolhe local/nuvem)
│   ├── localRepo.ts       #  IndexedDB (offline-first) + sync entre abas
│   ├── supabaseRepo.ts    #  Supabase (cache local + realtime + LWW)
│   ├── supabase.ts        #  client
│   └── env.ts             #  checagem de config (sem carregar o SDK no bundle local)
├── store/NotesContext.tsx # estado, CRUD, resolução de wikilinks, grafo derivado
├── editor/                # CodeMirror 6
│   ├── markdownPreview.ts #  preview ao vivo (decorations a partir da árvore Lezer)
│   ├── wikilink.ts        #  [[ ]] — decoração, clique e autocomplete
│   ├── typingAnim.ts      #  micro-animação por caractere (overlay, sem reflow)
│   ├── commands.ts        #  ações da toolbar (negrito, lista, link, wikilink…)
│   └── theme.ts
├── components/
│   ├── GraphView.tsx      # grafo neural (d3-force + canvas, física viva)
│   ├── NoteEditor.tsx     # editor markdown
│   ├── FloatingToolbar.tsx# toolbar inferior que acompanha o teclado
│   ├── NoteList.tsx · SearchBar.tsx · Settings.tsx · Skeleton.tsx
├── pages/                 # GraphPage (home) · EditorPage · ListPage · SettingsPage
├── hooks/                 # useReducedMotion · useVisualViewport · useHaptics
└── lib/                   # markdown (parse/grafo) · format · motion presets
```

**Trocar de backend é trivial:** ambos `localRepo` e `supabaseRepo` implementam a mesma
interface `Repository`. A factory em `repository.ts` usa Supabase quando há `.env`
configurado e cai no local caso contrário — nada acima da camada de dados muda.

### Stack
React 18 · TypeScript · Vite · React Router · Tailwind (tokens via CSS variables) ·
framer-motion · d3-force (canvas) · CodeMirror 6 · idb · vite-plugin-pwa · Supabase.

### Notas de performance
- Grafo desenhado em **canvas** (não SVG) com cache de posições — 60fps com centenas de nós.
- Rotas pesadas (editor/CodeMirror, Supabase) são **carregadas sob demanda**; a home/grafo
  abre com ~106 KB gzip. A simulação dorme quando a energia baixa; pulsos/sinais desligam
  sob `prefers-reduced-motion`.

---

## 📋 Como usar

- **Toque no `+`** para criar uma nota. A primeira linha vira o título.
- Escreva Markdown normal. Digite **`[[`** para conectar a outra nota (ou criar uma nova).
- **Toque num nó** do grafo para ver o preview; toque de novo (ou no card) para abrir.
- Busque no topo: nós que combinam acendem, o resto desbota.
- Alterne **Grafo ↔ Lista** pelos ícones do topo; **Ajustes** para conta/sync e estatísticas.

Feito com carinho. ✨
