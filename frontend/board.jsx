import React, { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './avatar-picker.jsx';
import { Countdown } from './countdown.jsx';
import { SurveyForm, SurveyResults } from './survey.jsx';
import { RetroExport } from './retro-export.jsx';
import { reactions } from '../reactions.js';
import { Badge, Button, Dialog, EmptyState, Field, Icon, Switch } from './design-system.jsx';

export const columns = {
  good: { title: 'چه چیزی خوب پیش رفت؟', tone: 'mint', icon: 'up', empty: 'از موفقیت‌های این اسپرینت بنویسید.' },
  hard: { title: 'چه چیزی دشوار بود؟', tone: 'peach', icon: 'flag', empty: 'چالش‌های این اسپرینت را ثبت کنید.' },
  try: { title: 'چه چیزی را امتحان کنیم؟', tone: 'iris', icon: 'spark', empty: 'پیشنهادهای خود برای اسپرینت بعد را ثبت کنید.' },
};
const phases = {
  write: { title: 'یادداشت‌ها', icon: 'note', help: 'در این مرحله فقط یادداشت‌های خودتان را می‌بینید.' },
  group: { title: 'گروه‌بندی', icon: 'group', help: 'کارت‌های مرتبط در یک گروه کنار هم قرار می‌گیرند.' },
  vote: { title: 'رأی‌گیری', icon: 'vote', help: 'به یادداشت‌ها یا گروه‌هایی رأی دهید که می‌خواهید تیم دربارهٔ آن‌ها گفت‌وگو کند.' },
  actions: { title: 'اقدام‌ها', icon: 'target', help: 'نتیجهٔ رأی‌گیری را مرور کنید و برای موضوع‌های مهم اقدام تعیین کنید.' },
  done: { title: 'پایان', icon: 'check', help: 'یادداشت‌ها، نتیجهٔ رأی‌گیری و اقدام‌ها با همین لینک در دسترس‌اند.' },
};
const phaseKeys = Object.keys(phases);
export const formatNumber = new Intl.NumberFormat('fa').format;

function VoteControls({ board, target, change, pending }) {
  if (board.phase === 'vote') {
    const count = board.me.votes.filter(vote => vote === target).length;
    return <div className="vote-controls">
      <Button icon="plus" variant={count ? 'soft' : 'secondary'} disabled={pending || board.me.votes.length >= board.voteLimit} onClick={() => change('vote', { target })}>رأی دادن</Button>
      <Badge>{formatNumber(count)} رأی شما</Badge>
      {count > 0 && <Button icon="minus" variant="ghost" aria-label="پس گرفتن رأی" disabled={pending} onClick={() => change('unvote', { target })} />}
    </div>;
  }
  if (['actions', 'done'].includes(board.phase)) return <Badge icon="vote" tone="accent">{formatNumber(board.totals[target] ?? 0)} رأی</Badge>;
  return null;
}

function CardDiscussion({ note, readOnly, pending, change }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return <div className="card-discussion" onDragStart={event => event.stopPropagation()}>
    <button type="button" className="card-discussion__toggle" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
      <Icon name="comment" size={17} />
      <span>کامنت‌ها و واکنش‌ها</span>
      <Badge>{formatNumber(note.comments.length)} کامنت</Badge>
      {note.reactions.length > 0 && <span className="card-discussion__preview" aria-label="ایموجی‌های ثبت‌شده">{note.reactions.map(item => item.emoji).join(' ')}</span>}
    </button>
    <div id={panel} className="card-discussion__body" hidden={!open}>
      <div className="card-reactions" role="group" aria-label="واکنش‌ها">
        {reactions.map(({ emoji, label }) => {
          const reaction = note.reactions.find(item => item.emoji === emoji);
          const content = <><span aria-hidden="true">{emoji}</span>{reaction && <span>{formatNumber(reaction.count)}</span>}</>;
          if (readOnly) return reaction && <span key={emoji} className="reaction-pill" aria-label={label + '، ' + formatNumber(reaction.count)}>{content}</span>;
          return <button key={emoji} type="button" className="reaction-pill" aria-label={label + (reaction ? '، ' + formatNumber(reaction.count) : '')}
            aria-pressed={reaction?.active ?? false} title={label} disabled={pending}
            onClick={() => change('reaction', { note: note.id, emoji, active: !reaction?.active })}>{content}</button>;
        })}
      </div>
      {note.comments.length > 0 && <ul className="card-comments" aria-label="کامنت‌های کارت">
        {note.comments.map(comment => <li key={comment.id}>
          {comment.attribution ? <div className="note__author">
            <Avatar id={comment.attribution.avatar} name={comment.attribution.name} />
            <span dir="auto">{comment.attribution.name}</span>
          </div> : <span className="card-comments__anonymous">ناشناس</span>}
          <p dir="auto">{comment.text}</p>
        </li>)}
      </ul>}
      {!readOnly && <form className="card-comment-form" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        if (await change('comment', { note: note.id, text: fields.get('text'), anonymous: fields.has('anonymous') })) form.reset();
      }}>
        <Field label="کامنت" multiline name="text" rows={2} maxLength={500} required />
        <div className="card-comment-form__actions">
          <Switch name="anonymous">ثبت ناشناس</Switch>
          <Button variant="primary" type="submit" disabled={pending}>ارسال کامنت</Button>
        </div>
      </form>}
    </div>
  </div>;
}

