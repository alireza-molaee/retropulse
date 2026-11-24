import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { findAvatar } from './avatars.js';
import { reactions } from './reactions.js';
import { surveyLimits } from './surveys.js';

export const phases = ['write', 'group', 'vote', 'actions', 'done'];
const columns = ['good', 'hard', 'try'];
const defaultVoteLimit = 3;
const discussionPhases = new Set(['group', 'vote', 'actions']);
const token = () => randomBytes(24).toString('hex');
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/create', ['index.html', 'text/html']],
  ['/app.js', ['../dist/app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
  ['/tokens.css', ['tokens.css', 'text/css']],
  ['/theme.js', ['theme.js', 'text/javascript']],
  ['/avatars.png', ['avatars.png', 'image/png']],
  ['/fonts/SGKara-FaNum-Light.ttf', ['fonts/SGKara-FaNum-Light.ttf', 'font/ttf']],
]);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function field(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    fail('مقدار واردشده معتبر نیست.');
  }
  return value.trim();
}

function createMember({ name, avatar }) {
  if (avatar !== undefined && !findAvatar(avatar)) fail('آواتار انتخاب‌شده معتبر نیست.');
  return { id: randomUUID(), name: field(name, 80), avatar: avatar ?? null, secret: token(), votes: [] };
}

function noteAnonymity(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail('وضعیت ناشناس بودن معتبر نیست.');
  return value;
}

async function readBody(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32768) fail('درخواست بیش از حد بزرگ است.', 413);
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks)); }
  catch { fail('درخواست معتبر نیست.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('درخواست معتبر نیست.');
  return body;
}

function dissolveSmallGroup(board, id) {
  if (!id) return;
  const cards = board.notes.filter(card => card.group === id);
  if (cards.length >= 2) return;
  if (cards.length) cards[0].group = null;
  board.groups = board.groups.filter(group => group.id !== id);
}

function createSurvey(questions) {
  if (questions === undefined) return null;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > surveyLimits.questions) {
    fail('نظرسنجی باید بین یک تا هشت سؤال داشته باشد.');
  }
  return {
    questions: questions.map(question => {
      if (!Array.isArray(question?.options) || question.options.length < 2 || question.options.length > surveyLimits.options) {
        fail('برای هر سؤال بین دو تا شش گزینه وارد کنید.');
      }
      const options = question.options.map(option => field(option, surveyLimits.optionLength));
      if (new Set(options).size !== options.length) fail('گزینه‌های هر سؤال باید متفاوت باشند.');
      return { text: field(question.text, surveyLimits.questionLength), options };
    }),
    responses: {},
  };
}

function surveyView(board, member) {
  if (!board.survey) return null;
  const { questions, responses } = board.survey;
  const submitted = board.phase === 'done' ? Object.values(responses) : null;
  return {
    questions,
    answers: responses[member.id] ?? null,
    results: submitted && {
      respondents: submitted.length,
      counts: questions.map((question, index) => {
        const counts = question.options.map(() => 0);
        for (const answer of submitted) counts[answer[index]]++;
        return counts;
      }),
    },
  };
}

