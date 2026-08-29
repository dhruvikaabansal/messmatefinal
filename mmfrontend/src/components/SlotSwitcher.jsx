import React, { useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { countdown, friendlyDate, mealEmoji, mealLabel } from '../lib/format';
import { useToast } from '../lib/toast';
import { Sheet } from './ui';

/**
 * The slot the user is browsing, and a one-tap way to change it.
 *
 * Changing meal used to mean leaving Discover for a settings page, saving, and
 * navigating back. Now it's a sheet on the same screen — the single most
 * common adjustment shouldn't cost three page loads.
 */
const SlotSwitcher = ({ slot, slots = [], onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (s) => {
    if (!s.isOpen) return;
    setBusy(true);
    try {
      await api.post('/slot/switch', { date: s.mealDate, mealType: s.mealTime });
      setOpen(false);
      toast.success(`Switched to ${mealLabel(s.mealTime).toLowerCase()} · ${friendlyDate(s.mealDate)}`);
      onChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const today = slots.filter((s) => s.isToday);
  const tomorrow = slots.filter((s) => !s.isToday);

  return (
    <>
      <button
        className="card card--tint row-between"
        onClick={() => setOpen(true)}
        style={{ width: '100%', cursor: 'pointer', textAlign: 'left', padding: '10px 14px' }}
      >
        <span className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }} aria-hidden>{mealEmoji(slot?.mealTime)}</span>
          <span className="stack-sm" style={{ gap: 0 }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>
              {mealLabel(slot?.mealTime)} · {friendlyDate(slot?.mealDate)}
            </strong>
            <span className="small muted">
              {slot?.slotStatus === 'closed' ? 'This slot has closed' : countdown(slot?.minutesLeft)}
            </span>
          </span>
        </span>
        <span className="chip chip--sky">change ⏰</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="When are you eating?">
        <div className="stack">
          {[
            ['Today', today],
            ['Tomorrow', tomorrow],
          ].map(([heading, group]) => (
            <div key={heading} className="stack-sm">
              <div className="eyebrow">{heading}</div>
              <div className="stack-sm">
                {group.map((s) => {
                  const active = s.mealDate === slot?.mealDate && s.mealTime === slot?.mealTime;
                  return (
                    <button
                      key={s.slotId}
                      className="card row-between"
                      disabled={!s.isOpen || busy}
                      onClick={() => pick(s)}
                      style={{
                        padding: '10px 14px',
                        cursor: s.isOpen ? 'pointer' : 'not-allowed',
                        opacity: s.isOpen ? 1 : 0.45,
                        borderColor: active ? 'var(--tomato)' : undefined,
                        boxShadow: active ? '4px 4px 0 var(--tomato)' : undefined,
                        textAlign: 'left',
                      }}
                    >
                      <span className="row" style={{ gap: 10 }}>
                        <span style={{ fontSize: '1.2rem' }} aria-hidden>{s.emoji}</span>
                        <span className="stack-sm" style={{ gap: 0 }}>
                          <strong>{s.label}</strong>
                          <span className="small muted">{s.window}</span>
                        </span>
                      </span>
                      <span className={`chip ${s.isOpen ? 'chip--soft' : ''}`}>
                        {s.isOpen ? countdown(s.minutesLeft) : 'closed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
};

export default SlotSwitcher;
