import { notFound } from 'next/navigation';
import SessionForm from '@/components/SessionForm';
import { getAthlete, getSession } from '@/lib/queries';
import { todayISO } from '@/lib/training';

export const dynamic = 'force-dynamic';

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(Number(id));
  if (!session) notFound();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Edit session</h1>
          <p>{session.title ?? session.date}</p>
        </div>
      </div>
      <SessionForm
        session={session}
        unit={getAthlete().distance_unit}
        defaultDate={todayISO()}
      />
    </div>
  );
}
