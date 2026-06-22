import { useState } from 'react';

export type GateValues = { agree_winner: 'agree' | 'disagree' | 'unsure'; grade?: string; note?: string };

/** Submit is allowed once the (required) winner-agreement is picked and no submit is in flight. */
export function canSubmitFeedback(
  agree: GateValues['agree_winner'] | null,
  submitting: boolean,
): boolean {
  return agree != null && !submitting;
}

export function FeedbackGate(props: {
  onSubmit: (v: GateValues) => void;
  onRunAnother: () => void;
  submitting: boolean;
  done: boolean;
}) {
  const [agree, setAgree] = useState<GateValues['agree_winner'] | null>(null);
  const [grade, setGrade] = useState('');
  const [note, setNote] = useState('');
  const grades = ['A', 'B', 'C', 'D', 'F'];
  const canSubmit = canSubmitFeedback(agree, props.submitting);

  return (
    <div className='rounded-lg border border-amber-400/30 bg-amber-400/5 p-3'>
      <div className='text-xs font-semibold text-amber-200'>How did this analysis do?</div>

      {props.done ? (
        <div className='mt-1 text-xs text-emerald-300'>✓ Thanks — your feedback was saved.</div>
      ) : (
        <>
          <div className='mt-2 text-xs text-gray-300'>
            Did it pick the right winner? <span className='text-amber-300'>* required</span>
          </div>
          <div className='mt-1 flex gap-2'>
            {(['agree', 'disagree', 'unsure'] as const).map((a) => (
              <button
                key={a}
                type='button'
                onClick={() => setAgree(a)}
                className={`rounded px-2 py-1 text-xs transition ${
                  agree === a
                    ? 'bg-amber-400/40 text-white ring-1 ring-amber-300'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {a === 'agree' ? 'Agree' : a === 'disagree' ? 'Disagree' : 'Unsure'}
              </button>
            ))}
          </div>

          <div className='mt-2 flex items-center gap-2'>
            <span className='text-xs text-gray-400'>
              Your grade <span className='text-gray-500'>(optional)</span>:
            </span>
            {grades.map((g) => (
              <button
                key={g}
                type='button'
                onClick={() => setGrade((cur) => (cur === g ? '' : g))}
                className={`rounded px-2 py-1 text-xs transition ${
                  grade === g
                    ? 'bg-white/25 text-white ring-1 ring-white/40'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Optional: why? (this is what improves the analyzer)'
            className='mt-2 w-full rounded bg-white/5 p-2 text-xs text-gray-200'
            rows={2}
          />
        </>
      )}

      <div className='mt-2 flex flex-wrap items-center gap-2'>
        {!props.done && (
          <button
            type='button'
            disabled={!canSubmit}
            onClick={() =>
              agree && props.onSubmit({ agree_winner: agree, grade: grade || undefined, note: note || undefined })
            }
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              canSubmit
                ? '!border-amber-300/60 !bg-amber-400 !text-gray-900 hover:!bg-amber-300'
                : 'cursor-not-allowed !border-transparent !bg-white/10 !text-gray-400'
            }`}
          >
            {props.submitting ? 'Saving…' : 'Submit feedback'}
          </button>
        )}
        <button
          type='button'
          onClick={props.onRunAnother}
          className='rounded border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white'
        >
          Run another
        </button>
        {!props.done && agree == null && (
          <span className='text-xs text-gray-500'>Pick an option to submit, or just Run another to skip</span>
        )}
      </div>
    </div>
  );
}
