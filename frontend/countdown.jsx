import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Field, Icon } from './design-system.jsx';

const defaultSeconds = 120;
const digits = new Intl.NumberFormat('fa', { minimumIntegerDigits: 2, useGrouping: false });

function chime(context) {
  if (context?.state !== 'running') return;
  const start = context.currentTime;
  for (const [index, frequency] of [659, 784, 1047].entries()) {
    const tone = context.createOscillator();
    const volume = context.createGain();
    const time = start + index * .15;
    tone.type = 'sine';
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(.001, time);
    volume.gain.exponentialRampToValueAtTime(.18, time + .025);
    volume.gain.exponentialRampToValueAtTime(.001, time + .3);
    tone.connect(volume).connect(context.destination);
    tone.start(time);
    tone.stop(time + .31);
  }
}

export function Countdown({ board, pending, change, error }) {
  const [settings, setSettings] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [emptyDuration, setEmptyDuration] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const audio = useRef(null);
  const endsAt = board.timer?.endsAt;
  const duration = board.timer?.seconds ?? defaultSeconds;
  const remaining = snapshot && snapshot.endsAt === endsAt
    ? snapshot.seconds
    : Math.max(0, Math.ceil(((endsAt ?? board.serverNow) - board.serverNow) / 1000));
  const running = Boolean(endsAt && remaining > 0);
  const expired = Boolean(endsAt && !remaining);
  const display = endsAt ? remaining : duration;

  const unlockSound = useCallback(async () => {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      audio.current ??= new Audio();
      await audio.current.resume();
      if (audio.current.state === 'running') setSoundEnabled(true);
    } catch {
      setSoundError(true);
    }
  }, []);

  useEffect(() => {
    if (soundEnabled) return;
    window.addEventListener('click', unlockSound);
    return () => {
      window.removeEventListener('click', unlockSound);
    };
  }, [soundEnabled, unlockSound]);

  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);

  useEffect(() => {
    if (!endsAt) return;
    const deadline = board.receivedAt + endsAt - board.serverNow;
    let wasRunning = false;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setSnapshot(previous => previous?.endsAt === endsAt && previous.seconds === seconds ? previous : { endsAt, seconds });
      if (seconds > 0) wasRunning = true;
      else {
        if (wasRunning) chime(audio.current);
        wasRunning = false;
      }
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  return <section className="countdown surface" aria-label="تایمر جلسه">
    <div className="countdown__summary">
      <span className="stage__icon"><Icon name="timer" size={22} /></span>
      <div>
        <h2>تایمر جلسه</h2>
        <p role="status">{expired ? 'زمان تمام شد' : running ? 'در حال شمارش معکوس' : 'آمادهٔ شروع'}</p>
      </div>
      <bdi dir="ltr" role="timer" className="countdown__time" data-urgent={expired || (running && remaining <= 5)} data-flash={running && remaining <= 5}>
        {digits.format(Math.floor(display / 60))}:{digits.format(display % 60)}
      </bdi>
    </div>
    <div className="countdown__controls">
      {!soundEnabled && <Button variant="ghost" icon="volume" onClick={unlockSound}>فعال‌کردن صدا</Button>}
      {board.me.host && <>
        {!running && <Button variant="primary" icon="timer" disabled={pending} onClick={() => change('start-timer', { seconds: duration })}>شروع تایمر</Button>}
        <Button disabled={pending} onClick={() => {
          setAttempted(false);
          setEmptyDuration(false);
          setSettings(true);
        }}>تنظیم زمان</Button>
        <Button variant="ghost" disabled={pending || !endsAt} onClick={() => change('reset-timer')}>بازنشانی تایمر</Button>
      </>}
    </div>
    {soundError && !soundEnabled && <p className="countdown__sound-error" role="status">فعال کردن صدا در این مرورگر ممکن نشد.</p>}
    {settings && <Dialog title="تنظیم زمان تایمر" onClose={() => setSettings(false)}>
      <form onSubmit={async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const seconds = Number(data.get('minutes')) * 60 + Number(data.get('seconds'));
        setEmptyDuration(seconds === 0);
        if (!seconds) return;
        setAttempted(true);
        if (await change('start-timer', { seconds })) setSettings(false);
      }}>
        <div className="countdown__fields">
          <Field label="دقیقه" name="minutes" type="number" min={0} max={5999} step={1} defaultValue={Math.floor(duration / 60)} required />
          <Field label="ثانیه" name="seconds" type="number" min={0} max={59} step={1} defaultValue={duration % 60} required />
        </div>
        {(emptyDuration || (attempted && error)) && <p role="alert" className="dialog__error">{emptyDuration ? 'مدت تایمر باید دست‌کم یک ثانیه باشد.' : error}</p>}
        <div className="dialog__actions">
          <Button onClick={() => setSettings(false)}>انصراف</Button>
          <Button variant="primary" type="submit" disabled={pending}>تنظیم و شروع</Button>
        </div>
      </form>
    </Dialog>}
  </section>;
}
