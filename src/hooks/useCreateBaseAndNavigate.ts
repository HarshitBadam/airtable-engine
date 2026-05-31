import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function useCreateBaseAndNavigate(createBase: (name: string) => { id: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const [pendingBaseId, setPendingBaseId] = useState<string | null>(null);
  const router = useRouter();

  const pendingTablesQ = api.table.listByBase.useQuery(
    { baseId: pendingBaseId! },
    { enabled: !!pendingBaseId, refetchInterval: 400, retry: true, retryDelay: 400 },
  );

  useEffect(() => {
    if (!pendingBaseId) return;
    const tables = pendingTablesQ.data;
    if (tables && tables.length > 0) {
      router.push(`/bases/${pendingBaseId}/tables/${tables[0]!.id}`);
    }
  }, [pendingBaseId, pendingTablesQ.data, router]);

  const handleCreateBase = () => {
    if (isCreating) return;
    setIsCreating(true);
    const { id } = createBase("Untitled");
    setPendingBaseId(id);
  };

  return { handleCreateBase, isCreating, pendingBaseId };
}
