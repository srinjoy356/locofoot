import os
import glob

bad_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM'

for filepath in glob.glob('apps/api/**/*.py', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if bad_key in content:
        print(f'Fixing {filepath}...')
        content = content.replace(f'"{bad_key}"', 'os.environ.get("SUPABASE_SERVICE_ROLE_KEY")')
        content = content.replace(f"'{bad_key}'", 'os.environ.get("SUPABASE_SERVICE_ROLE_KEY")')
        
        if 'import os' not in content:
            content = 'import os\n' + content
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
print('Done!')