function Note({ note, board, edit, change, pending, grouping }) {
  const destination = !note.group && grouping?.canDrop(note.id, note.column);
  const selected = grouping?.source?.id === note.id;
  return <article className="note" draggable={Boolean(grouping)} data-selected={selected}
    {...(destination ? grouping.dropProps(note.id) : {})}
    onDragStart={grouping && (event => {
      event.dataTransfer.setData('text/plain', note.id);
      event.dataTransfer.effectAllowed = 'move';
      grouping.select(note);
    })}
    onDragEnd={grouping && (() => grouping.select(null))}>
    <p dir="auto">{note.text}</p>
    {note.attribution && <div className="note__author">
      <Avatar id={note.attribution.avatar} name={note.attribution.name} />
      <span dir="auto">{note.attribution.name}</span>
    </div>}
    {board.phase === 'write' && <div className="note__controls">
      <Button icon="edit" variant="ghost" aria-label="ویرایش یادداشت" disabled={pending} onClick={() => edit({ type: 'edit', note })} />
      <Button icon="trash" variant="ghost" aria-label="حذف یادداشت" disabled={pending} onClick={() => edit({ type: 'delete', note })} />
    </div>}
    {grouping && <Button icon="group" variant={selected ? 'soft' : 'ghost'} aria-pressed={selected}
      disabled={pending} onClick={() => destination ? grouping.move(note.id) : grouping.select(selected ? null : note)}>
      {destination ? 'گروه‌کردن با این کارت' : selected ? 'لغو انتخاب' : 'انتخاب کارت'}
    </Button>}
    {!note.group && <VoteControls {...{ board, change, pending }} target={note.id} />}
    {board.phase !== 'write' && (board.phase !== 'done' || note.comments.length > 0 || note.reactions.length > 0) &&
      <CardDiscussion note={note} readOnly={board.phase === 'done'} pending={pending} change={change} />}
  </article>;
}

