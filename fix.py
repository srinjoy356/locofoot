s = open('supabase/migrations/0025_phase4_referee_engine.sql').read()
s = s.replace('ADD COLUMN home_score INT NOT NULL DEFAULT 0,', '')
s = s.replace('ADD COLUMN away_score INT NOT NULL DEFAULT 0,', '')
s = s.replace('ADD COLUMN home_penalties INT,', '')
s = s.replace('ADD COLUMN away_penalties INT;', '')
s = s.replace("match_state public.match_state NOT NULL DEFAULT 'SCHEDULED',", "match_state public.match_state NOT NULL DEFAULT 'SCHEDULED';")
# also fix if the comma was left at the end but the semicolon was removed
s = s.replace("match_state public.match_state NOT NULL DEFAULT 'SCHEDULED'\n", "match_state public.match_state NOT NULL DEFAULT 'SCHEDULED';\n")
open('supabase/migrations/0025_phase4_referee_engine.sql', 'w').write(s)
