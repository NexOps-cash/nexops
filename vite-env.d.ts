/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: prefilled email on login for demo/admin field only (never put passwords in env). */
  readonly VITE_DEMO_LOGIN_EMAIL?: string;
}
