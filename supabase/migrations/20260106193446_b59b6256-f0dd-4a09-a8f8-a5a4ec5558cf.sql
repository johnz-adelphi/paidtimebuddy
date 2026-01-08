-- Create profiles table for tracking users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "HR admins can read all profiles"
ON public.profiles
FOR SELECT
USING (public.is_hr_admin());

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to clear PTO balances for an employee
CREATE OR REPLACE FUNCTION public.clear_pto_balance(
  _employee_id uuid,
  _balance_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  emp_name text;
  old_current numeric;
  old_rollover numeric;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can clear balances';
  END IF;

  -- Get employee name
  SELECT full_name INTO emp_name FROM public.employees WHERE id = _employee_id;
  IF emp_name IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Employee not found');
  END IF;

  -- Get old values and update
  IF _balance_type = 'sick' THEN
    SELECT sick_current, sick_rollover INTO old_current, old_rollover
    FROM public.employee_balances WHERE employee_id = _employee_id;
    
    UPDATE public.employee_balances 
    SET sick_current = 0, sick_rollover = 0, updated_at = now()
    WHERE employee_id = _employee_id;
    
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (_employee_id, 'BALANCE_CLEARED', 'ADJUSTMENT', 'sick_current', -(old_current + old_rollover),
            'Cleared sick balance for "' || emp_name || '": -' || (old_current + old_rollover)::text || ' hours');
            
  ELSIF _balance_type = 'vacation' THEN
    SELECT vac_current, vac_rollover INTO old_current, old_rollover
    FROM public.employee_balances WHERE employee_id = _employee_id;
    
    UPDATE public.employee_balances 
    SET vac_current = 0, vac_rollover = 0, updated_at = now()
    WHERE employee_id = _employee_id;
    
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (_employee_id, 'BALANCE_CLEARED', 'ADJUSTMENT', 'vac_current', -(old_current + old_rollover),
            'Cleared vacation balance for "' || emp_name || '": -' || (old_current + old_rollover)::text || ' hours');
            
  ELSIF _balance_type = 'all' THEN
    SELECT sick_current, sick_rollover INTO old_current, old_rollover
    FROM public.employee_balances WHERE employee_id = _employee_id;
    
    UPDATE public.employee_balances 
    SET sick_current = 0, sick_rollover = 0, vac_current = 0, vac_rollover = 0, updated_at = now()
    WHERE employee_id = _employee_id;
    
    INSERT INTO public.audit_log (employee_id, action_type, category, note)
    VALUES (_employee_id, 'BALANCE_CLEARED', 'ADJUSTMENT',
            'Cleared all PTO balances for "' || emp_name || '"');
  ELSE
    RETURN json_build_object('success', false, 'message', 'Invalid balance type');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Balance cleared successfully');
END;
$$;