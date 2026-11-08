#!/usr/bin/env node
/**
 * Proves every realtime subscription the web app relies on actually delivers, and that RLS keeps private rows private.
 * Runs against a LOCAL Supabase only:  node scripts/realtime-check.cjs   (env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * Needs one seeded event with a match (scripts/test-api-local.sh style env). Creates and removes its own users.
 */
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'apps', 'web', 'node_modules', '@supabase', 'supabase-js'));

const URL = process.env.SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !URL.includes('127.0.0.1')) { console.error('refusing to run against a non-local Supabase'); process.exit(2); }

const admin = createClient(URL, SERVICE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function userClient(email) {
  const { data } = await admin.auth.admin.createUser({ email, password: 'TestPassword123!', email_confirm: true });
  const c = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
  const { error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error) throw error;
  c.realtime.setAuth((await c.auth.getSession()).data.session.access_token);
  return { id: data.user.id, client: c };
}

/** subscribe, run `mutate`, expect (or, for negatives, not expect) a payload within the window */
async function check(name, client, spec, mutate, { expect = true, window = 4000 } = {}) {
  let got = null;
  const channel = client.channel(`rt-${Math.random().toString(36).slice(2)}`);
  channel.on('postgres_changes', spec, (p) => { got = p; });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('subscribe timeout')), 8000);
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); } });
  });
  await sleep(400);
  const res = await mutate();
  if (res && res.error) console.log('   mutation error:', res.error.message);
  const until = Date.now() + (expect ? window : 2500);
  while (Date.now() < until && !(expect && got)) await sleep(100);
  await client.removeChannel(channel);
  const ok = expect ? !!got : !got;
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

