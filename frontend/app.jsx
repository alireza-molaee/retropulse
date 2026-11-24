import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Field, Icon, Dialog } from './design-system.jsx';
import { Board, columns, formatNumber } from './board.jsx';
import { Avatar, AvatarPicker } from './avatar-picker.jsx';
import { SurveyBuilder } from './survey.jsx';
import { ThemePicker } from './theme-picker.jsx';
import { Landing } from './landing.jsx';

const initialId = new URLSearchParams(location.search).get('board');
const showLanding = location.pathname === '/' && !initialId;

async function request(path, secret, body, signal) {
  const headers = secret ? { Authorization: 'Bearer ' + secret } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/boards' + path, {
    method: body ? 'POST' : 'GET', headers, body: body && JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  if (result.serverNow) result.receivedAt = performance.now();
  if (result.board?.serverNow) result.board.receivedAt = performance.now();
  return result;
}

function Entry({ joining, pending, onSubmit }) {
  const [avatar, setAvatar] = useState(null);
  const [survey, setSurvey] = useState(null);
  return <main className="container entry">
    <section className="entry__intro">
      <div className="entry__mark"><Icon name="logo" size={36} /></div>
      <h1>رتروسپکتیو تیم</h1>
      <p>با تیم مرور کنید چه گذشت، چه آموختید و برای اسپرینت بعد چه کاری انجام می‌دهید.</p>
      {!joining && <ul className="entry__columns" aria-label="ستون‌های برد">
        {Object.values(columns).map(column => <li key={column.tone} data-tone={column.tone}><Icon name={column.icon} />{column.title}</li>)}
      </ul>}
    </section>
    <section className="entry__form surface">
      <h2>{joining ? 'پیوستن به جلسه' : 'ساخت جلسهٔ جدید'}</h2>
      <form onSubmit={event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        if (!avatar) return;
        data.avatar = avatar;
        if (!joining && survey) data.survey = survey;
        if (!joining) data.voteLimit = Number(data.voteLimit);
        onSubmit(data);
      }}>
        {!joining && <Field label="نام جلسه" name="title" placeholder="مثلاً رتروی اسپرینت ۱۲" maxLength={120} required />}
        <Field label="نام شما" name="name" placeholder="نامی که تیم شما را با آن می‌شناسد" autoComplete="nickname" maxLength={80} required />
        {!joining && <Field label="تعداد رأی هر نفر" name="voteLimit" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} defaultValue={3} required />}
        <AvatarPicker selected={avatar} onSelect={setAvatar} />
        {!joining && <SurveyBuilder questions={survey} onChange={setSurvey} />}
        <Button variant="primary" icon={joining ? 'users' : 'plus'} type="submit" disabled={pending || !avatar}>{joining ? 'پیوستن به جلسه' : 'ساخت برد'}</Button>
      </form>
    </section>
  </main>;
}

function App() {
  const [id, setId] = useState(initialId);
  const [secret, setSecret] = useState(() => initialId && localStorage.getItem('retro:' + initialId));
  const [board, setBoard] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  const [rosterOpen, setRosterOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const writing = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    if (!secret) return;
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (writing.current || refreshing) return;
      refreshing = true;
      const version = revision.current;
      try {
        const next = await request('/' + id, secret, null, controller.signal);
        if (version === revision.current && !controller.signal.aborted) {
          setBoard(next);
          setConnectionError('');
        }
      } catch (failure) {
        if (version !== revision.current || controller.signal.aborted) return;
        if (failure.status === 401 || failure.status === 404) {
          localStorage.removeItem('retro:' + id);
          setSecret(null);
          setBoard(null);
          setConnectionError('');
          setError(failure.message);
        } else {
          setConnectionError(failure.message);
        }
      } finally {
        refreshing = false;
      }
    }
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [id, secret]);

  async function save(operation) {
    if (writing.current) return false;
    writing.current = true;
    revision.current++;
    setPending(true);
    setError('');
    try {
      await operation();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  function enter(data) {
    return save(async () => {
      const result = await request(id ? '/' + id + '/join' : '', null, data);
      localStorage.setItem('retro:' + result.id, result.secret);
      history.replaceState(null, '', '/?board=' + result.id);
      setId(result.id);
      setSecret(result.secret);
      setBoard(result.board);
    });
  }

  function change(type, data) {
    return save(async () => setBoard(await request('/' + id + '/change', secret, { ...data, type })));
  }

  function share() {
    const url = new URL('/', location.origin);
    url.searchParams.set('board', id);
    setInvite(url.href);
    setCopyStatus('');
  }

  return <>
    <header className="topbar"><div className="container topbar__inner">
      <a href="/" className="brand"><span className="brand__mark"><Icon name="logo" size={21} /></span><bdi>RetroPulse</bdi></a>
      <div className="topbar__meta">
        <ThemePicker />
        {board && <>
          <Button variant="ghost" icon="users" onClick={() => setRosterOpen(true)} aria-label="نمایش اعضای جلسه">{formatNumber(board.participants)} نفر</Button>
          <span className="profile"><Avatar id={board.me.avatar} name={board.me.name} /><span className="profile__name">{board.me.name}</span></span>
        </>}
      </div>
    </div></header>
    {(error || connectionError) && <div className="container alert" role="alert">{error || connectionError}</div>}
    {board ? <Board board={board} pending={pending} change={change} onShare={share} error={error} />
      : secret ? <main className="container status" role="status">{connectionError ? 'در حال تلاش برای اتصال دوباره…' : 'در حال باز کردن برد…'}</main>
      : showLanding ? <Landing /> : <Entry joining={Boolean(id)} pending={pending} onSubmit={enter} />}
    {invite && <Dialog title="دعوت به جلسه" onClose={() => setInvite('')}>
      <Field label="لینک دعوت" value={invite} readOnly dir="ltr" onFocus={event => event.target.select()} />
      <div className="dialog__actions"><Button variant="primary" icon="link" onClick={async () => {
        try {
          await navigator.clipboard.writeText(invite);
          setCopyStatus('لینک کپی شد.');
        } catch {
          document.querySelector('dialog input')?.select();
          setCopyStatus('لینک انتخاب شد. آن را از فیلد بالا کپی کنید.');
        }
      }}>کپی لینک</Button></div>
      <p className="dialog__copy" role="status">{copyStatus}</p>
    </Dialog>}
    {rosterOpen && board && <Dialog title="اعضای جلسه" onClose={() => setRosterOpen(false)}>
      <ul className="avatar-roster">{board.roster.map(person => <li key={person.id}>
        <Avatar id={person.avatar} name={person.name} /><span dir="auto">{person.name}</span>
        {person.id === board.me.id && <Badge>شما</Badge>}
      </li>)}</ul>
    </Dialog>}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
