import { useState } from 'react';

export type GateValues = { agree_winner: 'agree' | 'disagree' | 'unsure'; grade?: string; note?: string };

export function FeedbackGate(props: {
  onSubmit: (v: GateValues) => void; onSkip: () => void; submitting: boolean;
}) {
  const [agree, setAgree] = useState<GateValues['agree_winner'] | null>(null);
  const [grade, setGrade] = useState('');
  const [note, setNote] = useState('');
  const grades = ['A', 'B', 'C', 'D', 'F'];
  return (
    <div className='mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3'>
      <div className='text-xs font-semibold text-amber-200'>Rate this analysis to run another</div>
      <div className='mt-2 flex gap-2'>
        {(['agree', 'disagree', 'unsure'] as const).map((a) => (
          <button key={a} type='button' onClick={() => setAgree(a)}
            className={`rounded px-2 py-1 text-xs ${agree === a ? 'bg-amber-400/30 text-white' : 'bg-white/5 text-gray-300'}`}>
            {a === 'agree' ? 'Agree w/ winner' : a === 'disagree' ? 'Disagree' : 'Unsure'}
          </button>
        ))}
      </div>
      <div className='mt-2 flex items-center gap-2'>
        <span className='text-xs text-gray-400'>Your grade:</span>
        {grades.map((g) => (
          <button key={g} type='button' onClick={() => setGrade(g)}
            className={`rounded px-2 py-1 text-xs ${grade === g ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-300'}`}>{g}</button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder='Optional note'
        className='mt-2 w-full rounded bg-white/5 p-2 text-xs text-gray-200' rows={2} />
      <div className='mt-2 flex gap-2'>
        <button type='button' disabled={!agree || props.submitting}
          onClick={() => agree && props.onSubmit({ agree_winner: agree, grade: grade || undefined, note: note || undefined })}
          className='rounded bg-amber-500/80 px-3 py-1 text-xs font-semibold text-black disabled:opacity-40'>Submit</button>
        <button type='button' disabled={props.submitting} onClick={props.onSkip}
          className='rounded bg-white/10 px-3 py-1 text-xs text-gray-300'>Skip</button>
      </div>
    </div>
  );
}
