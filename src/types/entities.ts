import type { Json } from "@/integrations/supabase/types";

// ── Market ──

export interface MarketItem {
  id: string;
  list_id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  checked: boolean;
  checked_by: string | null;
  added_by: string | null;
  created_at: string;
}

export interface MarketList {
  id: string;
  family_id: string;
  name: string;
  type: string;
  is_default: boolean;
  use_categories: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_with: string[] | null;
  market_items: MarketItem[];
}

// ── Tasks ──

export interface TaskItem {
  id: string;
  list_id: string;
  name: string;
  note: string | null;
  done: boolean;
  priority: string;
  assigned_to: string | null;
  added_by: string | null;
  repeat_enabled: boolean;
  repeat_days: number[] | null;
  repeat_count: number | null;
  created_at: string;
}

export interface TaskList {
  id: string;
  family_id: string;
  name: string;
  type: string;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  shared_with: string[] | null;
  task_items: TaskItem[];
}

// ── Debts ──

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  currency: string;
  type: string | null;
  item_description: string | null;
  date: string | null;
  payment_details: Json | null;
  created_at: string;
}

export interface DebtPostponement {
  id: string;
  debt_id: string;
  new_date: string | null;
  reason: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  family_id: string;
  person_name: string;
  amount: number;
  currency: string;
  direction: string;
  date: string | null;
  due_date: string | null;
  note: string | null;
  payment_details: Json | null;
  has_reminder: boolean;
  is_fully_paid: boolean;
  is_archived: boolean;
  created_at: string;
  debt_payments: DebtPayment[];
  debt_postponements: DebtPostponement[];
}
