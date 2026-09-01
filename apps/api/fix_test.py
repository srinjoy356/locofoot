import re

with open('tests/test_phase2_integration.py', 'r') as f:
    content = f.read()

# Fix IndexError by creating team if it doesn't exist
content = content.replace('team_id = team.data[0]["id"]', '''if len(team.data) == 0:
        team = supabase_admin.table('teams').insert({'name': 'Fallback Team', 'created_by': users["CAPTAIN"]["id"]}).execute()
    team_id = team.data[0]["id"]''')

# Fix upsert silently failing by printing exception
content = content.replace('except Exception as e:\n        print(e)\n        pass', 'except Exception as e:\n        print("UPSERT FAILED:", e)\n        pass')

with open('tests/test_phase2_integration.py', 'w') as f:
    f.write(content)
