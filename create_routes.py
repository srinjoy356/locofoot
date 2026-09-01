import os

routes = [
    'admin/events',
    'admin/events/[eventId]',
    'admin/events/[eventId]/registrations',
    'admin/events/[eventId]/settings',
    'teams',
    'teams/[teamId]',
    'teams/[teamId]/roster',
    'teams/[teamId]/invitations',
    'teams/[teamId]/register/[eventId]',
    'events',
    'events/[slug]',
    'events/[slug]/overview',
    'events/[slug]/teams'
]

base_dir = r'C:\dev\locofoot\apps\web\src\app\(main)'

for r in routes:
    path = os.path.join(base_dir, r.replace('/', '\\'))
    os.makedirs(path, exist_ok=True)
    with open(os.path.join(path, 'page.tsx'), 'w') as f:
        f.write(f'export default function Page() {{\n  return (\n    <div className="p-8 max-w-4xl mx-auto">\n      <h1 className="text-2xl font-bold mb-6">{r}</h1>\n      <p>This is a Phase 2 placeholder page.</p>\n    </div>\n  );\n}}\n')
print('Created routes!')
