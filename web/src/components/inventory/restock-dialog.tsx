"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatQuantity } from "@/lib/domain/inventory";
import { restockInputSchema, toFieldErrors, type FieldErrors } from "@/lib/domain/validation";
import { useStore } from "@/lib/store/store-provider";
import type { Supplement } from "@/lib/types";

/**
 * 補貨對話框。傳入 supplement 即開啟，傳 null 關閉。
 * 表單狀態放在內層元件，關閉再開啟會重新掛載，自然重設。
 */
export function RestockDialog({ supplement, onClose }: { supplement: Supplement | null; onClose: () => void }) {
  return (
    <Dialog
      open={supplement !== null}
      onClose={onClose}
      title="補貨"
      description={
        supplement
          ? `${supplement.name} 目前 ${formatQuantity(supplement.stockQuantity)} ${supplement.doseUnit}`
          : undefined
      }
    >
      {supplement && <RestockForm key={supplement.id} supplement={supplement} onDone={onClose} />}
    </Dialog>
  );
}

function RestockForm({ supplement, onDone }: { supplement: Supplement; onDone: () => void }) {
  const id = useId();
  const store = useStore();
  const toast = useToast();
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(store.today);
  const [expirationDate, setExpirationDate] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = restockInputSchema.safeParse({
      quantity: quantity.trim() === "" ? Number.NaN : Number(quantity),
      purchaseDate,
      expirationDate,
      note,
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    const r = await store.restock(supplement.id, parsed.data);
    if (!r) return;
    if (r.ok) {
      toast.success(
        `${supplement.name} 已補貨，目前 ${formatQuantity(r.value.supplement.stockQuantity)} ${supplement.doseUnit}`,
      );
      onDone();
    } else {
      toast.error(r.error.message);
    }
  };

  const pending = store.isPending(`restock:${supplement.id}`);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={`新增數量（${supplement.doseUnit}）`} htmlFor={`${id}-qty`} required error={errors.quantity}>
        <Input
          id={`${id}-qty`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          autoFocus
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="例如：60"
          invalid={Boolean(errors.quantity)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="購買日期" htmlFor={`${id}-pd`} error={errors.purchaseDate}>
          <Input id={`${id}-pd`} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </Field>
        <Field label="有效期限" htmlFor={`${id}-ed`} error={errors.expirationDate}>
          <Input
            id={`${id}-ed`}
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="備註" htmlFor={`${id}-note`} error={errors.note}>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：藥局特價買兩瓶"
          className="min-h-20"
        />
      </Field>
      <Button type="submit" loading={pending} size="lg" className="mt-1 w-full">
        確認補貨
      </Button>
    </form>
  );
}
