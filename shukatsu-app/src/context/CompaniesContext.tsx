import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company, Selection, Weights } from '../types';
import { DEFAULT_WEIGHTS } from '../constants';

const STORAGE_KEY = '@shukatsu:companies_v1';
const WEIGHTS_KEY = '@shukatsu:weights_v1';

interface CompaniesContextValue {
  companies: Company[];
  loading: boolean;
  addCompany: (c: Company) => Promise<void>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  replaceAll: (list: Company[]) => Promise<void>;
  /** 1つの選考だけを更新（振り返り・準備タスクなど） */
  updateSelection: (companyId: string, selectionId: string, data: Partial<Selection>) => Promise<void>;
  /** 内定比較の重視度 */
  weights: Weights;
  setWeights: (w: Weights) => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null);

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [weights, setWeightsState] = useState<Weights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  // 連続した更新でも最新の一覧を基準にするため ref に保持
  const latest = useRef<Company[]>([]);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(WEIGHTS_KEY)])
      .then(([raw, w]) => {
        if (raw) {
          const list = JSON.parse(raw) as Company[];
          latest.current = list;
          setCompanies(list);
        }
        if (w) setWeightsState({ ...DEFAULT_WEIGHTS, ...JSON.parse(w) });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const mutate = useCallback(async (fn: (list: Company[]) => Company[]) => {
    const next = fn(latest.current);
    latest.current = next;
    setCompanies(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addCompany = useCallback(
    async (c: Company) => mutate((list) => [...list, c]),
    [mutate],
  );

  const updateCompany = useCallback(
    async (id: string, data: Partial<Company>) =>
      mutate((list) => list.map((c) => (c.id === id ? { ...c, ...data } : c))),
    [mutate],
  );

  const deleteCompany = useCallback(
    async (id: string) => mutate((list) => list.filter((c) => c.id !== id)),
    [mutate],
  );

  const replaceAll = useCallback(
    async (list: Company[]) => mutate(() => list),
    [mutate],
  );

  const updateSelection = useCallback(
    async (companyId: string, selectionId: string, data: Partial<Selection>) =>
      mutate((list) => list.map((c) => (c.id !== companyId ? c : {
        ...c,
        flows: c.flows.map((f) => (f.id === selectionId ? { ...f, ...data } : f)),
      }))),
    [mutate],
  );

  const setWeights = useCallback(async (w: Weights) => {
    setWeightsState(w);
    await AsyncStorage.setItem(WEIGHTS_KEY, JSON.stringify(w));
  }, []);

  return (
    <CompaniesContext.Provider
      value={{
        companies, loading, addCompany, updateCompany, deleteCompany, replaceAll,
        updateSelection, weights, setWeights,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}

export function useCompanies(): CompaniesContextValue {
  const ctx = useContext(CompaniesContext);
  if (!ctx) throw new Error('useCompanies must be used within CompaniesProvider');
  return ctx;
}
