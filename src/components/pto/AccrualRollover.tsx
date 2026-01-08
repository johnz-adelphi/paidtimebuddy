import { useState } from 'react';
import { useSystemState, useRunMonthlyAccrual, useRunYearEndRollover, useEmployees } from '@/hooks/usePTO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarDays, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { MONTHLY_SICK_GRANT, MONTHLY_VAC_GRANT, ANNUAL_SICK_HOURS, ANNUAL_VAC_HOURS } from '@/types/pto';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';

interface ForceRunWarning {
  type: 'accrual' | 'rollover';
  lastRunAt: string;
  lastRunBy: string;
  runCount: number;
  period: string;
}

export function AccrualRollover() {
  const { data: systemState, isLoading: stateLoading } = useSystemState();
  const { data: employees } = useEmployees();
  const runAccrual = useRunMonthlyAccrual();
  const runRollover = useRunYearEndRollover();

  const [forceWarning, setForceWarning] = useState<ForceRunWarning | null>(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = now.getFullYear().toString();
  
  const lastAccrualMonth = systemState?.last_accrual_month || 'Never';
  const lastRolloverYear = systemState?.last_rollover_year || 'Never';
  
  const accrualAlreadyRun = lastAccrualMonth === currentMonth;
  const rolloverAlreadyRun = lastRolloverYear === currentYear;

  const activeEmployeeCount = employees?.filter(e => e.is_active).length || 0;

  const handleRunAccrual = async () => {
    const result = await runAccrual.mutateAsync(false);
    if (result.already_run) {
      setForceWarning({
        type: 'accrual',
        lastRunAt: result.last_run_at || '',
        lastRunBy: result.last_run_by || 'Unknown',
        runCount: result.run_count || 1,
        period: currentMonth,
      });
    }
  };

  const handleRunRollover = async () => {
    const result = await runRollover.mutateAsync(false);
    if (result.already_run) {
      setForceWarning({
        type: 'rollover',
        lastRunAt: result.last_run_at || '',
        lastRunBy: result.last_run_by || 'Unknown',
        runCount: result.run_count || 1,
        period: currentYear,
      });
    }
  };

  const handleForceRun = async () => {
    if (!forceWarning) return;
    
    if (forceWarning.type === 'accrual') {
      await runAccrual.mutateAsync(true);
    } else {
      await runRollover.mutateAsync(true);
    }
    setForceWarning(null);
  };

  const formatDateTime = (isoString: string) => {
    try {
      return format(new Date(isoString), 'MMM d, yyyy h:mm a');
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Policy Info */}
      <Card>
        <CardHeader>
          <CardTitle>PTO Policy Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Annual Sick Leave</h4>
              <p className="text-2xl font-bold">{ANNUAL_SICK_HOURS} hours/year</p>
              <p className="text-sm text-muted-foreground">
                {MONTHLY_SICK_GRANT.toFixed(2)} hours accrued monthly
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Annual Vacation Leave</h4>
              <p className="text-2xl font-bold">{ANNUAL_VAC_HOURS} hours/year</p>
              <p className="text-sm text-muted-foreground">
                {MONTHLY_VAC_GRANT.toFixed(2)} hours accrued monthly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Accrual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Monthly Accrual
            </CardTitle>
            <CardDescription>
              Grant monthly sick and vacation hours to all active employees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Month:</span>
                <span className="font-medium">{currentMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Accrual:</span>
                <span className="font-medium">{lastAccrualMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Employees:</span>
                <span className="font-medium">{activeEmployeeCount}</span>
              </div>
              {accrualAlreadyRun && systemState?.last_accrual_month_run_count > 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Run Count:</span>
                  <span className="font-medium text-amber-600">{systemState.last_accrual_month_run_count}x</span>
                </div>
              )}
            </div>

            {accrualAlreadyRun ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Already Run</AlertTitle>
                <AlertDescription>
                  Monthly accrual has already been run for {currentMonth}. 
                  You can run it again if needed.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ready to Run</AlertTitle>
                <AlertDescription>
                  This will grant {MONTHLY_SICK_GRANT.toFixed(2)} sick hours and {MONTHLY_VAC_GRANT.toFixed(2)} vacation hours to each of {activeEmployeeCount} active employees.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleRunAccrual}
              disabled={runAccrual.isPending || stateLoading || activeEmployeeCount === 0}
              className="w-full"
              variant={accrualAlreadyRun ? "outline" : "default"}
            >
              {runAccrual.isPending ? 'Processing...' : accrualAlreadyRun ? 'Run Again' : 'Run Monthly Accrual'}
            </Button>
          </CardContent>
        </Card>

        {/* Year-End Rollover */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Year-End Rollover
            </CardTitle>
            <CardDescription>
              Move current balances to rollover buckets and reset current to zero.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Year:</span>
                <span className="font-medium">{currentYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Rollover:</span>
                <span className="font-medium">{lastRolloverYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Employees:</span>
                <span className="font-medium">{activeEmployeeCount}</span>
              </div>
              {rolloverAlreadyRun && systemState?.last_rollover_year_run_count > 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Run Count:</span>
                  <span className="font-medium text-amber-600">{systemState.last_rollover_year_run_count}x</span>
                </div>
              )}
            </div>

            {rolloverAlreadyRun ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Already Run</AlertTitle>
                <AlertDescription>
                  Year-end rollover has already been run for {currentYear}.
                  You can run it again if needed.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Caution</AlertTitle>
                <AlertDescription>
                  This will move all current sick and vacation balances into rollover buckets for all active employees.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleRunRollover}
              disabled={runRollover.isPending || stateLoading || activeEmployeeCount === 0}
              variant="outline"
              className="w-full"
            >
              {runRollover.isPending ? 'Processing...' : rolloverAlreadyRun ? 'Run Again' : 'Run Year-End Rollover'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Force Run Confirmation Dialog */}
      <AlertDialog open={!!forceWarning} onOpenChange={() => setForceWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {forceWarning?.type === 'accrual' ? 'Monthly Accrual' : 'Year-End Rollover'} Already Run
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This {forceWarning?.type} has already been processed for <strong>{forceWarning?.period}</strong>.
                </p>
                <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Last Run:</span>
                    <span className="font-medium">{forceWarning?.lastRunAt ? formatDateTime(forceWarning.lastRunAt) : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Run By:</span>
                    <span className="font-medium">{forceWarning?.lastRunBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Times Run:</span>
                    <span className="font-medium">{forceWarning?.runCount}x</span>
                  </div>
                </div>
                <p className="text-amber-600 font-medium">
                  Running again will {forceWarning?.type === 'accrual' 
                    ? 'add additional hours to all active employees' 
                    : 'reset current balances to zero again'}. 
                  Are you sure you want to proceed?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceRun}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Run Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
