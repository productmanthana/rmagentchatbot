import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Loader2, AlertCircle } from "lucide-react";

interface EmbedChatProps {
  role: 'superadmin' | 'admin' | 'user';
  embedName: string;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  response?: any;
  timestamp: Date;
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === 'number') {
    if (value >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toString();
  }
  return String(value);
}

export default function EmbedChat({ role, embedName }: EmbedChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const previousContext = messages.length > 0 
        ? messages.filter(m => m.type === 'bot' && m.response).pop()?.response
        : undefined;

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          previousContext: previousContext ? {
            question: previousContext.question,
            function_name: previousContext.function_name,
            arguments: previousContext.arguments,
            result_data: previousContext.data,
          } : undefined,
        }),
      });

      const data = await response.json();

      const botMessage: Message = {
        id: crypto.randomUUID(),
        type: 'bot',
        content: data.message || (data.success ? `Found ${data.row_count || 0} results` : data.error || 'Error'),
        response: data,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        type: 'bot',
        content: 'Failed to process query. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-[#2E7D32] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <img src="/rmone-logo.svg" alt="RMOne" className="h-8 w-8" onError={(e) => e.currentTarget.style.display = 'none'} />
          <span className="font-semibold">RMOne AI Assistant</span>
        </div>
        <span className="text-sm text-white/70">{embedName}</span>
      </header>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">Welcome to RMOne AI Assistant</p>
              <p className="text-sm">Ask questions about your project data in natural language.</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-[85%] ${message.type === 'user' ? 'bg-[#2E7D32] text-white' : 'bg-white'}`}>
                <CardContent className="p-3">
                  <p className={message.type === 'user' ? 'text-white' : 'text-gray-800'}>{message.content}</p>
                  
                  {message.response?.success && message.response.data?.length > 0 && (
                    <div className="mt-3 overflow-auto max-h-80">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(message.response.data[0]).slice(0, 6).map((key) => (
                              <TableHead key={key} className="text-xs font-semibold bg-gray-100">
                                {key}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {message.response.data.slice(0, 10).map((row: any, idx: number) => (
                            <TableRow key={idx}>
                              {Object.entries(row).slice(0, 6).map(([key, value]: [string, any]) => (
                                <TableCell key={key} className="text-xs">
                                  {formatCellValue(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {message.response.data.length > 10 && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Showing 10 of {message.response.row_count} results
                        </p>
                      )}
                    </div>
                  )}

                  {message.response && !message.response.success && (
                    <div className="mt-2 flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{message.response.error || 'Query failed'}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-white">
                <CardContent className="p-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2E7D32]" />
                  <span className="text-gray-600">Processing...</span>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t bg-white shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data..."
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            data-testid="input-embed-query"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white"
            data-testid="button-embed-send"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
