import {useState, useCallback} from 'react';
import {supabase} from '../services/supabase';

interface Profile {
  name: string | null;
  address: string | null;
}

interface Dependent {
  id: string;
  name: string;
}

interface UserState {
  profile: Profile | null;
  dependents: Dependent[];
  email: string;
}

let state: UserState = {profile: null, dependents: [], email: ''};
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(fn => fn());
}

export async function initUser(userId: string, email: string): Promise<void> {
  state = {...state, email};

  const [{data: prof}, {data: deps}] = await Promise.all([
    supabase.from('profiles').select('name, address').eq('id', userId).single(),
    supabase
      .from('dependents')
      .select('id, name')
      .eq('profile_id', userId)
      .order('created_at'),
  ]);

  state = {
    email,
    profile: prof ?? null,
    dependents: deps ?? [],
  };
  notify();
}

export function cleanupUser(): void {
  state = {profile: null, dependents: [], email: ''};
  notify();
}

export function useUser() {
  const [, forceUpdate] = useState(0);

  const subscribe = useCallback(() => {
    const refresh = () => forceUpdate(n => n + 1);
    listeners.push(refresh);
    return () => {
      listeners = listeners.filter(fn => fn !== refresh);
    };
  }, []);

  return {state, subscribe};
}
