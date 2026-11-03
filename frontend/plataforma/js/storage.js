// Escopo próprio: não lê, migra ou apaga sessões do Gabarita Paes.
export const STORAGE_PREFIX = 'mk_redacao_v1:';

export function scopedStorage(nativeStorage, prefix = STORAGE_PREFIX) {
  return Object.freeze({
    getItem(key) { return nativeStorage.getItem(prefix + String(key)); },
    setItem(key, value) { nativeStorage.setItem(prefix + String(key), String(value)); },
    removeItem(key) { nativeStorage.removeItem(prefix + String(key)); },
    clear() {
      for (let i = nativeStorage.length - 1; i >= 0; i--) {
        const key = nativeStorage.key(i);
        if (key?.startsWith(prefix)) nativeStorage.removeItem(key);
      }
    },
  });
}

export const storage = scopedStorage(globalThis.localStorage);
export const session = scopedStorage(globalThis.sessionStorage);
