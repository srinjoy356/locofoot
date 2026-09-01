CREATE OR REPLACE FUNCTION public.generate_unique_code()
RETURNS text AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := 'FTB-';
  i integer;
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    result := 'FTB-';
    FOR i IN 1..6 LOOP
      result := result || chars[1+random()*(array_length(chars, 1)-1)];
    END LOOP;
    
    done := NOT EXISTS(SELECT 1 FROM public.users WHERE unique_code = result);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION public.set_user_unique_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := public.generate_unique_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_user_unique_code ON public.users;
CREATE TRIGGER ensure_user_unique_code
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_user_unique_code();

-- Update existing users
UPDATE public.users SET unique_code = public.generate_unique_code() WHERE unique_code IS NULL;

-- Make it NOT NULL for future safety (if all users are updated)
ALTER TABLE public.users ALTER COLUMN unique_code SET NOT NULL;
