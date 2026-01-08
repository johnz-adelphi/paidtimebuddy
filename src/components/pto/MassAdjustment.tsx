import { useState, useMemo } from 'react';
import { useEmployeesWithBalances, useMassAdjustBalances } from '@/hooks/usePTO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users, CheckCircle } from 'lucide-react';
import { BalanceField, BALANCE_FIELD_LABELS } from '@/types/pto';
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

type AdjustmentType = 'add' | 'subtract' | 'set';

const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  add: 'Add Hours',
  subtract: 'Subtract Hours',
  set: 'Set To (Override)',
};

export function MassAdjustment() {
  const { data: employees, isLoading } = useEmployeesWithBalances();
  const massAdjust = useMassAdjustBalances();

  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [balanceField, setBalanceField] = useState<BalanceField>('vac_current');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const activeEmployees = useMemo(() => 
    employees?.filter(e => e.is_active) || [], 
    [employees]
  );

  const selectedEmployeeData = useMemo(() => 
    activeEmployees.filter(e => selectedEmployees.has(e.id)),
    [activeEmployees, selectedEmployees]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(activeEmployees.map(e => e.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (id: string, checked: boolean) => {
    const newSet = new Set(selectedEmployees);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedEmployees(newSet);
  };

  const calculateNewValue = (currentValue: number): number => {
    const hrs = parseFloat(amount) || 0;
    switch (adjustmentType) {
      case 'add': return currentValue + hrs;
      case 'subtract': return Math.max(currentValue - hrs, 0);
      case 'set': return hrs;
    }
  };

  const previewData = useMemo(() => {
    if (!showPreview) return [];
    return selectedEmployeeData.map(emp => {
      const currentValue = emp.balances ? Number(emp.balances[balanceField]) : 0;
      const newValue = calculateNewValue(currentValue);
      const change = newValue - currentValue;
      return {
        id: emp.id,
        name: emp.full_name,
        currentValue,
        newValue,
        change,
      };
    });
  }, [showPreview, selectedEmployeeData, balanceField, adjustmentType, amount]);

  const isValid = selectedEmployees.size > 0 && parseFloat(amount) > 0 && reason.trim().length > 0;

  const handlePreview = () => {
    if (isValid) {
      setShowPreview(true);
    }
  };

  const handleSubmit = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    massAdjust.mutate({
      employee_ids: Array.from(selectedEmployees),
      balance_field: balanceField,
      adjustment_type: adjustmentType,
      amount: parseFloat(amount),
      reason: reason.trim(),
      effective_date: effectiveDate,
    }, {
      onSuccess: () => {
        setSelectedEmployees(new Set());
        setAmount('');
        setReason('');
        setShowPreview(false);
        setShowConfirmDialog(false);
      },
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading employees...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mass PTO Adjustment
          </CardTitle>
          <CardDescription>
            Apply a single adjustment to multiple employees at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Employee Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Select Employees</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedEmployees.size === activeEmployees.length && activeEmployees.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select All ({activeEmployees.length})
                </Label>
              </div>
            </div>
            
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {activeEmployees.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No active employees</div>
              ) : (
                <div className="divide-y">
                  {activeEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                      <Checkbox
                        id={emp.id}
                        checked={selectedEmployees.has(emp.id)}
                        onCheckedChange={(checked) => handleSelectEmployee(emp.id, !!checked)}
                      />
                      <Label htmlFor={emp.id} className="flex-1 cursor-pointer">
                        {emp.full_name}
                      </Label>
                      {emp.balances && (
                        <span className="text-xs text-muted-foreground">
                          {BALANCE_FIELD_LABELS[balanceField]}: {Number(emp.balances[balanceField]).toFixed(2)}h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {selectedEmployees.size > 0 && (
              <Badge variant="secondary">{selectedEmployees.size} employee(s) selected</Badge>
            )}
          </div>

          {/* Adjustment Settings */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Balance Type</Label>
              <Select value={balanceField} onValueChange={(v) => setBalanceField(v as BalanceField)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BALANCE_FIELD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter hours"
              />
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (Required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this adjustment..."
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handlePreview} 
              disabled={!isValid}
              variant="outline"
            >
              Preview Changes
            </Button>
            {showPreview && (
              <Button 
                onClick={handleSubmit}
                disabled={massAdjust.isPending}
              >
                {massAdjust.isPending ? 'Applying...' : 'Apply Adjustment'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Preview Changes
            </CardTitle>
            <CardDescription>
              Review the impact before applying. This will affect {previewData.length} employee(s).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Adjustment Summary</AlertTitle>
              <AlertDescription>
                {ADJUSTMENT_TYPE_LABELS[adjustmentType]} {parseFloat(amount).toFixed(2)} hours 
                to {BALANCE_FIELD_LABELS[balanceField]} for {previewData.length} employee(s).
                <br />
                <strong>Reason:</strong> {reason}
                <br />
                <strong>Effective Date:</strong> {effectiveDate}
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.currentValue.toFixed(2)}h</TableCell>
                      <TableCell className="text-right">
                        <span className={row.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}h
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{row.newValue.toFixed(2)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Confirm Mass Adjustment
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to {adjustmentType === 'set' ? 'set' : adjustmentType} {parseFloat(amount).toFixed(2)} hours 
              {adjustmentType !== 'set' && (adjustmentType === 'add' ? ' to' : ' from')} {BALANCE_FIELD_LABELS[balanceField]} for {selectedEmployees.size} employee(s).
              <br /><br />
              <strong>Reason:</strong> {reason}
              <br />
              <strong>Effective Date:</strong> {effectiveDate}
              <br /><br />
              This action will be logged in the audit trail. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirm & Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
