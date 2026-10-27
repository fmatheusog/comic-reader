import { parseFolderId } from './model';

/**
 * Pasta do catálogo fixada no build pela variável EXPO_PUBLIC_DRIVE_FOLDER (link ou id), definida no
 * arquivo .env, que não é versionado. Sem a variável, o app deixa você escolher a pasta na tela.
 * Atenção: o Expo embute variáveis EXPO_PUBLIC_* no código do app, então o valor vai junto no APK.
 */
export const configuredFolderId = (): string | null => parseFolderId(process.env.EXPO_PUBLIC_DRIVE_FOLDER ?? '');
