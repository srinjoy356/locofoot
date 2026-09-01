import glob
import os
for f in glob.glob('C:/dev/locofoot/supabase/migrations/*_leaderboard*.sql'):
    with open(f, 'r', encoding='utf-8') as file:
        for line in file:
            if 'WHEN p_metric =' in line:
                print(line.strip())
