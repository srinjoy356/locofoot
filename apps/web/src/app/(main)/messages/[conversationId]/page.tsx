"use client";

import { useEffect, useState, useRef, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Message } from "@locofoot/shared-types";
import { useRouter } from "next/navigation";

export default function ChatWindow({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data as unknown as Message[]) || []);
    scrollToBottom();
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) {
        if (!session) router.push("/login");
        return;
      }
      setUserId(session.user.id);
      const { data: member, error: memErr } = await supabase.from("conversation_members")
        .select("*").eq("conversation_id", conversationId).eq("user_id", session.user.id).single();
      
      if (memErr || !member || !isMounted) {
        if (memErr || !member) setError("You do not have access to this conversation.");
        return;
      }
      await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId).eq("user_id", session.user.id);

      loadMessages();
      
      if (!isMounted) return;

      // Aggressively clean up any lingering channel with this name
      supabase.getChannels().forEach(ch => {
        if (ch.topic === `realtime:conversation:${conversationId}`) {
          supabase.removeChannel(ch);
        }
      });

      // Setup realtime subscription
      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            setMessages(prev => [...prev, payload.new as unknown as Message]);
            scrollToBottom();
            if (document.hasFocus()) {
              supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() })
                .eq("conversation_id", conversationId).eq("user_id", session.user.id);
            }
          }
        ).subscribe();
    };

    loadSession();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;
    const body = newMessage;
    setNewMessage("");
    const { error: sendErr } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: userId, body
    });
    if (sendErr) {
      alert(`Failed to send message: ${sendErr.message}`);
      setNewMessage(body);
    }
  };

  if (error) return <div className="p-10 text-red-500 font-semibold">{error}</div>;
  if (!userId) return <div className="p-10">Loading...</div>;

  return (
    <div className="flex flex-col h-[80vh] max-w-3xl mx-auto border rounded-lg bg-slate-50 dark:bg-zinc-900/50 overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 p-4 border-b font-semibold shadow-sm">Conversation</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isMine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 border text-slate-800 dark:text-zinc-200 rounded-bl-none'}`}>
                <p>{m.body}</p>
                <span className={`text-[10px] opacity-70 mt-1 block ${isMine ? 'text-right' : 'text-left'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 bg-white dark:bg-zinc-900 border-t flex gap-2">
        <input type="text" className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:border-blue-500" placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
        <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white rounded-full px-6 py-2 font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">Send</button>
      </form>
    </div>
  );
}
