import { useState } from 'react';
import { useEmployees, useCreateEmployee, useToggleEmployeeStatus, useDeleteEmployee } from '@/hooks/usePTO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserPlus, Users, UserCheck, UserX, Trash2 } from 'lucide-react';

export function EmployeeManagement() {
  const { data: employees, isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const toggleStatus = useToggleEmployeeStatus();
  const deleteEmployee = useDeleteEmployee();
  
  const [newName, setNewName] = useState('');
  const [hireDate, setHireDate] = useState('');

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !hireDate) return;
    
    createEmployee.mutate(
      { full_name: newName.trim(), hire_date: hireDate },
      {
        onSuccess: () => {
          setNewName('');
          setHireDate('');
        },
      }
    );
  };

  const activeEmployees = employees?.filter(e => e.is_active) || [];
  const inactiveEmployees = employees?.filter(e => !e.is_active) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Add Employee Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Employee
          </CardTitle>
          <CardDescription>
            Add a new employee to the PTO system. Balances will be initialized at zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEmployee} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="w-[180px]">
              <Label htmlFor="hire_date">Hire Date</Label>
              <Input
                id="hire_date"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Adding...' : 'Add Employee'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Employee Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Employees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-success" />
              Active Employees ({activeEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : activeEmployees.length === 0 ? (
              <p className="text-muted-foreground">No active employees</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Hire Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td className="font-medium">{emp.full_name}</td>
                        <td>{new Date(emp.hire_date).toLocaleDateString()}</td>
                        <td>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus.mutate({ 
                              id: emp.id, 
                              is_active: false,
                              full_name: emp.full_name 
                            })}
                            disabled={toggleStatus.isPending}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Employees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-5 w-5" />
              Inactive Employees ({inactiveEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : inactiveEmployees.length === 0 ? (
              <p className="text-muted-foreground">No inactive employees</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Hire Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td className="font-medium text-muted-foreground">{emp.full_name}</td>
                        <td className="text-muted-foreground">{new Date(emp.hire_date).toLocaleDateString()}</td>
                        <td>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus.mutate({ 
                                id: emp.id, 
                                is_active: true,
                                full_name: emp.full_name 
                              })}
                              disabled={toggleStatus.isPending}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Reactivate
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={deleteEmployee.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Employee Permanently?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete <strong>{emp.full_name}</strong> and all their PTO balances. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteEmployee.mutate({ id: emp.id, full_name: emp.full_name })}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Permanently
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}