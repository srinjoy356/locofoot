s = open('apps/web/src/app/(main)/admin/events/[eventId]/page.tsx').read()

old_code = """{event.status === 'REGISTRATION_OPEN' && (
            <button onClick={() => updateStatus('REGISTRATION_CLOSED')} className="bg-red-600 text-white px-4 py-2 rounded">
              Close Registration
            </button>
          )}"""

new_code = """{event.status === 'REGISTRATION_OPEN' && (
            <button onClick={() => updateStatus('REGISTRATION_CLOSED')} className="bg-red-600 text-white px-4 py-2 rounded">
              Close Registration
            </button>
          )}
          {(event.status === 'REGISTRATION_CLOSED' || event.status === 'SCHEDULED' || event.status === 'SCHEDULING') && (
            <button onClick={() => updateStatus('LIVE')} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded shadow-lg">
              Launch Tournament (Go Live)
            </button>
          )}
          {event.status === 'LIVE' && (
            <button onClick={() => updateStatus('COMPLETED')} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded shadow-lg">
              End Tournament (Finalize)
            </button>
          )}"""

s = s.replace(old_code, new_code)
open('apps/web/src/app/(main)/admin/events/[eventId]/page.tsx', 'w').write(s)