function Lane({ column, board, edit, change, pending, grouping }) {
  const theme = columns[column];
  const notes = board.notes.filter(note => note.column === column);
  const groups = board.groups.filter(group => group.column === column);
  const items = [
    ...groups.map(group => ({ id: group.id })),
    ...notes.filter(note => !note.group).map(note => ({ id: note.id, note })),
  ];
  if (board.phase === 'actions') {
    items.sort((first, second) => (board.totals[second.id] ?? 0) - (board.totals[first.id] ?? 0));
  }
  const noteProps = { board, edit, change, pending, grouping };
  return <section className="lane" data-tone={theme.tone} aria-label={theme.title}>
    <div className="lane__header"><span className="lane__icon"><Icon name={theme.icon} size={20} /></span><h2>{theme.title}</h2><span className="lane__count" aria-label={formatNumber(notes.length) + ' یادداشت'}>{formatNumber(notes.length)}</span></div>
    <div className="lane__body">
      {items.map(({ id, note }) => {
        if (note) return <Note key={id} note={note} {...noteProps} />;
        const destination = grouping?.canDrop(id, column);
        return <div className="group" key={id} role="group" aria-label="کارت‌های گروه‌شده"
          {...(destination ? grouping.dropProps(id) : {})}>
          {notes.filter(note => note.group === id).map(note => <Note key={note.id} note={note} {...noteProps} />)}
          {destination && <Button icon="plus" disabled={pending} onClick={() => grouping.move(id)}>افزودن به این گروه</Button>}
          <VoteControls {...{ board, change, pending }} target={id} />
        </div>;
      })}
      {grouping?.source?.group && grouping.source.column === column && <Button icon="minus" className="group-detach"
        {...grouping.dropProps(null)} disabled={pending} onClick={() => grouping.move(null)}>خارج کردن از گروه</Button>}
      {!notes.length && <EmptyState icon="note">{board.phase === 'write' ? theme.empty : 'یادداشتی در این ستون ثبت نشده است.'}</EmptyState>}
      {board.phase === 'write' && <Button className="lane__add" icon="plus" disabled={pending} onClick={() => edit({ type: 'note', column })}>افزودن یادداشت</Button>}
    </div>
  </section>;
}

function AssigneePicker({ members, selfId, value, onChange }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  function memberLabel(member, index) {
    const duplicate = members.some(person => person.id !== member.id && person.name === member.name);
    return member.name + (duplicate ? ` (عضو ${formatNumber(index + 1)})` : '') + (member.id === selfId ? ' (شما)' : '');
  }
  const selectedIndex = members.findIndex(member => member.id === value);
  const selected = members[selectedIndex];
  return <div className="field assignee" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current.focus();
    }
  }}>
    <span id="assignee-label">مسئول</span>
    <button ref={trigger} type="button" className="assignee__trigger" aria-expanded={open} aria-controls="assignee-options"
      aria-labelledby="assignee-label assignee-value" onClick={() => setOpen(!open)}>
      {selected ? <Avatar id={selected.avatar} name={selected.name} /> : <span className="assignee__placeholder"><Icon name="users" size={17} /></span>}
      <span id="assignee-value">{selected ? memberLabel(selected, selectedIndex) : 'انتخاب عضو جلسه'}</span>
      <span className="assignee__chevron" aria-hidden="true" />
    </button>
    <div id="assignee-options" className="assignee__options" role="group" aria-labelledby="assignee-label" hidden={!open}>
      {members.map((member, index) => <button key={member.id} type="button" className="assignee__option"
        aria-pressed={value === member.id} onClick={() => {
          onChange(member.id);
          setOpen(false);
          trigger.current.focus();
        }}>
        <Avatar id={member.avatar} name={member.name} />
        <span dir="auto">{memberLabel(member, index)}</span>
        {value === member.id && <Icon name="check" size={16} />}
      </button>)}
    </div>
  </div>;
}

function Actions({ board, pending, change }) {
  const [ownerId, setOwnerId] = useState('');
  return <section className="surface outcomes">
    <div className="section-title"><span className="stage__icon"><Icon name="target" /></span><h2>اقدام‌های تیم</h2><Badge>{formatNumber(board.actions.length)}</Badge></div>
    {board.phase === 'actions' && board.me.host && <form className="action-form" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!ownerId) return;
      if (await change('action', { ...Object.fromEntries(new FormData(form)), ownerId })) {
        form.reset();
        setOwnerId('');
      }
    }}>
      <Field label="اقدام" name="text" maxLength={500} required />
      <AssigneePicker members={board.roster} selfId={board.me.id} value={ownerId} onChange={setOwnerId} />
      <Field label="مهلت" name="due" type="date" required />
      <Button variant="primary" icon="plus" disabled={pending || !ownerId} type="submit">ثبت اقدام</Button>
    </form>}
    {board.actions.length ? <ul className="action-list">{board.actions.map(action => <li key={action.id}>
      <strong dir="auto">{action.text}</strong>
      <span className="action-owner">
        <Avatar id={board.roster.find(member => member.id === action.ownerId)?.avatar} name={action.owner} />
        <span dir="auto">{action.owner}</span>
      </span>
      <time dateTime={action.due} dir="ltr">{action.due}</time>
    </li>)}</ul> : <EmptyState icon="target">هنوز اقدامی ثبت نشده است.</EmptyState>}
  </section>;
}

