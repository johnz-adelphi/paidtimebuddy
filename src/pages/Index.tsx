import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmployeeManagement } from '@/components/pto/EmployeeManagement';
import { BalancesDashboard } from '@/components/pto/BalancesDashboard';
import { PTOUsageAdjustments } from '@/components/pto/PTOUsageAdjustments';
import { AccrualRollover } from '@/components/pto/AccrualRollover';
import { AuditLog } from '@/components/pto/AuditLog';
import { UserRoleManagement } from '@/components/pto/UserRoleManagement';
import { ClearPTOBalance } from '@/components/pto/ClearPTOBalance';
import { MassAdjustment } from '@/components/pto/MassAdjustment';
import { useAuth } from '@/hooks/useAuth';
import { Users, LayoutGrid, Clock, CalendarDays, FileText, LogOut, Shield, UserCog, Eraser, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, isHrAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">PTO Manager</h1>
                <p className="text-sm text-muted-foreground">Employee Leave Tracking System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isHrAdmin && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  HR Admin
                </Badge>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {!isHrAdmin ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              You need HR admin privileges to access the PTO management features. 
              Please contact your system administrator to request access.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="employees" className="space-y-6">
            <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid">
              <TabsTrigger value="employees" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Employees</span>
              </TabsTrigger>
              <TabsTrigger value="balances" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Balances</span>
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Usage</span>
              </TabsTrigger>
              <TabsTrigger value="mass" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Mass Adjust</span>
              </TabsTrigger>
              <TabsTrigger value="clear" className="flex items-center gap-2">
                <Eraser className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </TabsTrigger>
              <TabsTrigger value="accrual" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Accrual</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Audit</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employees">
              <EmployeeManagement />
            </TabsContent>

            <TabsContent value="balances">
              <BalancesDashboard />
            </TabsContent>

            <TabsContent value="usage">
              <PTOUsageAdjustments />
            </TabsContent>

            <TabsContent value="mass">
              <MassAdjustment />
            </TabsContent>

            <TabsContent value="clear">
              <ClearPTOBalance />
            </TabsContent>

            <TabsContent value="accrual">
              <AccrualRollover />
            </TabsContent>

            <TabsContent value="users">
              <UserRoleManagement />
            </TabsContent>

            <TabsContent value="audit">
              <AuditLog />
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="container text-center text-xs text-muted-foreground">
          PTO Manager • Cloud-Hosted Leave Management System
        </div>
      </footer>
    </div>
  );
};

export default Index;
