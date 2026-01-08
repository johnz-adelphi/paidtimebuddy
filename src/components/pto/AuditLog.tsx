import { useAuditLog } from '@/hooks/usePTO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileText, Download, Search } from 'lucide-react';
import { useState, useMemo } from 'react';

export function AuditLog() {
  const { data: auditLog, isLoading } = useAuditLog();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLog = useMemo(() => {
    if (!auditLog) return [];
    if (!searchTerm.trim()) return auditLog;
    
    const term = searchTerm.toLowerCase();
    return auditLog.filter(entry => 
      entry.employee_name?.toLowerCase().includes(term) ||
      entry.action_type.toLowerCase().includes(term) ||
      entry.category.toLowerCase().includes(term) ||
      entry.note.toLowerCase().includes(term)
    );
  }, [auditLog, searchTerm]);

  const handleExportCSV = () => {
    if (!filteredLog.length) return;

    const headers = ['Timestamp (UTC)', 'Employee', 'Action Type', 'Category', 'Balance Field', 'Hours', 'Note'];
    const rows = filteredLog.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.employee_name || 'N/A',
      entry.action_type,
      entry.category,
      entry.balance_field || '',
      entry.hours?.toString() || '',
      `"${entry.note.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `pto-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'EMPLOYEE': return 'bg-blue-100 text-blue-800';
      case 'USAGE': return 'bg-red-100 text-red-800';
      case 'ACCRUAL': return 'bg-green-100 text-green-800';
      case 'ADJUSTMENT': return 'bg-yellow-100 text-yellow-800';
      case 'ROLLOVER': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log
              </CardTitle>
              <CardDescription>
                Immutable record of all PTO system actions. Showing last 500 entries.
              </CardDescription>
            </div>
            <Button onClick={handleExportCSV} disabled={!filteredLog.length} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee, action, category, or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading audit log...</p>
          ) : filteredLog.length === 0 ? (
            <p className="text-muted-foreground">
              {searchTerm ? 'No matching entries found.' : 'No audit log entries yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Employee</th>
                    <th>Action</th>
                    <th>Category</th>
                    <th>Balance Field</th>
                    <th className="text-right">Hours</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-xs whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="font-medium">{entry.employee_name}</td>
                      <td className="text-xs font-mono">{entry.action_type}</td>
                      <td>
                        <span className={`status-badge ${getCategoryBadgeClass(entry.category)}`}>
                          {entry.category}
                        </span>
                      </td>
                      <td className="text-xs">{entry.balance_field || '-'}</td>
                      <td className="data-table-numeric">
                        {entry.hours !== null ? (
                          <span className={entry.hours >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {entry.hours >= 0 ? '+' : ''}{entry.hours.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-sm max-w-xs truncate" title={entry.note}>
                        {entry.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredLog.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              Showing {filteredLog.length} of {auditLog?.length || 0} entries
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}