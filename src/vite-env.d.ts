/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TAURO_PG_EXPECTED_PROJECT_REF?: string;
  readonly VITE_TAURO_PG_ENVIRONMENT?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
