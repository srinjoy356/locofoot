import re

s = open('apps/api/simulate_match.py').read()
s = s.replace('"username": "Organizer"', 'f"username": "Organizer_{uuid.uuid4().hex[:4]}"'.replace('f"username"', '"username"').replace('"Organizer_', 'f"Organizer_'))
s = s.replace('"username": "Referee"', 'f"username": "Referee_{uuid.uuid4().hex[:4]}"'.replace('f"username"', '"username"').replace('"Referee_', 'f"Referee_'))
open('apps/api/simulate_match.py', 'w').write(s)
