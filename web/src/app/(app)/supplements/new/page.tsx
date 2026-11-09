"use client";

import { useRouter } from "next/navigation";
import { SupplementForm } from "@/components/supplements/supplement-form";
import { AppTop, PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store/store-provider";

export default function NewSupplementPage() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();

  return (
    <div className="animate-fade-up">
      <AppTop />
      <PageHeader
        eyebrow="New"
        title="新增保健品"
        description="輸入名稱後會顯示常見的服用時機，按「套用」才會寫進時段。"
      />
      <div className="px-5">
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
    </div>
  );
}
