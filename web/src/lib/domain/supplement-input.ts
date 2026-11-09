import type { SupplementInput } from "@/lib/domain/validation";
import type { Supplement } from "@/lib/types";

/** 把現有保健品轉回表單輸入（套用建議時段等「只改一個欄位」的更新用） */
export function toSupplementInput(s: Supplement): SupplementInput {
  return {
    name: s.name,
    brand: s.brand,
    productForm: s.productForm,
    servingSize: s.servingSize,
    dosePerIntake: s.dosePerIntake,
    doseUnit: s.doseUnit,
    dailyFrequency: s.dailyFrequency,
    scheduleSlots: s.scheduleSlots,
    stockQuantity: s.stockQuantity,
    lowStockThreshold: s.lowStockThreshold,
    expirationDate: s.expirationDate,
    notes: s.notes,
  };
}
