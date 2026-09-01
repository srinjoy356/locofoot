import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials in .env");
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("LocoFoot Phase 1 Verification Script (Realtime + DB bounds)");
  
  // Clean up old test users
  const { data: oldUsers } = await adminClient.auth.admin.listUsers();
  for (const u of oldUsers.users) {
    if (u.email?.includes("p1test")) {
      await adminClient.auth.admin.deleteUser(u.id);
    }
  }

  console.log("1. Creating Test Users (User A & User B)...");
  const aRes = await adminClient.auth.admin.createUser({
    email: "p1testA@example.com",
    password: "password123",
    email_confirm: true,
  });
  const bRes = await adminClient.auth.admin.createUser({
    email: "p1testB@example.com",
    password: "password123",
    email_confirm: true,
  });

  const userA = aRes.data.user;
  const userB = bRes.data.user;
  if (!userA || !userB) throw new Error("Failed to create users");

  // Create client A and client B
  const clientA = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const clientB = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  await clientA.auth.signInWithPassword({ email: "p1testA@example.com", password: "password123" });
  await clientB.auth.signInWithPassword({ email: "p1testB@example.com", password: "password123" });

  console.log("Waiting for users to be inserted into public.users...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Setting up Realtime Listeners...");
  let userBReceivedFriendReq = false;
  let userAReceivedFriendAcc = false;
  let userBReceivedDMNotification = false;
  let userBReceivedDMRealtime = false;

  await new Promise(resolve => {
    clientA.channel(`notifications:${userA.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p) => {
      if (p.new.type === 'FRIEND_ACCEPTED') userAReceivedFriendAcc = true;
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
    });
  });

  await new Promise(resolve => {
    clientB.channel(`notifications:${userB.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p) => {
      if (p.new.type === 'FRIEND_REQUEST') userBReceivedFriendReq = true;
      if (p.new.type === 'DM_RECEIVED') userBReceivedDMNotification = true;
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
    });
  });

  console.log("Waiting for Realtime to stabilize...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Test: Unique Code Generation & Search...");
  const { data: bData } = await adminClient.from("users").select("unique_code").eq("id", userB.id).single();
  if (!bData || !bData.unique_code) throw new Error("User B did not generate a unique_code");
  const userBCode = bData.unique_code;
  console.log(`-> PASS: User B was automatically assigned unique_code: ${userBCode}`);

  const { data: searchRes, error: searchErr } = await clientA.rpc("search_user_by_unique_code", { search_code: userBCode });
  if (searchErr) throw new Error("RPC search_user_by_unique_code failed: " + searchErr.message);
  if (!searchRes || searchRes.length === 0 || searchRes[0].id !== userB.id) {
    throw new Error("RPC search_user_by_unique_code did not return User B");
  }
  console.log(`-> PASS: User A successfully searched User B by unique_code`);

  console.log("Test: Duplicate Friendship Prevention...");
  await clientA.from("friendships").insert({ requester_id: userA.id, addressee_id: userB.id });
  const { error: dupErr } = await clientA.from("friendships").insert({ requester_id: userA.id, addressee_id: userB.id });
  if (!dupErr) throw new Error("Duplicate friendship was NOT prevented");
  console.log("-> PASS: Duplicate friendship prevented.");

  console.log("Waiting for FRIEND_REQUEST notification...");
  await new Promise(r => setTimeout(r, 1500));
  if (!userBReceivedFriendReq) throw new Error("User B did not receive FRIEND_REQUEST notification via triggers/realtime");
  console.log("-> PASS: User B received FRIEND_REQUEST realtime notification");

  console.log("Test: User B Accepts Friend Request...");
  await clientB.from("friendships").update({ status: 'ACCEPTED' }).eq('requester_id', userA.id).eq('addressee_id', userB.id);

  console.log("Waiting for FRIEND_ACCEPTED notification...");
  await new Promise(r => setTimeout(r, 1500));
  if (!userAReceivedFriendAcc) throw new Error("User A did not receive FRIEND_ACCEPTED notification");
  console.log("-> PASS: User A received FRIEND_ACCEPTED realtime notification");

  console.log("Test: DM Conversation Creation...");
  const { data: convId, error: convErr } = await clientA.rpc('get_or_create_direct_conversation', { target_user_id: userB.id });
  if (convErr) throw new Error(`DM Creation failed: ${convErr.message}`);
  console.log(`-> PASS: Conversation created: ${convId}`);

  // Test Duplicate DM
  const { data: convId2 } = await clientA.rpc('get_or_create_direct_conversation', { target_user_id: userB.id });
  if (convId !== convId2) throw new Error("Duplicate DM created!");
  console.log("-> PASS: Duplicate DM creation returns same canonical ID");

  await new Promise(resolve => {
    clientB.channel(`conversation:${convId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (p) => {
      userBReceivedDMRealtime = true;
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(true);
    });
  });

  console.log("Waiting for DM channel to stabilize...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Test: User A sends DM...");
  const { error: msgErr } = await clientA.from('messages').insert({ conversation_id: convId, sender_id: userA.id, body: "Hello B" });
  if (msgErr) throw new Error("Failed to insert message: " + msgErr.message);

  await new Promise(r => setTimeout(r, 1500));
  if (!userBReceivedDMRealtime) throw new Error("User B did not receive DM via realtime");
  if (!userBReceivedDMNotification) throw new Error("User B did not receive DM_RECEIVED notification");
  console.log("-> PASS: DM Realtime Delivery and Notification Triggers successful");

  console.log("Test: RLS prevents cross-user access...");
  const { data: bConvs } = await clientA.from("conversation_members").select("*").eq("user_id", userB.id);
  if (bConvs && bConvs.length > 0 && !bConvs.some(c => c.conversation_id === convId)) {
    throw new Error("User A can see User B's private conversations!");
  }
  console.log("-> PASS: RLS prevents cross-user conversation access");

  console.log("Test: User B marks conversation read...");
  await clientB.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", convId).eq("user_id", userB.id);
  const { data: checkRead } = await adminClient.from("conversation_members").select("last_read_at").eq("conversation_id", convId).eq("user_id", userB.id).single();
  if (!checkRead || !checkRead.last_read_at) throw new Error("last_read_at did not update");
  console.log("-> PASS: last_read_at updated successfully");

  console.log("Test: Blocking prevents prohibited communication...");
  // User B blocks User A
  await clientB.from("blocks").insert({ blocker_id: userB.id, blocked_id: userA.id });
  
  // Ensure friendship is BLOCKED
  const { data: fCheck } = await adminClient.from("friendships").select("status").eq("requester_id", userA.id).eq("addressee_id", userB.id).single();
  if (fCheck?.status !== 'BLOCKED') throw new Error(`Friendship was not set to BLOCKED. Status: ${fCheck?.status}`);
  console.log("-> PASS: Friendship automatically updated to BLOCKED");

  // User A tries to send a message
  const { error: blockMsgErr } = await clientA.from('messages').insert({ conversation_id: convId, sender_id: userA.id, body: "Are you there?" });
  if (!blockMsgErr) throw new Error("User A was able to send a message while blocked!");
  console.log("-> PASS: Blocked user prevented from sending message");

  console.log("\nALL PHASE 1 TESTS PASSED SUCCESSFULLY! 🚀");
  process.exit(0);
}

run().catch(e => {
  console.error("Test Failed: ", e);
  process.exit(1);
});