function change(board, body, member) {
  const host = member.secret === board.host;
  const note = board.notes.find(item => item.id === body.note);
  const phase = phases.indexOf(board.phase);
  switch (body.type) {
    case 'phase': {
      if (body.fromPhase !== undefined && body.fromPhase !== board.phase) fail('مرحله تغییر کرده است. دوباره تلاش کنید.', 409);
      const direction = body.direction ?? 'next';
      if (direction !== 'previous' && direction !== 'next') fail('جهت تغییر مرحله معتبر نیست.');
      const destination = phases[phase + (direction === 'previous' ? -1 : 1)];
      if (!host || !destination) fail('تغییر مرحله مجاز نیست.', 403);
      board.phase = destination;
      for (const person of board.members) person.ready = false;
      if (destination === 'vote') {
        const targets = new Set([...board.notes.filter(card => !card.group), ...board.groups].map(item => item.id));
        for (const voter of board.members) voter.votes = voter.votes.filter(target => targets.has(target));
      }
      break;
    }
    case 'ready':
      if (body.phase !== board.phase) fail('مرحله تغییر کرده است. دوباره تلاش کنید.', 409);
      if (typeof body.ready !== 'boolean') fail('وضعیت آمادگی معتبر نیست.');
      member.ready = body.ready;
      break;
    case 'survey-response':
      if (!board.survey || board.phase === 'done') fail('ثبت پاسخ نظرسنجی در این مرحله مجاز نیست.', 403);
      if (!Array.isArray(body.answers) || body.answers.length !== board.survey.questions.length ||
        body.answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= board.survey.questions[index].options.length)) {
        fail('برای هر سؤال یک گزینه معتبر انتخاب کنید.');
      }
      board.survey.responses[member.id] = body.answers;
      break;
    case 'start-timer':
      if (!host) fail('فقط میزبان می‌تواند تایمر را شروع کند.', 403);
      if (!Number.isInteger(body.seconds) || body.seconds < 1 || body.seconds > 359999) {
        fail('مدت تایمر باید بین یک ثانیه و ۹۹ ساعت و ۵۹ دقیقه و ۵۹ ثانیه باشد.');
      }
      board.timer = { seconds: body.seconds, endsAt: Date.now() + body.seconds * 1000 };
      break;
    case 'reset-timer':
      if (!host) fail('فقط میزبان می‌تواند تایمر را بازنشانی کند.', 403);
      if (board.timer) board.timer.endsAt = null;
      break;
    case 'reset-ready':
      if (!host) fail('فقط میزبان می‌تواند آمادگی اعضا را بازنشانی کند.', 403);
      if (body.phase !== board.phase) fail('مرحله تغییر کرده است. دوباره تلاش کنید.', 409);
      for (const person of board.members) person.ready = false;
      break;
    case 'note':
      if (board.phase !== 'write' || !columns.includes(body.column)) fail('ثبت یادداشت در این مرحله مجاز نیست.');
      board.notes.push({ id: randomUUID(), column: body.column, text: field(body.text, 500), author: member.id, anonymous: noteAnonymity(body.anonymous), group: null });
      break;
    case 'edit':
    case 'delete':
      if (board.phase !== 'write' || note?.author !== member.id) fail('تغییر یادداشت مجاز نیست.', 403);
      if (body.type === 'edit') {
        note.text = field(body.text, 500);
        note.anonymous = noteAnonymity(body.anonymous, note.anonymous ?? true);
      } else {
        board.notes = board.notes.filter(item => item !== note);
        dissolveSmallGroup(board, note.group);
      }
      break;
    case 'comment':
      if (!note || !discussionPhases.has(board.phase)) fail('ثبت کامنت در این مرحله مجاز نیست.', 403);
      (note.comments ??= []).push({
        id: randomUUID(),
        text: field(body.text, 500),
        author: noteAnonymity(body.anonymous) ? null : member.id,
      });
      break;
    case 'reaction': {
      if (!note || !discussionPhases.has(board.phase)) fail('واکنش در این مرحله مجاز نیست.', 403);
      if (!reactions.some(item => item.emoji === body.emoji) || typeof body.active !== 'boolean') fail('واکنش معتبر نیست.');
      note.reactions ??= {};
      const members = new Set(note.reactions[body.emoji]);
      if (body.active) members.add(member.id);
      else members.delete(member.id);
      note.reactions[body.emoji] = [...members];
      break;
    }
    case 'group': {
      if (!host || board.phase !== 'group' || !note) fail('گروه‌بندی مجاز نیست.', 403);
      const previous = note.group;
      if (body.target === null) {
        note.group = null;
      } else {
        const targetNote = board.notes.find(item => item.id === body.target);
        let group = board.groups.find(item => item.id === (targetNote?.group ?? body.target));
        if (targetNote === note || (targetNote?.column ?? group?.column) !== note.column) {
          fail('کارت را روی کارت یا گروه دیگری در همان ستون رها کنید.');
        }
        if (!group) {
          group = { id: randomUUID(), column: note.column };
          board.groups.push(group);
          targetNote.group = group.id;
        }
        note.group = group.id;
      }
      if (previous !== note.group) dissolveSmallGroup(board, previous);
      break;
    }
    case 'vote':
    case 'unvote': {
      const target = board.notes.some(item => item.id === body.target && !item.group)
        || board.groups.some(item => item.id === body.target);
      if (board.phase !== 'vote' || !target) fail('رأی‌گیری برای این مورد فعال نیست.');
      if (body.type === 'vote') {
        if (member.votes.length >= (board.voteLimit ?? defaultVoteLimit)) fail('سهم رأی شما تمام شده است.');
        member.votes.push(body.target);
      } else {
        const index = member.votes.indexOf(body.target);
        if (index !== -1) member.votes.splice(index, 1);
      }
      break;
    }
    case 'action': {
      if (!host || board.phase !== 'actions') fail('ثبت اقدام مجاز نیست.', 403);
      const owner = board.members.find(person => person.id === body.ownerId);
      if (!owner) fail('مسئول اقدام را از اعضای جلسه انتخاب کنید.');
      if (typeof body.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due)
        || !Number.isFinite(Date.parse(body.due)) || new Date(body.due).toISOString().slice(0, 10) !== body.due) {
        fail('تاریخ اقدام معتبر نیست.');
      }
      board.actions.push({ id: randomUUID(), text: field(body.text, 500), ownerId: owner.id, owner: owner.name, due: body.due });
      break;
    }
    default:
      fail('نوع عملیات معتبر نیست.');
  }
}

