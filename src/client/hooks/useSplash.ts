import { useCallback, useEffect, useState } from 'react';
import type { SplashResponse } from '../../shared/api';
import type { PostBinding } from '../../shared/types';

type SplashState = {
  loading: boolean;
  error: string | null;
  binding: PostBinding | null;
  gameCount: number;
  modsAvailable: boolean;
  playtestMode: boolean;
};

export const useSplash = () => {
  const [state, setState] = useState<SplashState>({
    loading: true,
    error: null,
    binding: null,
    gameCount: 0,
    modsAvailable: true,
    playtestMode: false,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch('/api/splash');
      if (!res.ok) {
        throw new Error(`Load failed: ${res.status}`);
      }

      const data: SplashResponse = await res.json();
      setState({
        loading: false,
        error: null,
        binding: data.binding,
        gameCount: data.gameCount,
        modsAvailable: data.modsAvailable,
        playtestMode: data.playtestMode,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load',
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
};
