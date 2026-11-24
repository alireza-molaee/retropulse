import React, { useEffect, useRef } from 'react';

const paths = {
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19m11-7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 15a8 8 0 0 1-11-11 9 9 0 1 0 11 11Z',
  monitor: 'M3 4h18v13H3zM12 17v4m-4 0h8',
  copy: 'M8 8h12v12H8zM16 4H4v12',
  survey: 'M4 3h16v18H4zM8 16v-3m4 3V8m4 8v-5',
  comment: 'M20 11a7 7 0 0 1-7 7H9l-5 3 1.5-5A7 7 0 0 1 11 4h2a7 7 0 0 1 7 7Z',
  timer: 'M10 2h4m-2 0v3m5 1 2-2m1 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-4v4l3 2',
  volume: 'M3 9h4l5-4v14l-5-4H3zm13 0a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12',
  logo: 'M4 5h7v7H4z M14 5h6v4h-6z M14 12h6v7h-6z M4 15h7v4H4z',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2m3 5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8',
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h5',
  group: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  vote: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  check: 'm5 12 4 4L19 6',
  up: 'm3 17 6-6 4 4 7-8m-6 0h6v6',
  flag: 'M4 22V4m0 1c5-5 9 4 15-1v11c-6 5-10-4-15 1',
  spark: 'M12 2c0 6-4 10-10 10 6 0 10 4 10 10 0-6 4-10 10-10-6 0-10-4-10-10Z',
  close: 'm6 6 12 12M18 6 6 18',
  edit: 'm14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15z',
  trash: 'M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7',
  minus: 'M5 12h14',
  arrow: 'm14 6-6 6 6 6',
};

export function Icon({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function Button({ children, icon, variant = 'secondary', type = 'button', className = '', ...props }) {
  return <button type={type} className={`button button--${variant} ${className}`} {...props}>{icon && <Icon name={icon} />}{children}</button>;
}

export function Field({ label, multiline, ...props }) {
  return <label className="field"><span>{label}</span>{multiline ? <textarea {...props} /> : <input {...props} />}</label>;
}

export function Switch({ children, ...props }) {
  return <label className="ui-switch">
    <input type="checkbox" role="switch" {...props} />
    <span>{children}</span>
  </label>;
}

export function Badge({ children, icon, tone = 'neutral' }) {
  return <span className={`badge badge--${tone}`}>{icon && <Icon name={icon} size={15} />}{children}</span>;
}

export function EmptyState({ icon, children }) {
  return <div className="empty"><span className="empty__icon"><Icon name={icon} size={22} /></span><span>{children}</span></div>;
}

export function Dialog({ title, children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog className="dialog" ref={dialog} aria-labelledby="dialog-title" onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
    <div className="dialog__header"><h2 id="dialog-title">{title}</h2><Button variant="ghost" icon="close" aria-label="بستن" onClick={onClose} /></div>
    {children}
  </dialog>;
}
