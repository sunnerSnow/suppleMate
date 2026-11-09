"use client";

import { useRouter } from "next/navigation";
import { SupplementForm } from "@/components/supplements/supplement-form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store/store-provider";

export default function NewSupplementPage() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();

  return (
    <div className="animate-fade-up">
      <PageHeader tone="green" eyebrow="New" title="新增保健品" />
      <SupplementForm
        submitting={store.isPending("supplement:create")}
        submitLabel="新增保健品"
        onCancel={() => router.back()}
        onSubmit={async (input) => {
          const created = await store.createSupplement(input);
          if (created) {
            toast.success(`已新增 ${created.name}`);
            router.replace("/supplements");
          }
        }}
      />
    </div>
  );
}
