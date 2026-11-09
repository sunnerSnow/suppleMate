"use client";

import { useId, useState, type FormEvent } from "react";
import { KnowledgeCard } from "@/components/knowledge/knowledge-card";
import { useKnowledge } from "@/components/knowledge/use-knowledge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, SelectWrap, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { COMMON_UNITS, MAX_DAILY_FREQUENCY, PRODUCT_FORM_LABELS, SLOT_LABELS } from "@/lib/constants";
import { supplementInputSchema, toFieldErrors, type FieldErrors, type SupplementInput } from "@/lib/domain/validation";
import { suggestSlots } from "@/lib/knowledge/advice";
import { PRODUCT_FORMS, SCHEDULE_SLOTS, type ProductForm, type ScheduleSlot, type Supplement } from "@/lib/types";

type FormState = {
  name: string;
  brand: string;
  productForm: ProductForm | "";
  servingSize: string;
  dosePerIntake: string;
  doseUnit: string;
  dailyFrequency: number;
  scheduleSlots: ScheduleSlot[];
  stockQuantity: string;
  lowStockThreshold: string;
  expirationDate: string;
  notes: string;
};

function fromSupplement(s?: Supplement, initialName = ""): FormState {
  return {
    name: s?.name ?? initialName,
    brand: s?.brand ?? "",
    productForm: s?.productForm ?? "",
    servingSize: s?.servingSize ?? "",
    dosePerIntake: s ? String(s.dosePerIntake) : "1",
    doseUnit: s?.doseUnit ?? "顆",
    dailyFrequency: s?.dailyFrequency ?? 1,
    scheduleSlots: s?.scheduleSlots ?? ["unconfirmed"],
    stockQuantity: s ? String(s.stockQuantity) : "",
    lowStockThreshold: s ? String(s.lowStockThreshold) : "7",
    expirationDate: s?.expirationDate ?? "",
    notes: s?.notes ?? "",
  };
}

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

function toInput(f: FormState): unknown {
  return {
    name: f.name,
    brand: f.brand,
    productForm: f.productForm || undefined,
    servingSize: f.servingSize,
    dosePerIntake: num(f.dosePerIntake),
    doseUnit: f.doseUnit,
    dailyFrequency: f.dailyFrequency,
    scheduleSlots: f.scheduleSlots,
    stockQuantity: num(f.stockQuantity),
    lowStockThreshold: num(f.lowStockThreshold),
    expirationDate: f.expirationDate,
    notes: f.notes,
  };
}

