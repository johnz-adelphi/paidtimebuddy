import { useState } from 'react';
import { useEmployeesWithBalances, useRecordPTOUsage, useRecordAdjustment } from '@/hooks/usePTO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BalanceField, BALANCE_FIELD_LABELS } from '@/types/pto';
import { Clock, Wrench } from 'lucide-react';

export function PTOUsageAdjustments() {
  const { data: employees } = useEmployeesWithBalances();
  const recordUsage = useRecordPTOUsage();
  const recordAdjustment = useRecordAdjustment();

  // Usage form state
  const [usageEmployeeId, setUsageEmployeeId] = useState('');
  const [usageField, setUsageField] = useState<BalanceField | ''>('');
  const [usageHours, setUsageHours] = useState('');

  // Adjustment form state
  const [adjEmployeeId, setAdjEmployeeId] = useState('');
  const [adjField, setAdjField] = useState<BalanceField | ''>('');
  const [adjHours, setAdjHours] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const activeEmployees = employees?.filter(e => e.is_active) || [];

  const getEmployeeName = (id: string) => {
    return activeEmployees.find(e => e.id === id)?.full_name || 'Unknown';
  };

  const handleRecordUsage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageEmployeeId || !usageField || !usageHours) return;

    recordUsage.mutate(
      {
        employee_id: usageEmployeeId,
        balance_field: usageField as BalanceField,
        hours: parseFloat(usageHours),
        employee_name: getEmployeeName(usageEmployeeId),
      },
      {
        onSuccess: () => {
          setUsageHours('');
        },
      }
    );
  };

  const handleRecordAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEmployeeId || !adjField || !adjHours || !adjNote.trim()) return;

    recordAdjustment.mutate(
      {
        employee_id: adjEmployeeId,
        balance_field: adjField as BalanceField,
        hours: parseFloat(adjHours),
        note: adjNote.trim(),
        employee_name: getEmployeeName(adjEmployeeId),
      },
      {
        onSuccess: () => {
          setAdjHours('');
          setAdjNote('');
        },
      }
    );
  };

  const selectedUsageEmployee = activeEmployees.find(e => e.id === usageEmployeeId);
  const selectedAdjEmployee = activeEmployees.find(e => e.id === adjEmployeeId);

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      {/* Record PTO Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Record PTO Usage
          </CardTitle>
          <CardDescription>
            Deduct hours when an employee takes time off. Cannot exceed available balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRecordUsage} className="space-y-4">
            <div>
              <Label htmlFor="usage-employee">Employee</Label>
              <Select value={usageEmployeeId} onValueChange={setUsageEmployeeId}>
                <SelectTrigger id="usage-employee">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.id.slice(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="usage-bucket">Deduct From</Label>
              <Select value={usageField} onValueChange={(v) => setUsageField(v as BalanceField)}>
                <SelectTrigger id="usage-bucket">
                  <SelectValue placeholder="Select bucket..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BALANCE_FIELD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUsageEmployee && usageField && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <strong>Available:</strong>{' '}
                {Number(selectedUsageEmployee.balances?.[usageField as BalanceField] || 0).toFixed(2)} hours
              </div>
            )}

            <div>
              <Label htmlFor="usage-hours">Hours Used</Label>
              <Input
                id="usage-hours"
                type="number"
                step="0.5"
                min="0.5"
                value={usageHours}
                onChange={(e) => setUsageHours(e.target.value)}
                placeholder="8"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={recordUsage.isPending}>
              {recordUsage.isPending ? 'Recording...' : 'Record Usage'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Administrative Adjustment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Administrative Adjustment
          </CardTitle>
          <CardDescription>
            Add or subtract hours for corrections, unpaid leave, or policy exceptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRecordAdjustment} className="space-y-4">
            <div>
              <Label htmlFor="adj-employee">Employee</Label>
              <Select value={adjEmployeeId} onValueChange={setAdjEmployeeId}>
                <SelectTrigger id="adj-employee">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.id.slice(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="adj-bucket">Balance Field</Label>
              <Select value={adjField} onValueChange={(v) => setAdjField(v as BalanceField)}>
                <SelectTrigger id="adj-bucket">
                  <SelectValue placeholder="Select bucket..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BALANCE_FIELD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAdjEmployee && adjField && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <strong>Current Balance:</strong>{' '}
                {Number(selectedAdjEmployee.balances?.[adjField as BalanceField] || 0).toFixed(2)} hours
              </div>
            )}

            <div>
              <Label htmlFor="adj-hours">Hours (+ or -)</Label>
              <Input
                id="adj-hours"
                type="number"
                step="0.5"
                value={adjHours}
                onChange={(e) => setAdjHours(e.target.value)}
                placeholder="-8 or 4"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use negative for deductions, positive for additions
              </p>
            </div>

            <div>
              <Label htmlFor="adj-note">Reason / Note</Label>
              <Textarea
                id="adj-note"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Unpaid leave taken in March..."
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={recordAdjustment.isPending}>
              {recordAdjustment.isPending ? 'Recording...' : 'Record Adjustment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}