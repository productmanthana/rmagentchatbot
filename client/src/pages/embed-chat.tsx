import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any[];
  timestamp: Date;
}

interface EmbedChatProps {
  embedId: string;
  role: string;
  embedName?: string;
}

export default function EmbedChat({ embedId, role, embedName }: EmbedChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previousContext, setPreviousContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          previousContext: previousContext,
          embedId: embedId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer || data.summary || `Found ${data.data?.length || 0} results`,
          data: data.data,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setPreviousContext({
          question: userMessage.content,
          function_name: data.function_name,
          arguments: data.arguments,
          data: data.data,
        });
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: data.error || "Sorry, I couldn't process your request.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, there was an error processing your request.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sampleQueries = [
    "Top 5 largest projects",
    "Projects completed in 2024",
    "Show all active projects",
    "Win rate by company",
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-[#2E7D32] text-white p-3 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-semibold text-lg">AI RMOne Agents</h1>
          <p className="text-xs text-white/80">Natural language queries</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 bg-[#8BC34A]/20 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#8BC34A]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Ask anything about your data</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              Query your project data using natural language. Try one of these examples:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {sampleQueries.map((query, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInputValue(query);
                    inputRef.current?.focus();
                  }}
                  data-testid={`sample-query-${i}`}
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-[80%] p-3 ${
                    message.role === 'user'
                      ? 'bg-[#2E7D32] text-white'
                      : 'bg-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.data && message.data.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">
                        {message.data.length} result{message.data.length !== 1 ? 's' : ''} found
                      </p>
                      <div className="max-h-40 overflow-y-auto text-xs">
                        {message.data.slice(0, 5).map((item, i) => (
                          <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                            {item.Title || item.ProjectName || item.name || JSON.stringify(item).slice(0, 100)}
                          </div>
                        ))}
                        {message.data.length > 5 && (
                          <p className="text-gray-400 mt-1">+ {message.data.length - 5} more...</p>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="bg-white p-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 bg-white border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your data..."
            disabled={isLoading}
            className="flex-1"
            data-testid="embed-chat-input"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-[#8BC34A] hover:bg-[#7CB342] text-white"
            data-testid="embed-send-button"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
