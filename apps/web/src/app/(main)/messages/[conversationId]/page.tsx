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

  if (error) return <div className="p-10 text-error font-semibold">{error}</div>;
  if (!userId) return <div className="p-10">Loading...</div>;

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <div className="relative w-full overflow-hidden border-b border-outline-variant bg-[#0b0d0c] shrink-0">
        <div className="absolute inset-0 z-0">
          <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-30 " src="/turf/pitch-corner.jpg" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40 z-10" />
        </div>
        <div className="relative z-20 max-w-container-max mx-auto px-margin-mobile md:px-gutter py-6 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]" />
          <div className="min-w-0">
            <span className="block font-label-caps text-label-caps text-primary-container uppercase tracking-widest">Direct Message</span>
            <h1 className="font-display-lg text-headline-lg-mobile md:text-headline-lg uppercase tracking-tighter leading-none text-on-surface mt-1">Conversation</h1>
          </div>
        </div>
      </div>

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 h-[calc(100vh-200px)]">
        <div className="flex flex-col h-full border border-outline-variant bg-surface">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m) => {
              const isMine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] p-4 border ${
                    isMine 
                      ? 'bg-primary-container/10 border-primary-container text-on-surface' 
                      : 'bg-background border-outline-variant text-on-surface-variant'
                  }`}>
                    <p className="font-body-md whitespace-pre-wrap">{m.body}</p>
                    <span className={`font-label-caps text-[10px] uppercase tracking-widest mt-2 block ${isMine ? 'text-primary-container' : 'text-on-surface-variant'}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          
          <form onSubmit={sendMessage} className="p-6 bg-background border-t border-outline-variant flex gap-4">
            <input 
              type="text" 
              className="flex-1 bg-surface border border-outline-variant p-4 focus:outline-none focus:border-primary-container text-on-surface font-body-md placeholder:text-on-surface-variant transition-colors" 
              placeholder="TYPE A MESSAGE..." 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()} 
              className="bg-primary-container text-on-primary-container font-label-caps text-label-caps uppercase tracking-widest px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-fixed transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
