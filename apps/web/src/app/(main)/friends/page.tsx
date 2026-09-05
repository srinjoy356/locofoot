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
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <div className="w-full border-b border-outline-variant bg-[#0b0d0c] pt-12 pb-8 px-margin-mobile md:px-gutter shrink-0">
        <h1 className="font-display-lg text-display-lg md:text-[64px] uppercase tracking-tighter leading-none text-on-surface">Friends</h1>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        {/* Search */}
        <div className="border border-outline-variant bg-surface p-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input 
              className="bg-background border border-outline-variant p-4 flex-1 focus:outline-none focus:border-primary-container text-on-surface font-mono placeholder:text-on-surface-variant transition-colors" 
              placeholder="SEARCH BY EXACT CODE (E.G. FTB-X8K29Q)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="bg-on-surface text-surface hover:bg-primary-container hover:text-on-primary-container px-8 py-4 font-label-caps text-label-caps uppercase tracking-widest transition-colors whitespace-nowrap">
              Search
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-8">
              <h2 className="font-headline-sm uppercase tracking-tighter mb-4 text-on-surface">Search Results</h2>
              <ul className="grid grid-cols-1 border border-outline-variant divide-y divide-outline-variant">
                {searchResults.map(u => (
                  <li key={u.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-background hover:bg-surface-variant transition-colors gap-4">
                    <span className="font-headline-sm uppercase">{u.display_name || u.username || u.unique_code}</span>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => sendRequest(u.id)}
                        className="flex-1 md:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
                      >
                        Add Friend
                      </button>
                      <button 
                        onClick={() => handleBlock(u.id)}
                        className="flex-1 md:flex-none border border-error bg-error/10 hover:bg-error/20 text-error px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors"
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Friends */}
          <div className="border border-outline-variant bg-surface p-6">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-2 mb-4">My Friends</h2>
            <ul className="grid grid-cols-1 border border-outline-variant divide-y divide-outline-variant">
              {friendships.filter(f => f.status === 'ACCEPTED').map(f => {
                const friend = f.requester_id === currentUser.id ? f.addressee : f.requester;
                return (
                  <li key={f.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-background hover:bg-surface-variant transition-colors gap-4">
                    <span className="font-headline-sm uppercase">{friend.display_name || friend.username || friend.unique_code}</span>
                    <div className="flex gap-2 w-full md:w-auto flex-wrap">
                      <button onClick={() => handleMessage(friend.id)} className="border border-outline-variant bg-surface hover:border-primary-container hover:text-primary-container text-on-surface px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                        Message
                      </button>
                      <button onClick={() => updateStatus(f.id, FriendshipStatus.CANCELLED)} className="border border-outline-variant bg-surface hover:border-error hover:text-error text-on-surface px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                        Remove
                      </button>
                      <button onClick={() => handleBlock(friend.id)} className="border border-outline-variant bg-surface hover:bg-error hover:text-on-error text-error px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                        Block
                      </button>
                    </div>
                  </li>
                )
              })}
              {friendships.filter(f => f.status === 'ACCEPTED').length === 0 && (
                <li className="p-4 text-on-surface-variant font-body-md">No friends yet.</li>
              )}
            </ul>
          </div>

          {/* Pending Requests */}
          <div className="border border-outline-variant bg-surface p-6">
            <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-on-surface border-b border-outline-variant pb-2 mb-4">Pending Requests</h2>
            
            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2 mt-4">Incoming</h3>
            <ul className="grid grid-cols-1 border border-outline-variant divide-y divide-outline-variant mb-6 bg-background">
              {friendships.filter(f => f.status === 'PENDING' && f.addressee_id === currentUser.id).map(f => (
                <li key={f.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 hover:bg-surface-variant transition-colors gap-4 border-l-2 border-l-primary-container">
                  <span className="font-headline-sm uppercase">{f.requester.display_name || f.requester.username || f.requester.unique_code}</span>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => updateStatus(f.id, FriendshipStatus.ACCEPTED)} className="flex-1 md:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Accept
                    </button>
                    <button onClick={() => updateStatus(f.id, FriendshipStatus.REJECTED)} className="flex-1 md:flex-none border border-error bg-error/10 hover:bg-error/20 text-error px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Reject
                    </button>
                  </div>
                </li>
              ))}
              {friendships.filter(f => f.status === 'PENDING' && f.addressee_id === currentUser.id).length === 0 && (
                <li className="p-4 text-on-surface-variant font-body-md">No incoming requests.</li>
              )}
            </ul>

            <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Outgoing</h3>
            <ul className="grid grid-cols-1 border border-outline-variant divide-y divide-outline-variant bg-background">
              {friendships.filter(f => f.status === 'PENDING' && f.requester_id === currentUser.id).map(f => (
                <li key={f.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 hover:bg-surface-variant transition-colors gap-4">
                  <span className="font-headline-sm uppercase">{f.addressee.display_name || f.addressee.username || f.addressee.unique_code}</span>
                  <button onClick={() => updateStatus(f.id, FriendshipStatus.CANCELLED)} className="border border-outline-variant bg-surface hover:border-error hover:text-error text-on-surface-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors w-full md:w-auto">
                    Cancel
                  </button>
                </li>
              ))}
              {friendships.filter(f => f.status === 'PENDING' && f.requester_id === currentUser.id).length === 0 && (
                <li className="p-4 text-on-surface-variant font-body-md">No outgoing requests.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="border border-error/50 bg-error/5 p-6">
          <h2 className="font-headline-lg-mobile uppercase tracking-tighter text-error border-b border-error/50 pb-2 mb-4">Blocked Users</h2>
          <ul className="grid grid-cols-1 border border-error/50 divide-y divide-error/50 max-w-md bg-background">
            {blockedUsers.map(b => {
              return (
                <li key={b.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-error/10 transition-colors gap-4">
                  <span className="font-headline-sm uppercase line-through text-on-surface-variant">{b.blocked.display_name || b.blocked.username || b.blocked.unique_code}</span>
                  <button 
                    onClick={async () => {
                      if (!confirm("Unblock this user?")) return;
                      await supabase.from("blocks").delete().eq("id", b.id);
                      const { data: fData } = await supabase.from("friendships")
                        .select("id")
                        .or(`requester_id.eq.${b.blocked_id},addressee_id.eq.${b.blocked_id}`)
                        .single();
                      if (fData) {
                        await supabase.from("friendships").update({ status: 'CANCELLED' }).eq("id", fData.id);
                      }
                      loadData();
                    }} 
                    className="border border-error bg-error/10 hover:bg-error text-error hover:text-on-error px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors w-full sm:w-auto"
                  >
                    Unblock
                  </button>
                </li>
              )
            })}
            {blockedUsers.length === 0 && (
              <li className="p-4 text-on-surface-variant font-body-md">No blocked users.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
