import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Employee, EmployeeBalance, AuditLogEntry, SystemState, EmployeeWithBalance, BalanceField, MONTHLY_SICK_GRANT, MONTHLY_VAC_GRANT } from '@/types/pto';
import { toast } from 'sonner';

// Employees
export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployeesWithBalances() {
  return useQuery({
    queryKey: ['employees-with-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          employee_balances (*)
        `)
        .order('full_name');
      if (error) throw error;
      return data.map((emp: any) => {
        // Handle both array and object formats from Supabase
        const balanceData = emp.employee_balances;
        const balances = Array.isArray(balanceData) 
          ? balanceData[0] || null 
          : balanceData || null;
        return {
          ...emp,
          balances,
        };
      }) as EmployeeWithBalance[];
    },
    staleTime: 0, // Always refetch
    refetchOnMount: true,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ full_name, hire_date }: { full_name: string; hire_date: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .insert({ full_name, hire_date })
        .select()
        .single();
      if (error) throw error;
      
      // Log the action
      await supabase.from('audit_log').insert({
        employee_id: data.id,
        action_type: 'EMPLOYEE_CREATED',
        category: 'EMPLOYEE',
        note: `Employee "${full_name}" created with hire date ${hire_date}`,
      });
      
      return data as Employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success('Employee added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add employee: ' + error.message);
    },
  });
}

export function useToggleEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active, full_name }: { id: string; is_active: boolean; full_name: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
      
      await supabase.from('audit_log').insert({
        employee_id: id,
        action_type: is_active ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
        category: 'EMPLOYEE',
        note: `Employee "${full_name}" ${is_active ? 'activated' : 'deactivated'}`,
      });
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success(`Employee ${is_active ? 'activated' : 'deactivated'}`);
    },
    onError: (error) => {
      toast.error('Failed to update employee: ' + error.message);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, full_name }: { id: string; full_name: string }) => {
      // First delete related audit logs (set employee_id to null)
      await supabase
        .from('audit_log')
        .update({ employee_id: null })
        .eq('employee_id', id);
      
      // Delete the employee (cascade will handle balances)
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      // Log the deletion
      await supabase.from('audit_log').insert({
        action_type: 'EMPLOYEE_DELETED',
        category: 'EMPLOYEE',
        note: `Employee "${full_name}" permanently deleted`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success('Employee permanently deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete employee: ' + error.message);
    },
  });
}

// PTO Usage
export function useRecordPTOUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      employee_id, 
      balance_field, 
      hours,
      employee_name 
    }: { 
      employee_id: string; 
      balance_field: BalanceField; 
      hours: number;
      employee_name: string;
    }) => {
      // Get current balance
      const { data: balance, error: fetchError } = await supabase
        .from('employee_balances')
        .select('*')
        .eq('employee_id', employee_id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentValue = Number(balance[balance_field]);
      if (currentValue < hours) {
        throw new Error(`Insufficient balance. Available: ${currentValue} hours`);
      }
      
      // Update balance
      const { error: updateError } = await supabase
        .from('employee_balances')
        .update({ [balance_field]: currentValue - hours })
        .eq('employee_id', employee_id);
      
      if (updateError) throw updateError;
      
      // Log the action
      await supabase.from('audit_log').insert({
        employee_id,
        action_type: 'PTO_USAGE',
        category: 'USAGE',
        balance_field,
        hours: -hours,
        note: `Used ${hours} hours from ${balance_field} for "${employee_name}"`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success('PTO usage recorded');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Adjustments
export function useRecordAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      employee_id, 
      balance_field, 
      hours,
      note,
      employee_name 
    }: { 
      employee_id: string; 
      balance_field: BalanceField; 
      hours: number;
      note: string;
      employee_name: string;
    }) => {
      // Get current balance
      const { data: balance, error: fetchError } = await supabase
        .from('employee_balances')
        .select('*')
        .eq('employee_id', employee_id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentValue = Number(balance[balance_field]);
      const newValue = currentValue + hours;
      
      if (newValue < 0) {
        throw new Error(`Adjustment would result in negative balance. Current: ${currentValue} hours`);
      }
      
      // Update balance
      const { error: updateError } = await supabase
        .from('employee_balances')
        .update({ [balance_field]: newValue })
        .eq('employee_id', employee_id);
      
      if (updateError) throw updateError;
      
      // Log the action
      await supabase.from('audit_log').insert({
        employee_id,
        action_type: 'ADJUSTMENT',
        category: 'ADJUSTMENT',
        balance_field,
        hours,
        note: `Adjustment for "${employee_name}": ${note}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success('Adjustment recorded');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// System State
export function useSystemState() {
  return useQuery({
    queryKey: ['system-state'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_state')
        .select('*');
      if (error) throw error;
      
      const stateMap: Record<string, any> = {};
      data.forEach((item: any) => {
        stateMap[item.key] = item.value;
        stateMap[`${item.key}_updated_at`] = item.updated_at;
        stateMap[`${item.key}_run_count`] = item.run_count;
      });
      return stateMap;
    },
  });
}

interface AccrualRolloverResult {
  success: boolean;
  message: string;
  count: number;
  already_run?: boolean;
  last_run_at?: string;
  last_run_by?: string;
  run_count?: number;
}

// Monthly Accrual - Now uses server-side RPC function with authorization
export function useRunMonthlyAccrual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data, error } = await supabase.rpc('run_monthly_accrual', { _force: force });
      if (error) throw error;
      return data as unknown as AccrualRolloverResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['system-state'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      if (result.success) {
        toast.success(result.message);
      }
      // Don't show toast for already_run case - handled in component
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Year-End Rollover - Now uses server-side RPC function with authorization
export function useRunYearEndRollover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data, error } = await supabase.rpc('run_year_end_rollover', { _force: force });
      if (error) throw error;
      return data as unknown as AccrualRolloverResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['system-state'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      if (result.success) {
        toast.success(result.message);
      }
      // Don't show toast for already_run case - handled in component
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Mass Adjustment
export function useMassAdjustBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employee_ids,
      balance_field,
      adjustment_type,
      amount,
      reason,
      effective_date,
    }: {
      employee_ids: string[];
      balance_field: string;
      adjustment_type: 'add' | 'subtract' | 'set';
      amount: number;
      reason: string;
      effective_date: string;
    }) => {
      const { data, error } = await supabase.rpc('mass_adjust_balances', {
        _employee_ids: employee_ids,
        _balance_field: balance_field,
        _adjustment_type: adjustment_type,
        _amount: amount,
        _reason: reason,
        _effective_date: effective_date,
      });
      if (error) throw error;
      return data as { success: boolean; message: string; count: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Audit Log
export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          *,
          employees (full_name)
        `)
        .order('timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data.map((entry: any) => ({
        ...entry,
        employee_name: entry.employees?.full_name || 'N/A',
      }));
    },
  });
}
