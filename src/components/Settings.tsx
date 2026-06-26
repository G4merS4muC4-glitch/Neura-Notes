import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Cloud, HardDrive, Github, Info, Sparkles, LogOut, Tag } from 'lucide-react'
import { useNotes } from '@/store/NotesContext'
import { usePrefs, TAG_PALETTE } from '@/store/PrefsContext'
import { useAuth } from '@/store/AuthContext'
import { parseTags } from '@/lib/markdown'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-bg-surface">
        {children}
      </div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 border-b border-[var(--border)] p-4 last:border-0">{children}</div>
}

export default function Settings() {
  const { notes, graph } = useNotes()
  const { colorForTag, setTagColor } = usePrefs()
  const { configured, user, signOut } = useAuth()

  // Todas as #tags encontradas nas notas (forma exibida, sem repetir)
  const allTags = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const n of notes) {
      for (const tag of parseTags(n.content)) {
        const key = tag.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          out.push(tag)
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [notes])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-lg"
    >
      <Section title="Conta e sincronização">
        <Row>
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-bg-elevated text-accent">
            {configured ? <Cloud size={18} /> : <HardDrive size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-text-primary">
              {configured ? 'Nuvem (Supabase)' : 'Local (este aparelho)'}
            </div>
            <div className="truncate text-sm text-text-secondary">
              {configured
                ? user
                  ? `Conectado como ${user.email}`
                  : 'Não conectado.'
                : 'Suas notas ficam salvas offline neste navegador.'}
            </div>
          </div>
        </Row>

        {configured && user && (
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 p-4 font-medium text-danger hover:bg-bg-hover"
          >
            <LogOut size={18} /> Sair da conta
          </button>
        )}

        {!configured && (
          <Row>
            <p className="text-sm text-text-secondary">
              Para ativar o sync em nuvem, configure <code className="text-accent">VITE_SUPABASE_URL</code> e{' '}
              <code className="text-accent">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
              <code className="text-accent">.env</code> (veja o README).
            </p>
          </Row>
        )}
      </Section>

      <Section title="Cores por tipo (tags)">
        <Row>
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-bg-elevated text-accent">
            <Tag size={18} />
          </span>
          <div className="flex-1">
            <div className="font-medium text-text-primary">Tipos de nota</div>
            <div className="text-sm text-text-secondary">
              Escreva <code className="text-accent">#tag</code> nas notas (ex.:{' '}
              <code className="text-accent">#marketing</code>) e escolha uma cor — os nós do grafo
              ganham essa cor.
            </div>
          </div>
        </Row>

        {allTags.length === 0 ? (
          <Row>
            <p className="text-sm text-text-muted">
              Nenhuma tag ainda. Adicione <code className="text-accent">#suatag</code> no texto de
              uma nota para ela aparecer aqui.
            </p>
          </Row>
        ) : (
          allTags.map((tag) => {
            const current = colorForTag(tag)
            return (
              <div key={tag} className="border-b border-[var(--border)] p-4 last:border-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{
                      background: current ?? 'transparent',
                      border: current ? 'none' : '1.5px solid var(--text-muted)',
                    }}
                  />
                  <span className="truncate font-medium text-text-primary">#{tag}</span>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setTagColor(tag, null)}
                      className="ml-auto text-xs text-text-muted hover:text-danger"
                    >
                      limpar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {TAG_PALETTE.map((c) => {
                    const active = current === c.hex
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.name}
                        title={c.name}
                        onClick={() => setTagColor(tag, active ? null : c.hex)}
                        style={{ background: c.hex }}
                        className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                          active ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-surface' : ''
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </Section>

      <Section title="Aparência">
        <Row>
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-bg-elevated text-accent">
            <Sparkles size={18} />
          </span>
          <div className="flex-1">
            <div className="font-medium text-text-primary">Dark candy</div>
            <div className="text-sm text-text-secondary">
              Tema escuro suave com toques teal. Respeita “reduzir movimento” do sistema.
            </div>
          </div>
        </Row>
      </Section>

      <Section title="Seu cérebro digital">
        <Row>
          <div className="flex-1">
            <div className="text-2xl font-semibold text-text-primary">{notes.length}</div>
            <div className="text-sm text-text-secondary">notas</div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-semibold text-text-primary">{graph.edges.length}</div>
            <div className="text-sm text-text-secondary">conexões</div>
          </div>
        </Row>
      </Section>

      <Section title="Sobre">
        <Row>
          <span className="grid h-9 w-9 place-items-center rounded-pill bg-bg-elevated text-accent">
            <Info size={18} />
          </span>
          <div className="flex-1 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Neural</span> — notas em Markdown que se
            conectam num grafo vivo. v0.1.0
          </div>
        </Row>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 p-4 text-text-secondary hover:bg-bg-hover"
        >
          <Github size={18} /> Código & documentação
        </a>
      </Section>
    </motion.div>
  )
}
