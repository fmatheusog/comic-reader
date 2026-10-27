import { deleteKv, getKv, setKv } from '@/shared/db/kv';

import type { Catalog } from './model';

/**
 * A pasta escolhida e o catálogo lido dela ficam só no banco do aparelho (nunca no código):
 * o id da pasta é tratado como dado privado.
 */
export type CatalogRoot = { id: string; name: string };

const ROOT_KEY = 'drive_root';
const CATALOG_KEY = 'drive_catalog';

export const loadRoot = () => getKv<CatalogRoot>(ROOT_KEY);
export const saveRoot = (root: CatalogRoot) => setKv(ROOT_KEY, root);

export const loadCatalog = () => getKv<Catalog>(CATALOG_KEY);
export const saveCatalog = (catalog: Catalog) => setKv(CATALOG_KEY, catalog);

/** Esquece a pasta e o catálogo (troca de pasta ou saída da conta). */
export async function clearCatalog() {
  await deleteKv(ROOT_KEY);
  await deleteKv(CATALOG_KEY);
}
