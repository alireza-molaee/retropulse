import React, { useState } from 'react';
import { Button, Dialog, Field } from './design-system.jsx';

const number = new Intl.NumberFormat('fa').format;
const percent = new Intl.NumberFormat('fa', { style: 'percent', maximumFractionDigits: 1 }).format;
const writer = item => item.attribution?.name ?? 'ناشناس';

function buildReport(board, columns) {
  const blocks = [];
  const add = (tag, text, indent = '') => blocks.push({ tag, text, indent });
  const votes = id => number(board.totals[id] ?? 0) + ' رأی';
  function addCard(note, grouped = false) {
    const indent = grouped ? '  ' : '';
    const attribution = [writer(note), !grouped && votes(note.id)].filter(Boolean).join(' · ');
    add('p', '• ' + note.text, indent);
    add('p', attribution, indent + '  ');
    if (note.reactions.length) {
      const reactions = note.reactions.map(reaction => reaction.emoji + ' ' + number(reaction.count));
      add('p', 'واکنش‌ها — ' + reactions.join(' · '), indent + '  ');
    }
    for (const comment of note.comments) {
      add('p', '◦ کامنت از ' + writer(comment) + ' — ' + comment.text, indent + '  ');
    }
  }

  add('h1', board.title);
  add('p', 'گزارش رتروسپکتیو · ' + number(board.participants) + ' عضو');
  add('h2', 'کارت‌ها و گفت‌وگوها');
  for (const [column, { title }] of Object.entries(columns)) {
    add('h3', title);
    const notes = board.notes.filter(note => note.column === column);
    if (!notes.length) add('p', 'یادداشتی ثبت نشده است.');
    const groups = board.groups.filter(group => group.column === column);
    for (const group of groups) {
      const cards = notes.filter(note => note.group === group.id);
      if (!cards.length) continue;
      add('h4', 'گروه ' + number(cards.length) + ' کارت · ' + votes(group.id));
      for (const card of cards) addCard(card, true);
    }
    for (const note of notes.filter(item => !item.group)) addCard(note);
  }

  if (board.survey?.results) {
    const { respondents, counts } = board.survey.results;
    add('h2', 'نتایج نظرسنجی');
    add('p', number(respondents) + ' پاسخ‌دهنده');
    board.survey.questions.forEach((question, index) => {
      add('h3', question.text);
      question.options.forEach((option, key) => {
        const count = counts[index][key];
        add('p', '• ' + option + ' — ' + number(count) + ' رأی · ' + percent(respondents ? count / respondents : 0));
      });
    });
  }

  add('h2', 'اقدام‌های تعریف‌شده');
  if (!board.actions.length) add('p', 'اقدامی ثبت نشده است.');
  for (const action of board.actions) {
    add('p', '• ' + action.text);
    add('p', 'مسئول — ' + action.owner + ' · مهلت — ' + action.due, '  ');
  }

  const html = document.createElement('div');
  html.dir = 'rtl';
  for (const { tag, text } of blocks) {
    const element = document.createElement(tag);
    text.split(/\r?\n/).forEach((line, index) => {
      if (index) element.append(document.createElement('br'));
      element.append(line);
    });
    html.append(element);
  }
  const text = blocks.map(({ tag, text, indent }, index) => {
    const separator = index && tag !== 'p' ? '\n' : '';
    return separator + text.split(/\r?\n/).map(line => indent + line).join('\n');
  }).join('\n');
  return { text, html: html.outerHTML };
}

async function copyReport({ text, html }) {
  if (navigator.clipboard?.write && typeof ClipboardItem === 'function') {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
      return;
    } catch {
      // Some browsers accept plain text without rich clipboard access.
    }
  }
  await navigator.clipboard.writeText(text);
}

export function RetroExport({ board, columns }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState('');
  return <div className="retro-export">
    <Button icon={copied ? 'check' : 'copy'} variant="primary" onClick={async () => {
      const report = buildReport(board, columns);
      setCopied(false);
      try {
        await copyReport(report);
        setCopied(true);
      } catch {
        setFallback(report.text);
      }
    }}>کپی خلاصه برای Confluence</Button>
    <span className={copied ? 'retro-export__status' : 'visually-hidden'} role="status">{copied ? 'در کلیپ‌بورد کپی شد.' : ''}</span>
    {fallback && <Dialog title="متن گزارش جلسه" onClose={() => setFallback('')}>
      <Field label="متن را انتخاب و کپی کنید" multiline rows={12} readOnly value={fallback} autoFocus onFocus={event => event.target.select()} />
    </Dialog>}
  </div>;
}