const dialogTitles = {
  note: 'افزودن یادداشت', edit: 'ویرایش یادداشت', delete: 'حذف یادداشت', phase: 'تغییر مرحله',
};

function Editor({ editor, board, pending, change, error, onClose }) {
  const { type, note, column, direction } = editor;
  const editingText = type === 'note' || type === 'edit';
  const destination = phaseKeys[phaseKeys.indexOf(board.phase) + (direction === 'previous' ? -1 : 1)];
  return <Dialog title={dialogTitles[type]} onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      if (editingText) fields.anonymous = fields.anonymous === 'on';
      if (await change(type, { ...fields, note: note?.id, column, direction, fromPhase: editor.phase })) onClose();
    }}>
      {editingText && <>
        <Field label={column ? columns[column].title : 'متن یادداشت'} name="text" multiline rows={4} maxLength={500} defaultValue={note?.text} required autoFocus />
        <Switch name="anonymous" defaultChecked={Boolean(note && !note.attribution)} aria-describedby="note-privacy-help">ثبت ناشناس</Switch>
        <p id="note-privacy-help" className="dialog__copy">با روشن کردن این سوییچ، نام و آواتارتان روی کارت نمایش داده نمی‌شود.</p>
      </>}
      {type === 'delete' && <p className="dialog__copy">این یادداشت از برد حذف می‌شود. آن را حذف کنیم؟</p>}
      {type === 'phase' && <p className="dialog__copy">{destination === 'done' ? 'جلسه پایان می‌یابد و نتایج برای تیم قابل مشاهده می‌مانند.' : `مرحلهٔ «${phases[destination]?.title}» برای همهٔ اعضا فعال می‌شود.`}</p>}
      {error && <p className="dialog__error" role="alert">{error}</p>}
      <div className="dialog__actions"><Button onClick={onClose}>انصراف</Button>
        <Button type="submit" variant={type === 'delete' ? 'danger' : 'primary'} disabled={pending}>{type === 'delete' ? 'حذف یادداشت' : 'تأیید'}</Button></div>
    </form>
  </Dialog>;
}

function Readiness({ board, pending, change }) {
  const readyMembers = board.roster.filter(member => member.ready);
  const ready = readyMembers.some(member => member.id === board.me.id);
  return <section className="readiness surface" aria-label="آمادگی اعضا">
    <div className="readiness__summary">
      <span className="stage__icon"><Icon name="users" /></span>
      <div>
        <h2>آمادگی اعضا</h2>
        <p role="status">{formatNumber(readyMembers.length)} از {formatNumber(board.roster.length)} نفر آماده‌اند</p>
      </div>
      {readyMembers.length > 0 && <ul className="readiness__avatars" aria-label="اعضای آماده">
        {readyMembers.map(member => <li key={member.id} title={member.name}>
          <Avatar id={member.avatar} name={member.name} />
          <span className="visually-hidden">{member.name}</span>
        </li>)}
      </ul>}
    </div>
    <div className="readiness__controls">
      <Switch checked={ready} aria-disabled={pending}
        onChange={event => {
          if (!pending) change('ready', { phase: board.phase, ready: event.target.checked });
        }}>آماده‌ام</Switch>
      {board.me.host && <Button variant="ghost" disabled={pending || !readyMembers.length}
        onClick={() => change('reset-ready', { phase: board.phase })}>بازنشانی آمادگی</Button>}
    </div>
  </section>;
}

