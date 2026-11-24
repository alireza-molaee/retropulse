import React, { useRef, useState } from 'react';
import { Button, Icon } from './design-system.jsx';

const themes = {
  system: { label: 'تنظیم سیستم', icon: 'monitor' },
  light: { label: 'روشن', icon: 'sun' },
  dark: { label: 'تاریک', icon: 'moon' },
};

export function ThemePicker() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'system');
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);

  function select(value) {
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try {
      if (value === 'system') localStorage.removeItem('retro:theme');
      else localStorage.setItem('retro:theme', value);
    } catch {
      // The choice still applies to the current page.
    }
    setTheme(value);
    setOpen(false);
    trigger.current.focus();
  }

  return <div className="theme-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current.focus();
    }
  }}>
    <Button ref={trigger} icon={themes[theme].icon} variant="ghost" aria-label={'تم نمایش، ' + themes[theme].label}
      aria-expanded={open} aria-controls="theme-options" onClick={() => setOpen(!open)}>
      <span className="theme-picker__label">تم</span>
    </Button>
    <div id="theme-options" className="theme-picker__options surface" hidden={!open} role="group" aria-label="انتخاب تم">
      {Object.entries(themes).map(([value, option]) => <Button key={value} icon={option.icon} variant={theme === value ? 'soft' : 'ghost'}
        aria-pressed={theme === value} onClick={() => select(value)}>
        <span>{option.label}</span>
        {theme === value && <Icon name="check" size={15} />}
      </Button>)}
    </div>
  </div>;
}
