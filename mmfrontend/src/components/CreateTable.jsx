import React, { useState } from 'react';
import api, { errorMessage } from '../lib/api';
import { friendlyDate, mealLabel } from '../lib/format';
import { useToast } from '../lib/toast';
import { Sheet } from './ui';

const SUGGESTIONS = ['Mess 1', 'Mess 2', 'Main canteen', 'Nescafé', 'Food court', 'Dhaba'];

/**
 * Open a group table for the slot you're already browsing.
 * No date or meal pickers here on purpose — the table belongs to the slot on
 * screen, which removes an entire class of "why is my table empty" confusion.
 */
const CreateTable = ({ open, slot, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', venue: '', maxMembers: 4 });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Give your table a name.');
    setSaving(true);
    try {
      await api.post('/community/create', {
        ...form,
        maxMembers: Number(form.maxMembers),
        mealDate: slot?.mealDate,
        mealTime: slot?.mealTime,
      });
      toast.success('Table is live — people in this slot can see it now.');
      setForm({ name: '', description: '', venue: '', maxMembers: 4 });
      onCreated?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Start a table">
      <form className="stack" onSubmit={submit}>
        <p className="small muted">
          For {mealLabel(slot?.mealTime).toLowerCase()} · {friendlyDate(slot?.mealDate)}
        </p>

        <div className="field">
          <label className="label" htmlFor="t-name">Table name</label>
          <input
            id="t-name"
            className="input"
            placeholder="Late lunch, loud table"
            value={form.name}
            onChange={set('name')}
            maxLength={60}
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="t-venue">Where</label>
          <input
            id="t-venue"
            className="input"
            placeholder="Mess 2, near the window"
            value={form.venue}
            onChange={set('venue')}
            maxLength={80}
          />
          <div className="chip-group">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip chip-toggle"
                aria-pressed={form.venue === s}
                onClick={() => setForm((f) => ({ ...f, venue: s }))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="t-desc">What's the vibe?</label>
          <textarea
            id="t-desc"
            className="textarea"
            placeholder="Assignment panic + chai. Come complain with us."
            value={form.description}
            onChange={set('description')}
            maxLength={200}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="t-size">Seats</label>
          <select id="t-size" className="select" value={form.maxMembers} onChange={set('maxMembers')}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>{n} people</option>
            ))}
          </select>
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={saving}>
          {saving ? 'Opening…' : 'Open the table'}
        </button>
        <p className="hint center">You can leave any time — the table carries on without you.</p>
      </form>
    </Sheet>
  );
};

export default CreateTable;
