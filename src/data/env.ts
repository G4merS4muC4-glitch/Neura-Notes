// Checagem de configuração SEM importar o SDK do Supabase,
// para que o bundle local (padrão) não carregue a biblioteca de nuvem.
const URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON)
}
