/**
 * Shared IndexedDB initializer. Centralises the version bump and upgrade logic
 * so both LeagueContext and playersAllCache open the same database handle.
 *
 * Current version: 5
 * Stores: app_prefs, bundle_cache, players_all_cache
 */
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { PlayerDBSchema } from './types';

export const DB_NAME = 'sleeper-players-db';
export const DB_VERSION = 5;

export function initDB(): Promise<IDBPDatabase<PlayerDBSchema>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return openDB<PlayerDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      const rawDb = db as unknown as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (oldVersion < 1) {
        rawDb.createObjectStore('players', { keyPath: 'player_id' });
        rawDb.createObjectStore('metadata', { keyPath: 'key' });
        rawDb.createObjectStore('ownership', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('app_prefs', { keyPath: 'key' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('bundle_cache', { keyPath: 'key' });
      }
      if (oldVersion < 4) {
        // Remove write-only stores superseded by bundle_cache
        for (const name of ['players', 'metadata', 'ownership']) {
          if (rawDb.objectStoreNames.contains(name)) {
            rawDb.deleteObjectStore(name);
          }
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('players_all_cache')) {
          db.createObjectStore('players_all_cache');
        }
      }
    },
  });
}
