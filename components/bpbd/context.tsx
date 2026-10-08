"use client";
import { createContext, useContext, useState } from 'react';
import { defaultFilters, type Filters, type Role, type Store } from '@/lib/bpbd/model';
export type AppContextValue = { store: Store; role: Role; path: string; query: URLSearchParams; navigate: (path: string) => void; setRole: (role: Role) => void; mutate: (update: (store: Store) => void, action?: string, object?: string) => boolean; dirty: boolean; setDirty: (value: boolean) => void; filters: Map<string, Filters> };
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('App context unavailable'); return ctx; }
export function useFilters(key: string) { const { filters, query } = useApp(); const [value, setValue] = useState<Filters>(() => { const f = { ...(filters.get(key) || defaultFilters) }; for (const k of Object.keys(f) as (keyof Filters)[]) if (query.has(k)) f[k] = query.get(k)!; return f; }); return [value, (f: Filters) => { filters.set(key, f); setValue(f); }] as const; }
