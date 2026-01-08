import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, Shield, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'hr_admin' | 'hr_user';

interface Profile {
  id: string;
  email: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export function UserRoleManagement() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('hr_user');

  // Fetch all profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch all user roles
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Assign role mutation
  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Check if user already has this role
      const existing = userRoles?.find(r => r.user_id === userId && r.role === role);
      if (existing) {
        throw new Error('User already has this role');
      }
      
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role assigned successfully');
      setSelectedUserId('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove role mutation
  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role removed successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getUserRoles = (userId: string) => {
    return userRoles?.filter(r => r.user_id === userId) || [];
  };

  const usersWithoutRoles = profiles?.filter(p => getUserRoles(p.id).length === 0) || [];

  if (profilesLoading || rolesLoading) {
    return <p className="text-muted-foreground">Loading users...</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            User Role Management
          </CardTitle>
          <CardDescription>
            Assign and manage roles for users who have signed up
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assign Role Form */}
          {usersWithoutRoles.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h3 className="font-medium mb-3">Assign Role to New User</h3>
              <div className="flex gap-3 flex-wrap">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersWithoutRoles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr_user">HR User</SelectItem>
                    <SelectItem value="hr_admin">HR Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (selectedUserId) {
                      assignRole.mutate({ userId: selectedUserId, role: selectedRole });
                    }
                  }}
                  disabled={!selectedUserId || assignRole.isPending}
                >
                  Assign Role
                </Button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles?.map((profile) => {
                  const roles = getUserRoles(profile.id);
                  return (
                    <tr key={profile.id}>
                      <td className="font-medium">{profile.email}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {roles.length === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              No roles
                            </Badge>
                          ) : (
                            roles.map((role) => (
                              <Badge
                                key={role.id}
                                variant={role.role === 'hr_admin' ? 'default' : 'secondary'}
                                className="flex items-center gap-1"
                              >
                                {role.role === 'hr_admin' ? (
                                  <Shield className="h-3 w-3" />
                                ) : (
                                  <User className="h-3 w-3" />
                                )}
                                {role.role === 'hr_admin' ? 'Admin' : 'User'}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          {roles.map((role) => (
                            <Button
                              key={role.id}
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRole.mutate({ userId: profile.id, role: role.role })}
                              disabled={removeRole.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove {role.role === 'hr_admin' ? 'Admin' : 'User'}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {profiles?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No users have signed up yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
