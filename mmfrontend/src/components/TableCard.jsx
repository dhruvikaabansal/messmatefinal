import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, Reasons } from './ui';

/**
 * An open group table, shown inline in the same deck as people.
 *
 * Group meals used to live behind a mode switch that also disabled 1-on-1
 * matching. Putting tables in the main feed means a user never has to choose a
 * "mode" before they know what's on offer.
 */
const TableCard = ({ table, onJoin, busy }) => (
  <motion.article
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.97 }}
    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    className="card stack"
    style={{ borderColor: 'var(--plum)', boxShadow: '4px 4px 0 var(--plum)' }}
  >
    <div className="row-between">
      <span className="chip chip--plum">👥 Group table</span>
      <span className="chip chip--soft">
        {table.isFull ? 'Full' : `${table.seatsLeft} seat${table.seatsLeft === 1 ? '' : 's'} left`}
      </span>
    </div>

    <div className="stack-sm">
      <h2>{table.name}</h2>
      {table.description && <p className="muted">{table.description}</p>}
      {table.venue && <p className="small">📍 {table.venue}</p>}
    </div>

    <div className="row">
      <div className="avatar-stack">
        {table.members?.slice(0, 4).map((m) => (
          <Avatar key={m._id} src={m.profilePic} name={m.name} size="sm" />
        ))}
      </div>
      <span className="small muted grow">
        {table.members?.length === 1
          ? `${table.members[0].name} is hosting`
          : `${table.members?.map((m) => m.name.split(' ')[0]).slice(0, 3).join(', ')}${
              table.members?.length > 3 ? ` +${table.members.length - 3}` : ''
            }`}
      </span>
    </div>

    {table.reasons?.length > 0 && (
      <div className="card card--tint card--flat">
        <Reasons items={table.reasons} />
      </div>
    )}

    {table.interests?.length > 0 && (
      <div className="chip-group">
        {table.interests.map((i) => (
          <span key={i} className="chip chip--soft">{i}</span>
        ))}
      </div>
    )}

    <button
      className="btn btn--primary btn--block"
      onClick={onJoin}
      disabled={table.isFull || Boolean(busy)}
    >
      {table.isFull ? 'Table is full' : 'Take a seat'}
    </button>
  </motion.article>
);

export default TableCard;
