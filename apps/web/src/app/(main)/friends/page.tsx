"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, FriendshipStatus } from "@locofoot/shared-types";

export default function FriendsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentUser, setCurrentUser] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [friendships, setFriendships] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const supabase = createClient();

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUser(session.user);

    const { data: fData } = await supabase
      .from("friendships")
      .select(`*, requester:users!requester_id(*), addressee:users!addressee_id(*)`)
      .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);
    
    setFriendships(fData || []);

    const { data: bData } = await supabase
      .from("blocks")
      .select(`*, blocked:users!blocked_id(*)`)
      .eq("blocker_id", session.user.id);
      
    setBlockedUsers(bData || []);
  };

  useEffect(() => {
    loadData();
    // Check for add parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const addCode = urlParams.get('add');
    if (addCode && !searchQuery) {
      setSearchQuery(addCode);
      // We can't safely call handleSearch immediately because it requires an event, 
      // so we'll just do a manual search
      supabase.rpc("search_user_by_unique_code", { search_code: addCode }).then(({ data }) => {
        setSearchResults((data as unknown as User[]) || []);
      });
    }

    const channel = supabase
      .channel('public:friendships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    // Use RPC to search securely by exact unique code
    const { data } = await supabase.rpc("search_user_by_unique_code", { search_code: searchQuery });
    
    setSearchResults((data as unknown as User[]) || []);
  };

  const sendRequest = async (userId: string) => {
    if (!currentUser) return;
    
    // Use the RPC which gracefully handles canceled/rejected previous relationships
    const { error } = await supabase.rpc("send_friend_request", { target_user_id: userId });
    
    if (!error) loadData();
    else alert(error.message);
  };

  const updateStatus = async (id: string, status: FriendshipStatus) => {
    const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
    if (!error) loadData();
    else alert(error.message);
  };

  const handleMessage = async (userId: string) => {
    const { data: convId, error } = await supabase.rpc("get_or_create_direct_conversation", { target_user_id: userId });
    if (error) {
      alert("Failed to start conversation: " + error.message);
      return;
    }
    // Need to navigate, so we'll just use window.location or next/navigation
    window.location.href = `/messages/${convId}`;
  };

  const handleBlock = async (userId: string) => {
    if (!confirm("Are you sure you want to block this user?")) return;
    const { error } = await supabase.from("blocks").insert({ blocker_id: currentUser.id, blocked_id: userId });
    if (error) {
      alert("Failed to block user: " + error.message);
    } else {
      loadData();
    }
  };

  if (!currentUser) return <div className="p-10">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Friends</h1>
        
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input 
            className="border p-2 rounded flex-1" 
            placeholder="Search by exact unique code (e.g. FTB-X8K29Q)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Search</button>
        </form>

        {searchResults.length > 0 && (
          <div className="mb-8 p-4 border rounded bg-slate-50 dark:bg-zinc-900/50">
            <h2 className="font-semibold mb-2">Search Results</h2>
            <ul className="space-y-2">
              {searchResults.map(u => (
                <li key={u.id} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 border rounded">
                  <span>{u.display_name || u.username || u.unique_code}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => sendRequest(u.id)}
                      className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      Add Friend
                    </button>
                    <button 
                      onClick={() => handleBlock(u.id)}
                      className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Block
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">My Friends</h2>
          <ul className="space-y-2">
            {friendships.filter(f => f.status === 'ACCEPTED').map(f => {
              const friend = f.requester_id === currentUser.id ? f.addressee : f.requester;
              return (
                <li key={f.id} className="flex justify-between items-center border p-3 rounded">
                  <span>{friend.display_name || friend.username || friend.unique_code}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleMessage(friend.id)} className="text-blue-600 text-sm hover:underline font-semibold border border-blue-600 rounded px-2">Message</button>
                    <button onClick={() => updateStatus(f.id, FriendshipStatus.CANCELLED)} className="text-red-500 text-sm hover:underline">Remove</button>
                    <button onClick={() => handleBlock(friend.id)} className="text-red-700 text-sm hover:underline ml-2">Block</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Pending Requests</h2>
          <h3 className="font-semibold text-slate-600 dark:text-zinc-400 mt-4 mb-2">Incoming</h3>
          <ul className="space-y-2 mb-4">
            {friendships.filter(f => f.status === 'PENDING' && f.addressee_id === currentUser.id).map(f => (
              <li key={f.id} className="flex justify-between items-center border p-3 rounded bg-blue-50 dark:bg-blue-950/20">
                <span>{f.requester.display_name || f.requester.username || f.requester.unique_code}</span>
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(f.id, FriendshipStatus.ACCEPTED)} className="text-green-600 text-sm font-semibold">Accept</button>
                  <button onClick={() => updateStatus(f.id, FriendshipStatus.REJECTED)} className="text-red-600 text-sm font-semibold">Reject</button>
                </div>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold text-slate-600 dark:text-zinc-400 mb-2">Outgoing</h3>
          <ul className="space-y-2">
            {friendships.filter(f => f.status === 'PENDING' && f.requester_id === currentUser.id).map(f => (
              <li key={f.id} className="flex justify-between items-center border p-3 rounded">
                <span>{f.addressee.display_name || f.addressee.username || f.addressee.unique_code}</span>
                <button onClick={() => updateStatus(f.id, FriendshipStatus.CANCELLED)} className="text-slate-500 dark:text-zinc-400 text-sm hover:underline">Cancel</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Blocked Users</h2>
        <ul className="space-y-2 max-w-md">
          {blockedUsers.map(b => {
            return (
              <li key={b.id} className="flex justify-between items-center border p-3 rounded bg-red-50 dark:bg-red-950/20">
                <span>{b.blocked.display_name || b.blocked.username || b.blocked.unique_code}</span>
                <button 
                  onClick={async () => {
                    if (!confirm("Unblock this user?")) return;
                    
                    // Delete the block 
                    await supabase.from("blocks").delete().eq("id", b.id);

                    // We also need to restore the friendship status if one existed between them.
                    // Instead of blindly canceling, we could let them remain BLOCKED or CANCELLED, 
                    // but the safest default when unblocking is moving it to CANCELLED so they can request again.
                    const { data: fData } = await supabase.from("friendships")
                      .select("id")
                      .or(`requester_id.eq.${b.blocked_id},addressee_id.eq.${b.blocked_id}`)
                      .single();
                      
                    if (fData) {
                      await supabase.from("friendships").update({ status: 'CANCELLED' }).eq("id", fData.id);
                    }
                    
                    loadData();
                  }} 
                  className="text-slate-600 dark:text-zinc-400 text-sm hover:underline"
                >
                  Unblock
                </button>
              </li>
            )
          })}
          {blockedUsers.length === 0 && (
            <p className="text-slate-500 dark:text-zinc-400 text-sm">No blocked users.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
