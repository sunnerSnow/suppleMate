"use client";

import { useParams, useRouter } from "next/navigation";
import { SupplementForm } from "@/components/supplements/supplement-form";
import { ButtonLink } from "@/components/ui/button";
import { AppTop, PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store/store-provider";

export default function EditSupplementPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const s = store.supplements.find((x) => x.id === id);

  if (store.status === "loading") return <ListSkeleton />;
  if (store.status === "error") return <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />;
  if (!s) {
    return (
      <div className="mt-4">
        <EmptyState title="找不到這項保健品" action={<ButtonLink href="/supplements">回到保健品清單</ButtonLink>} />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <AppTop />
      <PageHeader
        eyebrow="Edit"
        title={`編輯 ${s.name}`}
        description="改動服用量或時段從現在起生效，過去的服用紀錄會保留當時的快照。"
      />
      <div className="px-5">
        <SupplementForm
          key={s.id}
          initial={s}
          submitting={store.isPending(`supplement:update:${s.id}`)}
          submitLabel="儲存變更"
          onCancel={() => router.back()}
          onSubmit={async (input) => {
            const updated = await store.updateSupplement(s.id, input);
            if (updated) {
              toast.success("已儲存");
              router.replace(`/supplements/${s.id}`);
            }
          }}
        />
      </div>
    </div>
  );
}
