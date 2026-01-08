import { useEmployeesWithBalances } from '@/hooks/usePTO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';

export function BalancesDashboard() {
  const { data: employees, isLoading } = useEmployeesWithBalances();

  const activeEmployees = employees?.filter(e => e.is_active) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            PTO Balances Dashboard
          </CardTitle>
          <CardDescription>
            Current balances for all active employees. Totals are computed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading balances...</p>
          ) : activeEmployees.length === 0 ? (
            <p className="text-muted-foreground">No active employees. Add employees in the Employee Management tab.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="text-right">Sick (Current)</th>
                    <th className="text-right">Sick (Rollover)</th>
                    <th className="text-right bg-accent/50">Sick Total</th>
                    <th className="text-right">Vacation (Current)</th>
                    <th className="text-right">Vacation (Rollover)</th>
                    <th className="text-right bg-accent/50">Vacation Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map((emp) => {
                    const b = emp.balances;
                    const sickCurrent = Number(b?.sick_current || 0);
                    const sickRollover = Number(b?.sick_rollover || 0);
                    const vacCurrent = Number(b?.vac_current || 0);
                    const vacRollover = Number(b?.vac_rollover || 0);
                    const sickTotal = sickCurrent + sickRollover;
                    const vacTotal = vacCurrent + vacRollover;

                    return (
                      <tr key={emp.id}>
                        <td className="font-medium">
                          {emp.full_name}
                          <span className="text-muted-foreground text-xs ml-2">
                            ({emp.id.slice(0, 8)})
                          </span>
                        </td>
                        <td className="data-table-numeric">{sickCurrent.toFixed(2)}</td>
                        <td className="data-table-numeric">{sickRollover.toFixed(2)}</td>
                        <td className="data-table-numeric bg-accent/30 font-semibold">{sickTotal.toFixed(2)}</td>
                        <td className="data-table-numeric">{vacCurrent.toFixed(2)}</td>
                        <td className="data-table-numeric">{vacRollover.toFixed(2)}</td>
                        <td className="data-table-numeric bg-accent/30 font-semibold">{vacTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="font-semibold">Company Total</td>
                    <td className="data-table-numeric font-semibold">
                      {activeEmployees.reduce((sum, e) => sum + Number(e.balances?.sick_current || 0), 0).toFixed(2)}
                    </td>
                    <td className="data-table-numeric font-semibold">
                      {activeEmployees.reduce((sum, e) => sum + Number(e.balances?.sick_rollover || 0), 0).toFixed(2)}
                    </td>
                    <td className="data-table-numeric font-bold bg-accent/50">
                      {activeEmployees.reduce((sum, e) => 
                        sum + Number(e.balances?.sick_current || 0) + Number(e.balances?.sick_rollover || 0), 0
                      ).toFixed(2)}
                    </td>
                    <td className="data-table-numeric font-semibold">
                      {activeEmployees.reduce((sum, e) => sum + Number(e.balances?.vac_current || 0), 0).toFixed(2)}
                    </td>
                    <td className="data-table-numeric font-semibold">
                      {activeEmployees.reduce((sum, e) => sum + Number(e.balances?.vac_rollover || 0), 0).toFixed(2)}
                    </td>
                    <td className="data-table-numeric font-bold bg-accent/50">
                      {activeEmployees.reduce((sum, e) => 
                        sum + Number(e.balances?.vac_current || 0) + Number(e.balances?.vac_rollover || 0), 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Active Employees"
          value={activeEmployees.length.toString()}
          description="Currently on payroll"
        />
        <SummaryCard
          title="Total Sick Hours"
          value={activeEmployees.reduce((sum, e) => 
            sum + Number(e.balances?.sick_current || 0) + Number(e.balances?.sick_rollover || 0), 0
          ).toFixed(1)}
          description="Current + Rollover"
        />
        <SummaryCard
          title="Total Vacation Hours"
          value={activeEmployees.reduce((sum, e) => 
            sum + Number(e.balances?.vac_current || 0) + Number(e.balances?.vac_rollover || 0), 0
          ).toFixed(1)}
          description="Current + Rollover"
        />
        <SummaryCard
          title="Total PTO Liability"
          value={activeEmployees.reduce((sum, e) => {
            const b = e.balances;
            return sum + Number(b?.sick_current || 0) + Number(b?.sick_rollover || 0) 
              + Number(b?.vac_current || 0) + Number(b?.vac_rollover || 0);
          }, 0).toFixed(1)}
          description="All hours owed"
        />
      </div>
    </div>
  );
}

function SummaryCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}