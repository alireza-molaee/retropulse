import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createApp } from '../server.js';
import { avatars, findAvatar } from '../avatars.js';
import { reactions } from '../reactions.js';
import { surveyLimits, surveyTemplates } from '../surveys.js';

test('avatar, reaction and survey catalogs fit the supported UI and API', () => {
  assert.equal(avatars.length, 48);
  for (const avatar of avatars) assert.equal(findAvatar(avatar.id), avatar);
  assert.equal(new Set(avatars.map(item => item.row + '-' + item.column)).size, 48);
  assert.equal(new Set(reactions.map(item => item.emoji)).size, 15);
  assert.equal(surveyTemplates.length, 3);
  for (const template of surveyTemplates) {
    assert.ok(template.questions.length && template.questions.length <= surveyLimits.questions);
    for (const question of template.questions) {
      assert.ok(question.options.length >= 2 && question.options.length <= surveyLimits.options);
      assert.equal(new Set(question.options).size, question.options.length);
    }
  }
});

test('boards from before avatars, anonymity settings and surveys retain their original defaults', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'retro-legacy-'));
  const file = join(folder, 'retro.sqlite');
  const db = new DatabaseSync(file);
  const id = 'a'.repeat(48);
  const member = { id: 'm1', name: 'Host', secret: 'test-host', votes: [] };
  db.exec('CREATE TABLE boards (id TEXT PRIMARY KEY, state TEXT NOT NULL)');
  db.prepare('INSERT INTO boards VALUES (?, ?)').run(id, JSON.stringify({
    title: 'Legacy', phase: 'actions', host: member.secret, members: [member], groups: [],
    notes: [{ id: 'n1', text: 'Private author', author: member.id, column: 'good', group: null }],
    actions: [{ id: 'a1', text: 'Follow up', owner: 'Original name', due: '2026-11-30' }],
  }));
  db.close();
  const server = createApp(file).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const res = await fetch(base + '/api/boards/' + id, { headers: { Authorization: 'Bearer test-host' } });
  assert.equal(res.status, 200);
  const board = await res.json();
  assert.equal(board.me.avatar, null);
  assert.equal(board.roster[0].ready, false);
  assert.equal(board.notes[0].attribution, null);
  assert.deepEqual(board.notes[0].comments, []);
  assert.deepEqual(board.notes[0].reactions, []);
  assert.equal(board.actions[0].owner, 'Original name');
  assert.equal(board.voteLimit, 3);
  assert.equal(board.survey, null);
  assert.equal(board.timer, null);
  for (const body of ['[]', 'null', '{']) {
    const response = await fetch(base + '/api/boards', { method: 'POST', body });
    assert.equal(response.status, 400);
  }
  for (const [path, mime] of [['/theme.js', 'text/javascript'], ['/tokens.css', 'text/css'], ['/avatars.png', 'image/png'], ['/fonts/SGKara-FaNum-Light.ttf', 'font/ttf']]) {
    const asset = await fetch(base + path);
    assert.equal(asset.status, 200);
    assert.ok(asset.headers.get('content-type').startsWith(mime));
    assert.ok((await asset.arrayBuffer()).byteLength);
  }
});
