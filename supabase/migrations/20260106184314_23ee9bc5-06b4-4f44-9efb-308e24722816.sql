-- Create employees table
CREATE TABLE public.employees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    hire_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee balances table
CREATE TABLE public.employee_balances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    sick_current NUMERIC(10,2) NOT NULL DEFAULT 0,
    sick_rollover NUMERIC(10,2) NOT NULL DEFAULT 0,
    vac_current NUMERIC(10,2) NOT NULL DEFAULT 0,
    vac_rollover NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(employee_id)
);

-- Create audit log table (immutable)
CREATE TABLE public.audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    category TEXT NOT NULL,
    balance_field TEXT,
    hours NUMERIC(10,2),
    note TEXT NOT NULL
);

-- Create system state table for tracking grants/rollovers
CREATE TABLE public.system_state (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for internal company app, no auth required)
CREATE POLICY "Allow all access to employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to employee_balances" ON public.employee_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to system_state" ON public.system_state FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for employee_balances
CREATE TRIGGER update_employee_balances_updated_at
    BEFORE UPDATE ON public.employee_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for system_state
CREATE TRIGGER update_system_state_updated_at
    BEFORE UPDATE ON public.system_state
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create balance record on employee insert
CREATE OR REPLACE FUNCTION public.create_employee_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.employee_balances (employee_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-create balances
CREATE TRIGGER on_employee_created
    AFTER INSERT ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.create_employee_balance();