export function SupplementForm({
  initial,
  initialName,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Supplement;
  /** 新增時預填的名稱（健檢頁「新增 ○○」帶過來） */
  initialName?: string;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (input: SupplementInput) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromSupplement(initial, initialName));
  const [errors, setErrors] = useState<FieldErrors>({});
  const isEdit = Boolean(initial);
  const knowledge = useKnowledge(form.name);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const setFrequency = (n: number) => {
    setForm((f) => {
      const slots = f.scheduleSlots.slice(0, n);
      while (slots.length < n) slots.push("unconfirmed");
      return { ...f, dailyFrequency: n, scheduleSlots: slots };
    });
    setErrors((e) => ({ ...e, scheduleSlots: undefined }));
  };

  const setSlot = (index: number, slot: ScheduleSlot) => {
    setForm((f) => ({ ...f, scheduleSlots: f.scheduleSlots.map((s, i) => (i === index ? slot : s)) }));
  };

  const suggested = knowledge.entry ? suggestSlots(knowledge.entry, form.dailyFrequency) : null;
  const suggestionApplied = suggested ? [...suggested].sort().join() === [...form.scheduleSlots].sort().join() : false;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = supplementInputSchema.safeParse(toInput(form));
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Card>
        <div className="card-head">
          <h2 className="h2">
            <span className="en">Basics</span>基本資料
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <Field
            label="名稱"
            htmlFor={`${id}-name`}
            required
            error={errors.name}
            hint="輸入後會自動查小知識與常見服用時機"
          >
            <Input
              id={`${id}-name`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="例如：魚油"
              invalid={Boolean(errors.name)}
              autoComplete="off"
            />
          </Field>
          <Field label="品牌" htmlFor={`${id}-brand`} error={errors.brand}>
            <Input
              id={`${id}-brand`}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              placeholder="選填"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="產品形式" htmlFor={`${id}-productForm`}>
              <SelectWrap>
                <Select
                  id={`${id}-productForm`}
                  value={form.productForm}
                  onChange={(e) => set("productForm", e.target.value as ProductForm | "")}
                >
                  <option value="">未指定</option>
                  {PRODUCT_FORMS.map((f) => (
                    <option key={f} value={f}>
                      {PRODUCT_FORM_LABELS[f]}
                    </option>
                  ))}
                </Select>
              </SelectWrap>
            </Field>
            <Field label="每份數量" htmlFor={`${id}-servingSize`} error={errors.servingSize}>
              <Input
                id={`${id}-servingSize`}
                value={form.servingSize}
                onChange={(e) => set("servingSize", e.target.value)}
                placeholder="例如：2 顆"
              />
            </Field>
          </div>
        </div>
      </Card>

      {knowledge.status === "ready" && knowledge.entry && (
        <KnowledgeCard
          entry={knowledge.entry}
          compact
          suggestedSlots={suggested && !suggestionApplied ? suggested : undefined}
          onApply={() => suggested && setForm((f) => ({ ...f, scheduleSlots: suggested }))}
        />
      )}
      {knowledge.status === "none" && form.name.trim().length > 1 && (
        <div className="kcard">
          <b>沒有「{form.name.trim()}」的內建小知識</b>
          可以請 AI 依名稱整理一張小知識卡（一般資訊，非醫療建議），之後其他人輸入同樣名稱也會看到。
          <div className="mt-2">
            <Button
              size="sm"
              variant="accent"
              loading={knowledge.generating}
              onClick={async () => {
                const r = await knowledge.generate();
                if (!r.ok) toast.error(r.message);
              }}
            >
              請 AI 整理
            </Button>
          </div>
        </div>
      )}

      <Card alt>
        <div className="card-head">
          <h2 className="h2">
            <span className="en">Schedule</span>服用計畫
          </h2>
        </div>
        <p className="sub-text m-0 mb-3 text-xs">請依產品標示或專業人員建議填寫；還沒確定的時段請保留「尚未確認」。</p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="每次服用量" htmlFor={`${id}-dosePerIntake`} required error={errors.dosePerIntake}>
              <Input
                id={`${id}-dosePerIntake`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.dosePerIntake}
                onChange={(e) => set("dosePerIntake", e.target.value)}
                invalid={Boolean(errors.dosePerIntake)}
              />
            </Field>
            <Field label="單位" htmlFor={`${id}-doseUnit`} required error={errors.doseUnit}>
              <Input
                id={`${id}-doseUnit`}
                list={`${id}-units`}
                value={form.doseUnit}
                onChange={(e) => set("doseUnit", e.target.value)}
                placeholder="顆、mL…"
                invalid={Boolean(errors.doseUnit)}
              />
              <datalist id={`${id}-units`}>
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="每日次數" htmlFor={`${id}-dailyFrequency`} required error={errors.dailyFrequency}>
            <SelectWrap>
              <Select
                id={`${id}-dailyFrequency`}
                value={form.dailyFrequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
              >
                {Array.from({ length: MAX_DAILY_FREQUENCY }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    每日 {n} 次
                  </option>
                ))}
              </Select>
            </SelectWrap>
          </Field>
          {form.scheduleSlots.map((slot, index) => (
            <Field
              key={index}
              label={form.dailyFrequency === 1 ? "服用時段" : `第 ${index + 1} 次時段`}
              htmlFor={`${id}-slot-${index}`}
              required
              error={index === 0 ? errors.scheduleSlots : undefined}
            >
              <SelectWrap>
                <Select
                  id={`${id}-slot-${index}`}
                  value={slot}
                  onChange={(e) => setSlot(index, e.target.value as ScheduleSlot)}
                >
                  {SCHEDULE_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </SelectWrap>
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <h2 className="h2">
            <span className="en">Stock</span>庫存
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={isEdit ? "目前庫存" : "初始庫存"}
              htmlFor={`${id}-stockQuantity`}
              required
              error={errors.stockQuantity}
              hint={isEdit ? "改動會記錄為人工調整" : undefined}
            >
              <Input
                id={`${id}-stockQuantity`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.stockQuantity}
                onChange={(e) => set("stockQuantity", e.target.value)}
                placeholder="0"
                invalid={Boolean(errors.stockQuantity)}
              />
            </Field>
            <Field
              label="低庫存門檻"
              htmlFor={`${id}-lowStockThreshold`}
              required
              error={errors.lowStockThreshold}
              hint="低於此數量提醒補貨"
            >
              <Input
                id={`${id}-lowStockThreshold`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.lowStockThreshold}
                onChange={(e) => set("lowStockThreshold", e.target.value)}
                invalid={Boolean(errors.lowStockThreshold)}
              />
            </Field>
          </div>
          <Field label="有效期限" htmlFor={`${id}-expirationDate`} error={errors.expirationDate}>
            <Input
              id={`${id}-expirationDate`}
              type="date"
              value={form.expirationDate}
              onChange={(e) => set("expirationDate", e.target.value)}
              invalid={Boolean(errors.expirationDate)}
            />
          </Field>
          <Field label="備註" htmlFor={`${id}-notes`} error={errors.notes}>
            <Textarea
              id={`${id}-notes`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="例如：隨餐服用、依產品標示"
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
        )}
        <Button type="submit" loading={submitting} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