function view(board, member) {
  const visibleNotes = board.phase === 'write' ? board.notes.filter(item => item.author === member.id) : board.notes;
  function attribution(author) {
    const writer = board.members.find(person => person.id === author);
    return writer ? { name: writer.name, avatar: writer.avatar ?? null } : null;
  }
  const notes = visibleNotes.map(note => ({
    id: note.id, column: note.column, text: note.text, group: note.group,
    attribution: note.anonymous === false ? attribution(note.author) : null,
    comments: board.phase === 'write' ? [] : (note.comments ?? []).map(comment => ({
      id: comment.id, text: comment.text, attribution: attribution(comment.author),
    })),
    reactions: board.phase === 'write' ? [] : reactions.flatMap(({ emoji }) => {
      const members = note.reactions?.[emoji] ?? [];
      return members.length ? [{ emoji, count: members.length, active: members.includes(member.id) }] : [];
    }),
  }));
  const totals = {};
  if (['actions', 'done'].includes(board.phase)) {
    for (const voter of board.members) {
      for (const id of voter.votes) totals[id] = (totals[id] ?? 0) + 1;
    }
  }
  return {
    title: board.title, phase: board.phase, notes, groups: board.groups, actions: board.actions,
    totals, participants: board.members.length, voteLimit: board.voteLimit ?? defaultVoteLimit,
    timer: board.timer ?? null, serverNow: Date.now(),
    survey: surveyView(board, member),
    roster: board.members.map(person => ({ id: person.id, name: person.name, avatar: person.avatar ?? null, ready: person.ready ?? false })),
    me: { id: member.id, name: member.name, avatar: member.avatar ?? null, host: member.secret === board.host, votes: member.votes },
  };
}

export function createApp(dbPath = 'data/retro.sqlite') {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, state TEXT NOT NULL)');
  const get = db.prepare('SELECT state FROM boards WHERE id = ?');
  const insert = db.prepare('INSERT INTO boards VALUES (?, ?)');
  const update = db.prepare('UPDATE boards SET state = ? WHERE id = ?');
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        const contents = await readFile(new URL('./public/' + file, import.meta.url));
        res.writeHead(200, {
          'Content-Type': type.startsWith('text/') ? type + '; charset=utf-8' : type,
          'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          'Referrer-Policy': 'no-referrer',
        });
        return res.end(contents);
      }
      const body = req.method === 'POST' ? await readBody(req) : null;
      if (req.method === 'POST' && path === '/api/boards') {
        const voteLimit = body.voteLimit === undefined ? defaultVoteLimit : body.voteLimit;
        if (!Number.isSafeInteger(voteLimit) || voteLimit < 1) fail('سهم رأی هر نفر باید یک عدد صحیح مثبت باشد.');
        const member = createMember(body);
        const id = token();
        const board = { title: field(body.title, 120), host: member.secret, phase: 'write', voteLimit, survey: createSurvey(body.survey), members: [member], notes: [], groups: [], actions: [] };
        insert.run(id, JSON.stringify(board));
        return json(201, { id, secret: member.secret, board: view(board, member) });
      }
      const match = /^\/api\/boards\/([a-f0-9]{48})(?:\/(join|change))?$/.exec(path);
      if (!match) fail('صفحه پیدا نشد.', 404);
      const [, id, operation] = match;
      const row = get.get(id);
      if (!row) fail('برد پیدا نشد. لینک دعوت را بررسی کنید.', 404);
      const board = JSON.parse(row.state);
      if (req.method === 'POST' && operation === 'join') {
        const member = createMember(body);
        board.members.push(member);
        update.run(JSON.stringify(board), id);
        return json(201, { id, secret: member.secret, board: view(board, member) });
      }
      const member = board.members.find(item => 'Bearer ' + item.secret === req.headers.authorization);
      if (!member) fail('برای دیدن برد وارد شوید.', 401);
      if (req.method === 'GET' && !operation) return json(200, view(board, member));
      if (req.method === 'POST' && operation === 'change') {
        change(board, body, member);
        update.run(JSON.stringify(board), id);
        return json(200, view(board, member));
      }
      fail('مسیر پیدا نشد.', 404);
    } catch (error) {
      if (!error.status) console.error(error);
      json(error.status ?? 500, { error: error.status ? error.message : 'خطای سرور. دوباره تلاش کنید.' });
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp().listen(port, process.env.HOST || '127.0.0.1', () => console.log('RetroPulse · http://localhost:' + port));
  const stop = () => server.close();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
