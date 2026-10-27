import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';

import { t } from '@/shared/i18n/pt';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export type DriveAccount = { email: string; name: string | null };

let configured = false;
const TOKEN_TTL_MS = 40 * 60 * 1000; // o token dura ~1 h; renovamos antes
let cachedToken: string | null = null;
let cachedAt = 0;

// No Android o cliente OAuth é identificado pelo pacote e pelo SHA-1 da chave de assinatura,
// então não há ID de cliente nem segredo no código.
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ scopes: [DRIVE_SCOPE] });
  configured = true;
}

const toAccount = (u: User): DriveAccount => ({ email: u.user.email, name: u.user.name });

/** Mensagem em português para os erros mais comuns do login. */
function friendlyError(e: unknown): Error {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new Error(t.drive.errPlayServices);
    if (e.code === statusCodes.IN_PROGRESS) return new Error(t.drive.errInProgress);
    // DEVELOPER_ERROR (10): pacote ou SHA-1 diferentes dos cadastrados no Google Cloud
    if (e.code === '10' || /DEVELOPER_ERROR|10:/.test(e.message)) return new Error(t.drive.errDeveloper);
    return new Error(`${e.message} (${e.code})`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/** Retoma a sessão anterior sem abrir tela nenhuma; null se não houver. */
export async function restoreSession(): Promise<DriveAccount | null> {
  ensureConfigured();
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const res = await GoogleSignin.signInSilently();
    return res.type === 'success' ? toAccount(res.data) : null;
  } catch {
    return null;
  }
}

/** Abre o login do Google. Devolve null se o usuário cancelar. */
export async function signIn(): Promise<DriveAccount | null> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    if (!res.data.scopes.includes(DRIVE_SCOPE)) {
      const more = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
      if (more?.type === 'success') return toAccount(more.data);
    }
    return toAccount(res.data);
  } catch (e) {
    throw friendlyError(e);
  }
}

export async function signOut() {
  ensureConfigured();
  cachedToken = null;
  cachedAt = 0;
  await GoogleSignin.signOut();
}

/**
 * Token de acesso (vale cerca de 1 hora). Fica em memória por 40 minutos, para não chamar o
 * Google Play Services a cada requisição. Com `fresh` (ou vencido), descarta o que a biblioteca
 * guardou e pede outro.
 */
export async function getAccessToken(fresh = false): Promise<string> {
  ensureConfigured();
  if (!fresh && cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken;
  try {
    if (cachedToken) await GoogleSignin.clearCachedAccessToken(cachedToken);
    const { accessToken } = await GoogleSignin.getTokens();
    cachedToken = accessToken;
    cachedAt = Date.now();
    return accessToken;
  } catch (e) {
    throw friendlyError(e);
  }
}
