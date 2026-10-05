import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company } from '../types';

const STORAGE_KEY = '@shukatsu:companies_v1';

interface CompaniesContextValue {
  companies: Company[];
  loading: boolean;
  addCompany: (c: Company) => Promise<void>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  replaceAll: (list: Company[]) => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null);

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setCompanies(JSON.parse(raw) as Company[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (list: Company[]) => {
    setCompanies(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const addCompany = useCallback(
    async (c: Company) => persist([...companies, c]),
    [companies, persist],
  );

  const updateCompany = useCallback(
    async (id: string, data: Partial<Company>) =>
      persist(companies.map((c) => (c.id === id ? { ...c, ...data } : c))),
    [companies, persist],
  );

  const deleteCompany = useCallback(
    async (id: string) => persist(companies.filter((c) => c.id !== id)),
    [companies, persist],
  );

  const replaceAll = useCallback(
    async (list: Company[]) => persist(list),
    [persist],
  );

  return (
    <CompaniesContext.Provider
      value={{ companies, loading, addCompany, updateCompany, deleteCompany, replaceAll }}
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
