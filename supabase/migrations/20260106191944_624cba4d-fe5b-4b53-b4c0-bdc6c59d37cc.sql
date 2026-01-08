-- 1. Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('hr_admin', 'hr_user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. Create function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 4. Create function to check if user is HR admin
CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'hr_admin')
$$;

-- 5. Drop existing public access policies
DROP POLICY IF EXISTS "Allow all access to employees" ON public.employees;
DROP POLICY IF EXISTS "Allow all access to employee_balances" ON public.employee_balances;
DROP POLICY IF EXISTS "Allow all access to audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Allow all access to system_state" ON public.system_state;

-- 6. Create proper RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "HR admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- 7. Create proper RLS policies for employees table
CREATE POLICY "Authenticated users can read employees"
  ON public.employees FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "HR admins can insert employees"
  ON public.employees FOR INSERT
  WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can update employees"
  ON public.employees FOR UPDATE
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can delete employees"
  ON public.employees FOR DELETE
  USING (public.is_hr_admin());

-- 8. Create proper RLS policies for employee_balances table
CREATE POLICY "Authenticated users can read balances"
  ON public.employee_balances FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "HR admins can insert balances"
  ON public.employee_balances FOR INSERT
  WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can update balances"
  ON public.employee_balances FOR UPDATE
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can delete balances"
  ON public.employee_balances FOR DELETE
  USING (public.is_hr_admin());

-- 9. Create proper RLS policies for audit_log table
CREATE POLICY "HR admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (public.is_hr_admin());

CREATE POLICY "HR admins can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (public.is_hr_admin());

-- No update or delete policies - audit log is immutable

-- 10. Create proper RLS policies for system_state table
CREATE POLICY "Authenticated users can read system state"
  ON public.system_state FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "HR admins can insert system state"
  ON public.system_state FOR INSERT
  WITH CHECK (public.is_hr_admin());

CREATE POLICY "HR admins can update system state"
  ON public.system_state FOR UPDATE
  USING (public.is_hr_admin())
  WITH CHECK (public.is_hr_admin());

-- 11. Create server-side function for monthly accrual (with authorization)
CREATE OR REPLACE FUNCTION public.run_monthly_accrual()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month text;
  last_month text;
  accrual_count integer := 0;
  emp record;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can run accruals';
  END IF;

  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get last accrual month
  SELECT value INTO last_month FROM public.system_state WHERE key = 'last_accrual_month';
  
  -- Check if already run this month
  IF last_month = current_month THEN
    RETURN json_build_object('success', false, 'message', 'Accrual already run for ' || current_month, 'count', 0);
  END IF;

  -- Process accruals for all active employees
  FOR emp IN SELECT e.id, e.full_name FROM public.employees e WHERE e.is_active = true
  LOOP
    -- Add sick hours (3.33 per month = 40/12)
    UPDATE public.employee_balances 
    SET sick_current = sick_current + 3.33, updated_at = now()
    WHERE employee_id = emp.id;
    
    -- Log sick accrual
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (emp.id, 'MONTHLY_ACCRUAL', 'ACCRUAL', 'sick_current', 3.33, 
            'Monthly sick accrual for ' || current_month || ': +3.33 hours');

    -- Add vacation hours (3.33 per month = 40/12)
    UPDATE public.employee_balances 
    SET vac_current = vac_current + 3.33, updated_at = now()
    WHERE employee_id = emp.id;
    
    -- Log vacation accrual
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (emp.id, 'MONTHLY_ACCRUAL', 'ACCRUAL', 'vac_current', 3.33, 
            'Monthly vacation accrual for ' || current_month || ': +3.33 hours');

    accrual_count := accrual_count + 1;
  END LOOP;

  -- Update system state
  INSERT INTO public.system_state (key, value, updated_at)
  VALUES ('last_accrual_month', current_month, now())
  ON CONFLICT (key) DO UPDATE SET value = current_month, updated_at = now();

  RETURN json_build_object('success', true, 'message', 'Accrual completed for ' || current_month, 'count', accrual_count);
END;
$$;

-- 12. Create server-side function for year-end rollover (with authorization)
CREATE OR REPLACE FUNCTION public.run_year_end_rollover()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  last_year text;
  rollover_count integer := 0;
  emp record;
  bal record;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can run rollovers';
  END IF;

  current_year := to_char(now(), 'YYYY');
  
  -- Get last rollover year
  SELECT value INTO last_year FROM public.system_state WHERE key = 'last_rollover_year';
  
  -- Check if already run this year
  IF last_year = current_year THEN
    RETURN json_build_object('success', false, 'message', 'Rollover already run for ' || current_year, 'count', 0);
  END IF;

  -- Process rollovers for all active employees
  FOR emp IN SELECT e.id, e.full_name FROM public.employees e WHERE e.is_active = true
  LOOP
    SELECT * INTO bal FROM public.employee_balances WHERE employee_id = emp.id;
    
    IF bal IS NOT NULL THEN
      -- Transfer current to rollover (capped at 40 hours each)
      UPDATE public.employee_balances 
      SET 
        sick_rollover = LEAST(bal.sick_current + bal.sick_rollover, 40),
        vac_rollover = LEAST(bal.vac_current + bal.vac_rollover, 40),
        sick_current = 0,
        vac_current = 0,
        updated_at = now()
      WHERE employee_id = emp.id;
      
      -- Log rollover
      INSERT INTO public.audit_log (employee_id, action_type, category, note)
      VALUES (emp.id, 'YEAR_END_ROLLOVER', 'ROLLOVER', 
              'Year-end rollover for ' || current_year || ': balances reset, rollover updated (capped at 40 hours)');

      rollover_count := rollover_count + 1;
    END IF;
  END LOOP;

  -- Update system state
  INSERT INTO public.system_state (key, value, updated_at)
  VALUES ('last_rollover_year', current_year, now())
  ON CONFLICT (key) DO UPDATE SET value = current_year, updated_at = now();

  RETURN json_build_object('success', true, 'message', 'Rollover completed for ' || current_year, 'count', rollover_count);
END;
$$;

-- 13. Add unique constraint on system_state key for upsert operations
ALTER TABLE public.system_state ADD CONSTRAINT system_state_key_unique UNIQUE (key);