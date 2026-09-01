from app.core.database import SessionLocal
from app.models.events import EventTeamRegistration
db = SessionLocal()
count = db.query(EventTeamRegistration).count()
print(f"Total registrations: {count}")
count_accepted = db.query(EventTeamRegistration).filter(EventTeamRegistration.status == 'ACCEPTED').count()
print(f"Accepted registrations: {count_accepted}")
