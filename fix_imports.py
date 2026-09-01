import re
f = 'apps/web/src/app/(main)/admin/events/[eventId]/page.tsx'
s = open(f).read()
s = s.replace(
    'import { useRouter }\nimport { Users, UserPlus } from \'lucide-react\' from "next/navigation";',
    'import { useRouter } from "next/navigation";\nimport { Users, UserPlus } from "lucide-react";'
)
open(f, 'w').write(s)
