export interface Employee {
  id: string;
  full_name: string;
  hire_date: string;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeBalance {
  id: string;
  employee_id: string;
  sick_current: number;
  sick_rollover: number;
  vac_current: number;
  vac_rollover: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  employee_id: string | null;
  action_type: string;
  category: string;
  balance_field: string | null;
  hours: number | null;
  note: string;
}

export interface SystemState {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface EmployeeWithBalance extends Employee {
  balances: EmployeeBalance | null;
}

export type BalanceField = 'sick_current' | 'sick_rollover' | 'vac_current' | 'vac_rollover';

export const BALANCE_FIELD_LABELS: Record<BalanceField, string> = {
  sick_current: 'Sick (Current)',
  sick_rollover: 'Sick (Rollover)',
  vac_current: 'Vacation (Current)',
  vac_rollover: 'Vacation (Rollover)',
};

export const ANNUAL_SICK_HOURS = 40;
export const ANNUAL_VAC_HOURS = 40;
export const MONTHLY_SICK_GRANT = ANNUAL_SICK_HOURS / 12;
export const MONTHLY_VAC_GRANT = ANNUAL_VAC_HOURS / 12;