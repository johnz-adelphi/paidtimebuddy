-- Add columns to system_state for tracking who ran accruals/rollovers
ALTER TABLE public.system_state 
ADD COLUMN IF NOT EXISTS run_by_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 1;

-- Update run_monthly_accrual to accept force parameter and track user
CREATE OR REPLACE FUNCTION public.run_monthly_accrual(_force boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month text;
  last_month text;
  last_run_time timestamp with time zone;
  last_run_user_id uuid;
  last_run_user_email text;
  last_run_count integer;
  accrual_count integer := 0;
  emp record;
  current_user_id uuid;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can run accruals';
  END IF;

  current_user_id := auth.uid();
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get last accrual info
  SELECT value, updated_at, run_by_user_id, COALESCE(run_count, 1) 
  INTO last_month, last_run_time, last_run_user_id, last_run_count
  FROM public.system_state WHERE key = 'last_accrual_month';
  
  -- Check if already run this month
  IF last_month = current_month AND NOT _force THEN
    -- Get user email for the warning
    SELECT email INTO last_run_user_email FROM public.profiles WHERE id = last_run_user_id;
    RETURN json_build_object(
      'success', false, 
      'already_run', true,
      'message', 'Accrual already run for ' || current_month, 
      'last_run_at', last_run_time,
      'last_run_by', COALESCE(last_run_user_email, 'Unknown'),
      'run_count', last_run_count,
      'count', 0
    );
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
            'Monthly sick accrual for ' || current_month || ': +3.33 hours' || 
            CASE WHEN _force THEN ' (force run #' || (COALESCE(last_run_count, 0) + 1)::text || ')' ELSE '' END);

    -- Add vacation hours (3.33 per month = 40/12)
    UPDATE public.employee_balances 
    SET vac_current = vac_current + 3.33, updated_at = now()
    WHERE employee_id = emp.id;
    
    -- Log vacation accrual
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (emp.id, 'MONTHLY_ACCRUAL', 'ACCRUAL', 'vac_current', 3.33, 
            'Monthly vacation accrual for ' || current_month || ': +3.33 hours' ||
            CASE WHEN _force THEN ' (force run #' || (COALESCE(last_run_count, 0) + 1)::text || ')' ELSE '' END);

    accrual_count := accrual_count + 1;
  END LOOP;

  -- Update system state
  INSERT INTO public.system_state (key, value, updated_at, run_by_user_id, run_count)
  VALUES ('last_accrual_month', current_month, now(), current_user_id, 1)
  ON CONFLICT (key) DO UPDATE SET 
    value = current_month, 
    updated_at = now(), 
    run_by_user_id = current_user_id,
    run_count = CASE 
      WHEN public.system_state.value = current_month THEN COALESCE(public.system_state.run_count, 1) + 1 
      ELSE 1 
    END;

  RETURN json_build_object(
    'success', true, 
    'already_run', false,
    'message', 'Accrual completed for ' || current_month || CASE WHEN _force THEN ' (force run)' ELSE '' END, 
    'count', accrual_count
  );
END;
$$;

-- Update run_year_end_rollover to accept force parameter and track user
CREATE OR REPLACE FUNCTION public.run_year_end_rollover(_force boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  last_year text;
  last_run_time timestamp with time zone;
  last_run_user_id uuid;
  last_run_user_email text;
  last_run_count integer;
  rollover_count integer := 0;
  emp record;
  bal record;
  current_user_id uuid;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can run rollovers';
  END IF;

  current_user_id := auth.uid();
  current_year := to_char(now(), 'YYYY');
  
  -- Get last rollover info
  SELECT value, updated_at, run_by_user_id, COALESCE(run_count, 1)
  INTO last_year, last_run_time, last_run_user_id, last_run_count
  FROM public.system_state WHERE key = 'last_rollover_year';
  
  -- Check if already run this year
  IF last_year = current_year AND NOT _force THEN
    -- Get user email for the warning
    SELECT email INTO last_run_user_email FROM public.profiles WHERE id = last_run_user_id;
    RETURN json_build_object(
      'success', false, 
      'already_run', true,
      'message', 'Rollover already run for ' || current_year, 
      'last_run_at', last_run_time,
      'last_run_by', COALESCE(last_run_user_email, 'Unknown'),
      'run_count', last_run_count,
      'count', 0
    );
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
              'Year-end rollover for ' || current_year || ': balances reset, rollover updated (capped at 40 hours)' ||
              CASE WHEN _force THEN ' (force run #' || (COALESCE(last_run_count, 0) + 1)::text || ')' ELSE '' END);

      rollover_count := rollover_count + 1;
    END IF;
  END LOOP;

  -- Update system state
  INSERT INTO public.system_state (key, value, updated_at, run_by_user_id, run_count)
  VALUES ('last_rollover_year', current_year, now(), current_user_id, 1)
  ON CONFLICT (key) DO UPDATE SET 
    value = current_year, 
    updated_at = now(), 
    run_by_user_id = current_user_id,
    run_count = CASE 
      WHEN public.system_state.value = current_year THEN COALESCE(public.system_state.run_count, 1) + 1 
      ELSE 1 
    END;

  RETURN json_build_object(
    'success', true, 
    'already_run', false,
    'message', 'Rollover completed for ' || current_year || CASE WHEN _force THEN ' (force run)' ELSE '' END, 
    'count', rollover_count
  );
