import { useCallback, useEffect, useState } from 'react';
import { listModelConfigs } from '@/services/model-configs';
import type { ModelConfigRecord } from '@/types/model-configs';

function pickPrimaryConfig(configs: ModelConfigRecord[]) {
  return configs.find((item) => item.status === 'ACTIVE') ?? configs[0] ?? null;
}

export function useWorkspaceModelConfig(workspaceId: string) {
  const [activeConfig, setActiveConfig] = useState<ModelConfigRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const normalized = workspaceId.trim();
    if (!normalized) {
      setActiveConfig(null);
      return null;
    }

    setLoading(true);
    try {
      const configs = await listModelConfigs(normalized);
      const nextConfig = pickPrimaryConfig(configs);
      setActiveConfig(nextConfig);
      return nextConfig;
    } catch {
      setActiveConfig(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    activeConfig,
    loading,
    reload,
  };
}