export function Board({ board, pending, change, onShare, error }) {
  const [surveyOpen, setSurveyOpen] = useState(false);
  useEffect(() => {
    if (board.phase === 'done') setSurveyOpen(false);
    setEditor(null);
    setSourceId(null);
    setHovered(undefined);
  }, [board.phase]);
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState(false);
  const [sourceId, setSourceId] = useState(null);
  const [hovered, setHovered] = useState(undefined);
  const source = board.notes.find(note => note.id === sourceId);
  function select(note) {
    setSourceId(note?.id ?? null);
    setHovered(undefined);
  }
  function move(target) {
    if (!source || pending) return;
    select(null);
    change('group', { note: source.id, target });
  }
  const grouping = board.phase === 'group' && board.me.host ? {
    source, select, move,
    canDrop: (target, column) => Boolean(!pending && source && source.column === column && target !== source.id && target !== source.group),
    dropProps: target => ({
      'data-drop-target': true,
      'data-drop-active': hovered === target,
      onDragOver: event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setHovered(target);
      },
      onDragLeave: event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setHovered(undefined);
      },
      onDrop: event => {
        event.preventDefault();
        if (event.dataTransfer.getData('text/plain') === source?.id) move(target);
      },
    }),
  } : null;
  const current = phaseKeys.indexOf(board.phase);
  const next = phaseKeys[current + 1];
  const phase = phases[board.phase];
  function openEditor(data) {
    setEditorError(false);
    setEditor({ ...data, phase: board.phase });
  }
  return <main className="container board">
    <section className="board__hero">
      <div className="board__intro"><span className="board__eyebrow"><Icon name="logo" size={17} /> برد رتروسپکتیو</span><h1 dir="auto">{board.title}</h1></div>
      <div className="board__tools">
        {board.phase === 'done' && <RetroExport board={board} columns={columns} />}
        {board.survey && board.phase !== 'done' && <Button icon={board.survey.answers ? 'check' : 'survey'} onClick={() => setSurveyOpen(true)}>
          {board.survey.answers ? 'ویرایش پاسخ نظرسنجی' : 'نظرسنجی جلسه'}
        </Button>}
        <Button icon="link" onClick={onShare}>دعوت اعضا</Button>
      </div>
    </section>
    <ol className="stepper surface" aria-label="مراحل جلسه">
      {phaseKeys.map((key, index) => <li key={key} aria-current={index === current ? 'step' : undefined} data-completed={index < current}>
        <span className="stepper__icon"><Icon name={index < current ? 'check' : phases[key].icon} size={17} /></span>
        <span>{phases[key].title}</span>
      </li>)}
    </ol>
    <section className="stage" aria-label="مرحلهٔ جاری">
      <div className="stage__summary"><span className="stage__icon"><Icon name={phase.icon} size={22} /></span><div><h2>{phase.title}</h2><p>{grouping ? 'یک کارت را روی کارت یا گروه دیگری در همان ستون بکشید، یا کارت و مقصد را انتخاب کنید.' : phase.help}</p></div></div>
      <div className="stage__actions">
        {board.phase === 'vote' && <Badge tone="accent" icon="vote">{formatNumber(board.voteLimit - board.me.votes.length)} رأی باقی‌مانده</Badge>}
        {board.me.host && current > 0 && <Button disabled={pending} onClick={() => openEditor({ type: 'phase', direction: 'previous' })}>مرحلهٔ قبل</Button>}
        {board.me.host && next && <Button variant="primary" disabled={pending} onClick={() => openEditor({ type: 'phase' })}>{next === 'done' ? 'پایان جلسه' : 'رفتن به ' + phases[next].title}</Button>}
      </div>
    </section>
    <Countdown board={board} pending={pending} change={change} error={error} />
    <Readiness board={board} pending={pending} change={change} />
    <div className="lanes">{Object.keys(columns).map(column => <Lane key={column} column={column} board={board} edit={openEditor} change={change} pending={pending} grouping={grouping} />)}</div>
    {['actions', 'done'].includes(board.phase) && <Actions {...{ board, pending, change }} />}
    {board.survey?.results && <SurveyResults survey={board.survey} />}
    {surveyOpen && board.survey && board.phase !== 'done' && <SurveyForm survey={board.survey} pending={pending} change={change} error={error} onClose={() => setSurveyOpen(false)} />}
    {editor && editor.phase === board.phase && <Editor key={editor.type} editor={editor} board={board} pending={pending} change={async (...args) => {
      setEditorError(true);
      return change(...args);
    }} error={editorError && error} onClose={() => setEditor(null)} />}
  </main>;
}
