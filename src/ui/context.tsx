import { createContext, useContext } from "react";
import type { Repository } from "../data/repository";
import type { Kind, LifeRecord, Preferences } from "../domain/model";
export interface AppContextValue {
  repo: Repository;
  records: LifeRecord[];
  p: Preferences;
  edit: (
    kind: Kind,
    record?: LifeRecord,
    initial?: Record<string, string | number | boolean | string[]>,
  ) => void;
  remove: (record: LifeRecord) => Promise<void>;
  notify: (message: string) => void;
  navigate: (route: string) => void;
  setPreferences: (p: Preferences) => Promise<void>;
}
export const AppContext = createContext<AppContextValue | undefined>(undefined);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("Missing app context");
  return ctx;
}