END;
$$;

-- Create mass adjustment function
CREATE OR REPLACE FUNCTION public.mass_adjust_balances(
  _employee_ids uuid[],
  _balance_field text,
  _adjustment_type text,
  _amount numeric,
  _reason text,
  _effective_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  emp_id uuid;
  emp_name text;
  current_value numeric;
  new_value numeric;
  adjusted_count integer := 0;
  current_user_id uuid;
BEGIN
  -- Check authorization
  IF NOT public.is_hr_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only HR admins can make mass adjustments';
  END IF;

  -- Validate balance field
  IF _balance_field NOT IN ('sick_current', 'sick_rollover', 'vac_current', 'vac_rollover') THEN
    RAISE EXCEPTION 'Invalid balance field: %', _balance_field;
  END IF;

  -- Validate adjustment type
  IF _adjustment_type NOT IN ('add', 'subtract', 'set') THEN
    RAISE EXCEPTION 'Invalid adjustment type: %', _adjustment_type;
  END IF;

  current_user_id := auth.uid();

  FOREACH emp_id IN ARRAY _employee_ids
  LOOP
    -- Get employee name and current balance
    SELECT e.full_name INTO emp_name FROM public.employees e WHERE e.id = emp_id;
    
    IF emp_name IS NULL THEN
      CONTINUE;
    END IF;

    -- Get current value using dynamic SQL
    EXECUTE format('SELECT %I FROM public.employee_balances WHERE employee_id = $1', _balance_field)
    INTO current_value
    USING emp_id;

    IF current_value IS NULL THEN
      current_value := 0;
    END IF;

    -- Calculate new value
    CASE _adjustment_type
      WHEN 'add' THEN new_value := current_value + _amount;
      WHEN 'subtract' THEN new_value := GREATEST(current_value - _amount, 0);
      WHEN 'set' THEN new_value := _amount;
    END CASE;

    -- Update balance
    EXECUTE format('UPDATE public.employee_balances SET %I = $1, updated_at = now() WHERE employee_id = $2', _balance_field)
    USING new_value, emp_id;

    -- Log the adjustment
    INSERT INTO public.audit_log (employee_id, action_type, category, balance_field, hours, note)
    VALUES (
      emp_id, 
      'MASS_ADJUSTMENT', 
      'ADJUSTMENT', 
      _balance_field, 
      CASE _adjustment_type
        WHEN 'add' THEN _amount
        WHEN 'subtract' THEN -_amount
        WHEN 'set' THEN new_value - current_value
      END,
      'Mass adjustment for "' || emp_name || '": ' || 
      CASE _adjustment_type
        WHEN 'add' THEN 'Added ' || _amount || ' hours'
        WHEN 'subtract' THEN 'Subtracted ' || _amount || ' hours'
        WHEN 'set' THEN 'Set to ' || _amount || ' hours (was ' || current_value || ')'
      END ||
      ' to ' || _balance_field || '. Reason: ' || _reason || '. Effective: ' || _effective_date::text
    );

    adjusted_count := adjusted_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully adjusted ' || adjusted_count || ' employee(s)',
    'count', adjusted_count
  );
END;
$$;