import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeesWithBalances } from '@/hooks/usePTO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Eraser } from 'lucide-react';
import { toast } from 'sonner';

type BalanceType = 'sick' | 'vacation' | 'all';

export function ClearPTOBalance() {
  const queryClient = useQueryClient();
  const { data: employees } = useEmployeesWithBalances();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [balanceType, setBalanceType] = useState<BalanceType>('all');

  const activeEmployees = employees?.filter(e => e.is_active) || [];

  const clearBalance = useMutation({
    mutationFn: async ({ employeeId, balanceType }: { employeeId: string; balanceType: BalanceType }) => {
      const { data, error } = await supabase.rpc('clear_pto_balance', {
        _employee_id: employeeId,
        _balance_type: balanceType,
      });
      if (error) throw error;
      return data as { success: boolean; message: string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
      if (result.success) {
        toast.success(result.message);
        setSelectedEmployeeId('');
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const selectedEmployee = activeEmployees.find(e => e.id === selectedEmployeeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eraser className="h-5 w-5" />
          Clear PTO Balance
        </CardTitle>
        <CardDescription>
          Reset an employee's PTO balance to zero. This action is logged and cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee</label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Balance Type</label>
            <Select value={balanceType} onValueChange={(v) => setBalanceType(v as BalanceType)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sick">Sick Only</SelectItem>
                <SelectItem value="vacation">Vacation Only</SelectItem>
                <SelectItem value="all">All PTO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={!selectedEmployeeId || clearBalance.isPending}
              >
                <Eraser className="h-4 w-4 mr-2" />
                Clear Balance
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear PTO Balance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset {balanceType === 'all' ? 'all PTO balances' : `${balanceType} balance`} to zero for{' '}
                  <strong>{selectedEmployee?.full_name}</strong>. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearBalance.mutate({ employeeId: selectedEmployeeId, balanceType })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear Balance
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {selectedEmployee && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Current balances for {selectedEmployee.full_name}:</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sick:</span>{' '}
                {(Number(selectedEmployee.balances?.sick_current || 0) + Number(selectedEmployee.balances?.sick_rollover || 0)).toFixed(2)} hours
              </div>
              <div>
                <span className="text-muted-foreground">Vacation:</span>{' '}
                {(Number(selectedEmployee.balances?.vac_current || 0) + Number(selectedEmployee.balances?.vac_rollover || 0)).toFixed(2)} hours
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
