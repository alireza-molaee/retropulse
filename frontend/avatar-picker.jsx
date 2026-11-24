import React, { useState } from 'react';
import { avatarGroups, avatars, findAvatar } from '../avatars.js';
import { Button, Dialog, Icon } from './design-system.jsx';

export function Avatar({ id, name, className = '' }) {
  const avatar = findAvatar(id);
  return <span className={`avatar ${className}`} aria-hidden="true">
    {avatar ? <span className="avatar__art" style={{
      backgroundPosition: `${avatar.column / 7 * 100}% ${avatar.row / 5 * 100}%`,
    }} /> : Array.from(name || '؟')[0]}
  </span>;
}

export function AvatarPicker({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(0);
  const avatar = findAvatar(selected);
  const start = avatarGroups.slice(0, category).reduce((count, group) => count + group.names.length, 0);
  const choices = avatars.slice(start, start + avatarGroups[category].names.length);
  return <div className="avatar-field">
    <Avatar id={selected} className="avatar--large" />
    <div><strong>آواتار شما</strong><span className="avatar-field__name">{avatar?.name ?? 'یک آواتار انتخاب کنید'}</span></div>
    <Button onClick={() => setOpen(true)}>{avatar ? 'تغییر آواتار' : 'انتخاب آواتار'}</Button>
    {open && <Dialog title="آواتار خودت را انتخاب کن" onClose={() => setOpen(false)}>
      <div className="avatar-filters" role="group" aria-label="دستهٔ آواتار">
        {avatarGroups.map((group, index) => <Button key={group.label} variant={category === index ? 'soft' : 'secondary'}
          aria-pressed={category === index} onClick={() => setCategory(index)}>{group.label}</Button>)}
      </div>
      <div className="avatar-grid" role="group" aria-label={avatarGroups[category].label}>
        {choices.map(choice => <button key={choice.id} type="button" className="avatar-choice"
          aria-label={choice.name} aria-pressed={selected === choice.id} onClick={() => {
            onSelect(choice.id);
            setOpen(false);
          }}>
          <Avatar id={choice.id} />
          <span>{choice.name}</span>
          {selected === choice.id && <span className="avatar-choice__check"><Icon name="check" size={13} /></span>}
        </button>)}
      </div>
    </Dialog>}
  </div>;
}