(async () => {
  const stamp = Date.now();
  const anon = createClient(URL, ANON);
  const A = await userClient(`rt_a_${stamp}@example.com`);
  const B = await userClient(`rt_b_${stamp}@example.com`);
  const C = await userClient(`rt_c_${stamp}@example.com`);

  // its own throwaway event, so it runs on an empty database (CI) as well as a seeded one
  const { data: ev } = await admin.from('events').insert({ name: `TEST__RT__${stamp}`, description: 'realtime check', organizer_id: A.id, status: 'LIVE', public_token: crypto.randomUUID() }).select().single();
  const regs = [];
  for (const n of ['RT Home', 'RT Away']) {
    const { data } = await admin.from('event_team_registrations').insert({ event_id: ev.id, team_name: n, status: 'APPROVED', captain_id: A.id }).select().single();
    regs.push(data);
  }
  const { data: player } = await admin.from('event_team_players').insert({ event_registration_id: regs[0].id, guest_name: 'RT Player', status: 'APPROVED' }).select().single();
  const { data: match } = await admin.from('matches').insert({ event_id: ev.id, home_registration_id: regs[0].id, away_registration_id: regs[1].id, scheduling_status: 'ASSIGNED' }).select().single();
  const touch = (v) => admin.from('matches').update({ metadata: { rt: v } }).eq('id', match.id);
  let lineupBefore = null, lineupInserted = false;

  try {
    await check('matches UPDATE by id (match page, clock)', anon, { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, () => touch(1));
    await check('matches * by event_id (schedule, command centre, bracket)', anon, { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${match.event_id}` }, () => touch(2));
    await check('events UPDATE (status banner, broadcast state)', anon, { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${ev.id}` }, () => admin.from('events').update({ name: ev.name }).eq('id', ev.id));

    const tl = { id: crypto.randomUUID(), match_id: match.id, event_type: 'PASS', period: 'FIRST_HALF', elapsed_seconds: 5, display_minute: 0, display_second: 5, actor_player_id: player.id, actor_registration_id: match.home_registration_id, metadata: {} };
    await check('match_timeline_events INSERT (live pitch + feed)', anon, { event: 'INSERT', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${match.id}` }, () => admin.from('match_timeline_events').insert(tl));
    await check('match_timeline_events UPDATE (corrections)', anon, { event: 'UPDATE', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${match.id}` }, () => admin.from('match_timeline_events').update({ metadata: { fixed: true } }).eq('id', tl.id));
    await check('match_timeline_events DELETE (undo)', anon, { event: 'DELETE', schema: 'public', table: 'match_timeline_events' }, () => admin.from('match_timeline_events').delete().eq('id', tl.id));

    const ref = { id: crypto.randomUUID(), match_id: match.id, event_type: 'FOUL', period: 'FIRST_HALF', elapsed_seconds: 9, display_minute: 0, display_second: 9, event_player_id: player.id, event_registration_id: match.home_registration_id, metadata: {} };
    await check('referee_events INSERT (cards, fouls, penalties)', anon, { event: 'INSERT', schema: 'public', table: 'referee_events', filter: `match_id=eq.${match.id}` }, () => admin.from('referee_events').insert(ref));
    await check('match_participation * (subs, send-offs)', anon, { event: '*', schema: 'public', table: 'match_participation', filter: `match_id=eq.${match.id}` },
      () => admin.from('match_participation').insert({ match_id: match.id, event_player_id: player.id, event_registration_id: match.home_registration_id, status: 'STARTER', entry_elapsed_seconds: 0 }));
    await check('match_lineups * (lineup status)', anon, { event: '*', schema: 'public', table: 'match_lineups', filter: `match_id=eq.${match.id}` },
      async () => {
        // reuse an existing lineup row (one per team and match), flipping its status
        const { data: row } = await admin.from('match_lineups').select('id, status').eq('match_id', match.id).eq('team_registration_id', match.home_registration_id).maybeSingle();
        if (row) { lineupBefore = row; return admin.from('match_lineups').update({ status: row.status === 'SUBMITTED' ? 'MODIFIED' : 'SUBMITTED' }).eq('id', row.id); }
        lineupInserted = true;
        return admin.from('match_lineups').insert({ match_id: match.id, team_registration_id: match.home_registration_id, status: 'SUBMITTED' });
      });
    await check('event_announcements INSERT (emergency banner)', anon, { event: 'INSERT', schema: 'public', table: 'event_announcements' },
      () => admin.from('event_announcements').insert({ event_id: ev.id, author_id: A.id, message: 'rt-check', is_emergency: false }));

    // private data: the owner receives it, a stranger does not
    await check('notifications INSERT reaches its owner', A.client, { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${A.id}` },
      () => admin.from('notifications').insert({ user_id: A.id, type: 'FRIEND_REQUEST', payload: {} }));
    await check('notifications are NOT delivered to another user', C.client, { event: 'INSERT', schema: 'public', table: 'notifications' },
      () => admin.from('notifications').insert({ user_id: A.id, type: 'FRIEND_REQUEST', payload: {} }), { expect: false });

    await check('friendships * reaches both parties', B.client, { event: '*', schema: 'public', table: 'friendships' },
      () => admin.from('friendships').insert({ requester_id: A.id, addressee_id: B.id, status: 'PENDING' }));
    await check('friendships are NOT delivered to a stranger', C.client, { event: '*', schema: 'public', table: 'friendships' },
      () => admin.from('friendships').update({ status: 'ACCEPTED' }).eq('requester_id', A.id), { expect: false });

    const { data: conv } = await admin.from('conversations').insert({ is_group: false }).select().single();
    await admin.from('conversation_members').insert([{ conversation_id: conv.id, user_id: A.id }, { conversation_id: conv.id, user_id: B.id }]);
    const say = () => admin.from('messages').insert({ conversation_id: conv.id, sender_id: A.id, body: 'hi' });
    await check('messages INSERT reaches a conversation member', B.client, { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, say);
    await check('messages are NOT delivered to a non-member', C.client, { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, say, { expect: false });

    // extra tables used by newer features, skipped when the migration is absent
    const { error: betErr } = await admin.from('bet_markets').select('id').limit(1);
    if (!betErr) {
      await check('bet_markets * (live betting board)', anon, { event: '*', schema: 'public', table: 'bet_markets' },
        () => admin.from('bet_markets').insert({ event_id: ev.id, match_id: match.id, kind: 'RT_TEST', params: { goal_no: 99 } }));
      await admin.from('bet_markets').delete().eq('kind', 'RT_TEST');
    }
  } finally {
    await admin.from('events').delete().eq('id', ev.id);
    await admin.from('event_announcements').delete().eq('message', 'rt-check');
    for (const u of [A, B, C]) await admin.auth.admin.deleteUser(u.id);
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} realtime checks passed`);
    process.exit(failed.length ? 1 : 0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
