import SessionForm from '@/components/SessionForm';
import { getAthlete } from '@/lib/queries';
import { todayISO } from '@/lib/training';

export const dynamic = 'force-dynamic';

export default function NewSessionPage() {
  const athlete = getAthlete();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Log a session</h1>
          <p>Everything except the date is optional — log what you have.</p>
        </div>
      </div>
      <SessionForm session={null} unit={athlete.distance_unit} defaultDate={todayISO()} />
    </div>
  );
}
