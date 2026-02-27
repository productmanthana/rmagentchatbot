import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link, useLocation } from "wouter";
import { useEmbedContext } from "./embed-with-id";
import { QueryResponse, DEFAULT_FAQ_CATEGORIES, type FAQSampleQuestion } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { 
  useChats, 
  useCreateChat, 
  useDeleteChat,
  useUpdateChat,
  useMessages,
  useCreateMessage,
  prefetchMessages,
  getCachedMessages,
  type ChatWithMessages
} from "@/lib/chatApi";
import type { Chat, Message as DBMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartVisualization } from "@/components/ChartVisualization";
import { ChartComparison } from "@/components/ChartComparison";
import { FloatingParticles } from "@/components/FloatingParticles";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  Send,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Calendar,
  Tag,
  Building,
  Trash2,
  Search,
  Plus,
  MessageSquare,
  X,
  Menu,
  PanelLeftClose,
  FileText,
  Brain,
  Maximize2,
  Download,
  Clock,
  BarChart3,
  Pencil,
  Check as CheckIcon,
  LogOut,
  Loader2,
  Star,
  Settings,
  ChevronsUpDown,
  PlusCircle,
  Filter,
  ImagePlus,
  CheckSquare,
  Square,
  MessageCircle,
  Columns,
  HelpCircle,
  CheckCircle,
  Info,
  User,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper function to format cell values with proper currency formatting
function formatCellValue(value: any, columnName: string): string {
  if (value === null || value === undefined) return "";
  
  // Currency columns that should be formatted with dollar signs
  const currencyColumns = ['Fee', 'Total Fee', 'Average Fee', 'Min Fee', 'Max Fee', 'total_value', 'avg_fee', 'min_fee', 'max_fee', 'lifetime_value', 'avg_project_value', 'weighted_value', 'total_pipeline_value', 'weighted_pipeline_value'];
  
  // Percentage columns
  const percentColumns = ['Win %', 'Avg Win Rate', 'avg_win_rate', 'win_rate', 'avg_win_probability', 'historical_win_rate'];
  
  // Count columns - format with commas
  const countColumns = ['Project Count', 'project_count', 'total_projects', 'won_count', 'lost_count', 'open_count', 'total_opportunities', 'open_opportunities'];
  
  // Check if it's a currency column
  if (currencyColumns.some(col => columnName.toLowerCase().includes(col.toLowerCase()) || col.toLowerCase().includes(columnName.toLowerCase()))) {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    if (!isNaN(numValue)) {
      if (numValue >= 1e9) {
        return `$${(numValue / 1e9).toFixed(1)}B`;
      } else if (numValue >= 1e6) {
        return `$${(numValue / 1e6).toFixed(1)}M`;
      } else if (numValue >= 1e3) {
        return `$${(numValue / 1e3).toFixed(0)}K`;
      } else {
        return `$${numValue.toLocaleString()}`;
      }
    }
  }
  
  // Check if it's a percentage column
  if (percentColumns.some(col => columnName.toLowerCase().includes(col.toLowerCase()))) {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isNaN(numValue)) {
      return `${numValue.toFixed(1)}%`;
    }
  }
  
  // Check if it's a count column
  if (countColumns.some(col => columnName.toLowerCase().includes(col.toLowerCase()))) {
    const numValue = typeof value === 'number' ? value : parseInt(String(value));
    if (!isNaN(numValue)) {
      return numValue.toLocaleString();
    }
  }
  
  // For other numeric values, format with locale
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  // Handle objects and arrays - stringify them nicely
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Complex Object]';
    }
  }
  
  return String(value);
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  interface Section { title: string; blocks: PBlock[] }
  interface PBlock {
    type: 'paragraph' | 'blockquote' | 'table' | 'ordered-list' | 'unordered-list' | 'h3' | 'h4' | 'hr' | 'spacer';
    content?: string;
    items?: string[];
    rows?: string[][];
  }

  const sections: Section[] = [];
  let topBlocks: PBlock[] = [];
  let cur: Section | null = null;

  const push = (b: PBlock) => { cur ? cur.blocks.push(b) : topBlocks.push(b); };

  let listItems: string[] = [];
  let listType: 'ordered' | 'unordered' | null = null;
  let tableRows: string[][] = [];
  let tableHasSep = false;
  let orderedParentActive = false;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      push({ type: listType === 'ordered' ? 'ordered-list' : 'unordered-list', items: [...listItems] });
      listItems = []; listType = null;
    }
    orderedParentActive = false;
  };
  const flushTable = () => {
    if (tableRows.length > 0 && tableHasSep) {
      push({ type: 'table', rows: [...tableRows] });
    } else if (tableRows.length > 0) {
      tableRows.forEach(row => push({ type: 'paragraph', content: '| ' + row.join(' | ') + ' |' }));
    }
    tableRows = []; tableHasSep = false;
  };

  lines.forEach(line => {
    const t = line.trim();
    if (/^\|[\s\-:|]+\|$/.test(t)) { if (tableRows.length > 0) tableHasSep = true; return; }
    if (t.startsWith('|') && t.endsWith('|')) { flushList(); tableRows.push(t.slice(1, -1).split('|')); return; }
    if (tableRows.length > 0) flushTable();

    if (/^## (?!#)/.test(t)) {
      flushList();
      if (cur) sections.push(cur);
      cur = { title: t.replace(/^##\s+/, ''), blocks: [] };
    } else if (t.startsWith('### ')) { flushList(); push({ type: 'h3', content: t.replace(/^###\s+/, '') }); }
    else if (t.startsWith('#### ')) { flushList(); push({ type: 'h4', content: t.replace(/^####\s+/, '') }); }
    else if (/^[-*_]{3,}$/.test(t)) { flushList(); push({ type: 'hr' }); }
    else if (t.startsWith('> ')) { flushList(); push({ type: 'blockquote', content: t.replace(/^>\s+/, '') }); }
    else if (/^\d+[\.)]\s+/.test(t)) {
      if (listType === 'unordered' && orderedParentActive) {
        flushList();
      } else if (listType !== 'ordered') {
        flushList();
      }
      listType = 'ordered';
      orderedParentActive = true;
      listItems.push(t.replace(/^\d+[\.)]\s+/, ''));
    }
    else if (t.startsWith('- ') || t.startsWith('* ')) {
      if (orderedParentActive && listType === 'ordered' && listItems.length > 0) {
        const subText = t.replace(/^[-*]\s+/, '');
        listItems[listItems.length - 1] += ' \u2022 ' + subText;
      } else {
        if (listType !== 'unordered') { flushList(); listType = 'unordered'; }
        listItems.push(t.replace(/^[-*]\s+/, ''));
      }
    }
    else if (t === '') {
      if (!orderedParentActive) flushList();
      else push({ type: 'spacer' });
    }
    else { flushList(); push({ type: 'paragraph', content: t }); }
  });
  flushList(); flushTable();
  if (cur) sections.push(cur);

  const sectionIcons: Record<string, { icon: JSX.Element; color: string; bgFrom: string; bgTo: string; border: string }> = {
    'answer': {
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
      color: '#059669', bgFrom: '#F0FDF4', bgTo: '#ECFDF5', border: '#86EFAC'
    },
    'breakdown': {
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      color: '#2563EB', bgFrom: '#EFF6FF', bgTo: '#DBEAFE', border: '#93C5FD'
    },
    'insights': {
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      color: '#D97706', bgFrom: '#FFFBEB', bgTo: '#FEF3C7', border: '#FCD34D'
    },
    'notes': {
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      color: '#7C3AED', bgFrom: '#F5F3FF', bgTo: '#EDE9FE', border: '#C4B5FD'
    },
  };
  const defaultStyle = {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    color: '#475569', bgFrom: '#F8FAFC', bgTo: '#F1F5F9', border: '#CBD5E1'
  };

  const getSectionStyle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('answer') || lower.includes('summary') || lower.includes('result')) return sectionIcons['answer'];
    if (lower.includes('breakdown') || lower.includes('comparison') || lower.includes('detail') || lower.includes('data')) return sectionIcons['breakdown'];
    if (lower.includes('insight') || lower.includes('key') || lower.includes('highlight') || lower.includes('takeaway') || lower.includes('finding')) return sectionIcons['insights'];
    if (lower.includes('note') || lower.includes('caveat') || lower.includes('limitation') || lower.includes('context')) return sectionIcons['notes'];
    return defaultStyle;
  };

  const renderBlock = (block: PBlock, key: string) => {
    switch (block.type) {
      case 'paragraph':
        return <p key={key} className="text-[#374151] mb-2 leading-relaxed text-[14px]">{formatInlineMarkdown(block.content || '')}</p>;
      case 'blockquote':
        return (
          <div key={key} className="bg-gradient-to-r from-[#F0FDF4] to-[#ECFDF5] border-l-4 border-[#34D399] rounded-md p-3.5 my-3">
            <div className="text-[#065F46] font-semibold text-[14.5px] leading-relaxed">{formatInlineMarkdown(block.content || '')}</div>
          </div>
        );
      case 'table': {
        if (!block.rows || block.rows.length === 0) return null;
        const hdr = block.rows[0];
        const body = block.rows.slice(1);
        return (
          <div key={key} className="overflow-x-auto my-3 rounded-md border border-[#E2E8F0]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#1E293B]">
                  {hdr.map((c, i) => <th key={i} className="px-3 py-2.5 text-left font-semibold text-white text-xs uppercase tracking-wider">{formatInlineMarkdown(c.trim())}</th>)}
                </tr>
              </thead>
              {body.length > 0 && (
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                      {row.map((c, ci) => (
                        <td key={ci} className={`px-3 py-2 border-t border-[#F1F5F9] ${ci === 0 ? 'font-medium text-[#1E293B]' : 'text-[#475569]'}`}>
                          {formatInlineMarkdown(c.trim())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        );
      }
      case 'ordered-list':
        return (
          <ol key={key} className="mb-2 space-y-1.5 list-none">
            {(block.items || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="bg-[#8BC34A] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-[#374151] flex-1 leading-relaxed text-[14px]">{formatInlineMarkdown(item)}</span>
              </li>
            ))}
          </ol>
        );
      case 'unordered-list':
        return (
          <ul key={key} className="mb-2 space-y-1 list-none">
            {(block.items || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[7px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#8BC34A]" />
                <span className="text-[#374151] flex-1 leading-relaxed text-[14px]">{formatInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        );
      case 'h3':
        return <h3 key={key} className="text-[14px] font-bold text-[#1E293B] mt-3 mb-1.5">{formatInlineMarkdown(block.content || '')}</h3>;
      case 'h4':
        return <h4 key={key} className="text-[13px] font-semibold text-[#64748B] mt-2 mb-1 uppercase tracking-wider">{formatInlineMarkdown(block.content || '')}</h4>;
      case 'hr':
        return null;
      case 'spacer':
        return <div key={key} className="h-0.5" />;
      default:
        return null;
    }
  };

  const renderSection = (section: Section, idx: number) => {
    const style = getSectionStyle(section.title);
    const hasContent = section.blocks.filter(b => b.type !== 'spacer' && b.type !== 'hr').length > 0;
    if (!hasContent) return null;
    return (
      <div key={`section-${idx}`} className="rounded-md overflow-hidden" style={{ border: `1px solid ${style.border}` }}>
        <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${style.bgFrom}, ${style.bgTo})`, borderBottom: `1px solid ${style.border}` }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: style.color, color: 'white' }}>
            {style.icon}
          </div>
          <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: style.color }}>
            {section.title}
          </h2>
        </div>
        <div className="px-3.5 py-3 bg-white">
          {section.blocks.filter(b => b.type !== 'hr').map((block, bi) => renderBlock(block, `s${idx}-b${bi}`))}
        </div>
      </div>
    );
  };

  const hasTopContent = topBlocks.filter(b => b.type !== 'spacer' && b.type !== 'hr').length > 0;

  return (
    <div className="space-y-3">
      {hasTopContent && (
        <div className="text-[14px]">
          {topBlocks.map((block, i) => renderBlock(block, `top-${i}`))}
        </div>
      )}
      {sections.map((section, i) => renderSection(section, i))}
    </div>
  );
}

// Highlight dollar values and percentages in text
function highlightValues(text: string, keyPrefix: string = 'v'): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let key = 0;
  const valRegex = /(\$[\d,]+(?:\.\d+)?[MBKmkbn]*\b)|(\b\d+(?:\.\d+)?%)/g;
  let lastIndex = 0;
  let match;
  while ((match = valRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    if (match[1]) {
      parts.push(<span key={`${keyPrefix}-${key++}`} className="font-semibold text-[#059669]">{match[1]}</span>);
    } else if (match[2]) {
      parts.push(<span key={`${keyPrefix}-${key++}`} className="font-semibold text-[#2563EB]">{match[2]}</span>);
    }
    lastIndex = valRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// Format inline markdown (bold, italic, code, dollar values, percentages)
function formatInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let key = 0;
  
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...highlightValues(text.substring(lastIndex, match.index), `pre-${key}`));
    }
    
    if (match[1]) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#111827]">
          {highlightValues(match[2], `b-${key}`)}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={key++} className="italic text-[#6B7280]">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#7C3AED] font-mono text-sm border border-[#E5E7EB]">
          {match[6]}
        </code>
      );
    }
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(...highlightValues(text.substring(lastIndex), `end-${key}`));
  }
  
  return parts.length > 0 ? parts : [text];
}

interface AIAnalysisMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  response?: QueryResponse;
}

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  response?: QueryResponse;
  aiAnalysisMessages?: AIAnalysisMessage[];
  originalQuestion?: string; // Preserve the original question for display
  _tempId?: string; // Original temp ID for follow-up lookups after ID changes
}

const exampleQueries = [
  {
    icon: Calendar,
    category: "Time-Based",
    queries: [
      "Show me all mega sized projects starting in the next ten months",
      "Top 10 projects in last 6 months",
      "Projects completed in 2024",
    ],
  },
  {
    icon: TrendingUp,
    category: "Rankings",
    queries: [
      "Top 5 largest projects",
      "Smallest 3 active projects",
      "Largest active projects by fee",
    ],
  },
  {
    icon: Tag,
    category: "Categories",
    queries: [
      "Transportation related projects",
      "Show all energy sector projects",
      "Government project type projects",
    ],
  },
  {
    icon: Building,
    category: "Analysis",
    queries: [
      "Compare revenue between OPCOs",
      "Revenue by division",
      "Win rate by company",
    ],
  },
];

// Component to handle table with external scrollbar and virtual scrolling
interface TableWithExternalScrollbarProps {
  data: any[];
  messageId: string;
  height?: string;
  enableColumnSelection?: boolean;
  selectedColumns?: Set<string>;
  onColumnSelectionChange?: (selectedColumns: Set<string>) => void;
}

function TableWithExternalScrollbar({ 
  data, 
  messageId, 
  height = "400px",
  enableColumnSelection = false,
  selectedColumns: externalSelectedColumns,
  onColumnSelectionChange
}: TableWithExternalScrollbarProps) {
  // Internal selection state for columns (used when no external state provided)
  const [internalSelectedColumns, setInternalSelectedColumns] = useState<Set<string>>(new Set());
  const selectedColumns = externalSelectedColumns ?? internalSelectedColumns;
  
  // Check if this is AI analysis data - render narrative instead of raw table
  if (data.length > 0 && data[0]?.type === 'ai_analysis') {
    const aiData = data[0];
    return (
      <div className="space-y-4">
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-[#8BC34A]" />
            <span className="font-semibold text-[#111827]">AI Analysis Response</span>
          </div>
          <MarkdownRenderer content={aiData.narrative || ''} />
        </div>
        {aiData.samples && aiData.samples.length > 0 && (
          <div>
            <h5 className="font-semibold text-[#111827] mb-2">Sample Data</h5>
            <TableWithExternalScrollbar data={aiData.samples} messageId={`${messageId}-samples`} height="300px" enableColumnSelection={enableColumnSelection} />
          </div>
        )}
      </div>
    );
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const scrollbarContentRef = useRef<HTMLDivElement>(null);
  const columns = Object.keys(data[0]);
  
  // Track if currently resizing to prevent click events from firing
  const [isResizing, setIsResizing] = useState(false);
  
  // Handle column selection toggle - single-select only (one column at a time)
  const handleColumnSelect = (columnName: string) => {
    if (isResizing) return; // Don't select while resizing
    
    // Single-select: if clicking same column, deselect it; otherwise select only the new column
    const newSelected = new Set<string>();
    if (!selectedColumns.has(columnName)) {
      newSelected.add(columnName);
    }
    // If clicking same column that's already selected, newSelected stays empty (deselects)
    
    if (onColumnSelectionChange) {
      onColumnSelectionChange(newSelected);
    } else {
      setInternalSelectedColumns(newSelected);
    }
  };

  // Resizable column widths - initialize based on column type
  const getInitialWidth = (col: string) => {
    if (col === 'Tags') return 400;
    if (col === 'Description') return 300;
    if (col.toLowerCase().includes('date')) return 120;
    if (col.toLowerCase().includes('fee') || col.toLowerCase().includes('value')) return 130;
    return 150;
  };
  
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columns.forEach(col => {
      widths[col] = getInitialWidth(col);
    });
    return widths;
  });

  // Resize handling refs
  const resizingCol = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = col;
    startX.current = e.clientX;
    startWidth.current = columnWidths[col];
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(80, startWidth.current + diff); // Min width 80px
    setColumnWidths(prev => ({
      ...prev,
      [resizingCol.current!]: newWidth
    }));
  };

  const handleMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // Delay resetting isResizing to prevent click event from firing
    setTimeout(() => setIsResizing(false), 100);
  };

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => wrapperRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });

  // Horizontal scrollbar sync
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scrollbar = scrollbarRef.current;
    const scrollbarContent = scrollbarContentRef.current;

    if (!wrapper || !scrollbar || !scrollbarContent) return;

    const updateScrollbarWidth = () => {
      const content = wrapper.querySelector('.virtual-table-content');
      if (content) {
        scrollbarContent.style.width = `${content.scrollWidth}px`;
      }
    };
    
    updateScrollbarWidth();
    const observer = new ResizeObserver(updateScrollbarWidth);
    observer.observe(wrapper);

    let syncing = false;

    const handleScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollLeft = scrollbar.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    const handleWrapperScroll = () => {
      if (!syncing) {
        syncing = true;
        scrollbar.scrollLeft = wrapper.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    scrollbar.addEventListener('scroll', handleScrollbarScroll);
    wrapper.addEventListener('scroll', handleWrapperScroll);

    return () => {
      scrollbar.removeEventListener('scroll', handleScrollbarScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
      observer.disconnect();
    };
  }, [data, columnWidths]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  
  // Generate grid template columns from resizable widths
  const gridTemplateColumns = columns.length === 1 
    ? '1fr' 
    : columns.map(col => `${columnWidths[col]}px`).join(' ');

  return (
    <div className="relative">
      <div
        ref={wrapperRef}
        className="overflow-y-auto overflow-x-auto scrollbar-hide rounded-lg border border-[#E5E7EB] bg-white"
        style={{ height }}
      >
        <div className="virtual-table-content inline-block min-w-full">
          {/* Header with resizable and selectable columns */}
          <div 
            className="bg-[#F9FAFB] sticky top-0 z-20 grid border-b border-[#E5E7EB]"
            style={{ gridTemplateColumns }}
          >
            {columns.map((key, idx) => {
              const isSelected = selectedColumns.has(key);
              return (
                <div
                  key={key}
                  className={`relative font-semibold h-10 whitespace-nowrap px-4 flex items-center group transition-colors ${
                    enableColumnSelection 
                      ? `cursor-pointer ${isSelected ? 'bg-[#3B82F6] text-white' : 'text-[#374151] hover:bg-[#E5E7EB]'}`
                      : 'text-[#374151]'
                  }`}
                  onClick={enableColumnSelection ? () => handleColumnSelect(key) : undefined}
                  data-testid={`column-header-${key.replace(/\s+/g, '-').toLowerCase()}`}
                  title={enableColumnSelection ? (isSelected ? `Deselect ${key}` : `Select ${key}`) : key}
                >
                  {enableColumnSelection && (
                    <span className={`mr-2 ${isSelected ? 'text-white' : 'text-[#9CA3AF]'}`}>
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </span>
                  )}
                  <span className="overflow-hidden text-ellipsis">{key}</span>
                  {/* Resize handle */}
                  {columns.length > 1 && (
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-[#3B82F6]/50 group-hover:bg-[#E5E7EB] transition-colors"
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Prevent column selection when resizing
                        handleMouseDown(key, e);
                      }}
                      title="Drag to resize column"
                    />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Virtual body */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const row = data[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  className="grid border-b border-[#F3F4F6] transition-colors absolute w-full hover:bg-[#F9FAFB]"
                  data-testid={`table-row-${virtualRow.index}`}
                  style={{
                    gridTemplateColumns,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {columns.map((key, colIdx) => {
                    const value = row[key];
                    const isSingleColumn = columns.length === 1;
                    const isColumnSelected = selectedColumns.has(key);
                    return (
                      <div
                        key={colIdx}
                        className={`py-2 px-4 flex items-center ${
                          isSingleColumn ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'
                        } ${isColumnSelected ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'text-[#111827]'}`}
                        title={typeof value === 'string' ? value : String(value ?? '')}
                      >
                        {formatCellValue(value, key)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* External horizontal scrollbar */}
      <div
        ref={scrollbarRef}
        className="mt-2 overflow-x-auto overflow-y-hidden h-4 rounded bg-[#F3F4F6]"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div ref={scrollbarContentRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
}

// Component for maximized table with external scrollbars (both horizontal and vertical) and virtual scrolling
function MaximizedTableWithScrollbars({ data }: { data: any[] }) {
  // Check if this is AI analysis data - render narrative instead of raw table
  if (data.length > 0 && data[0]?.type === 'ai_analysis') {
    const aiData = data[0];
    return (
      <div className="space-y-4 h-full overflow-auto">
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-[#8BC34A]" />
            <span className="font-semibold text-[#111827] text-lg">AI Analysis Response</span>
          </div>
          <MarkdownRenderer content={aiData.narrative || ''} />
        </div>
        {aiData.samples && aiData.samples.length > 0 && (
          <div>
            <h4 className="font-semibold text-[#111827] mb-3">Sample Data ({aiData.samples.length} records)</h4>
            <MaximizedTableWithScrollbars data={aiData.samples} />
          </div>
        )}
      </div>
    );
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hScrollbarRef = useRef<HTMLDivElement>(null);
  const vScrollbarRef = useRef<HTMLDivElement>(null);
  const hScrollbarContentRef = useRef<HTMLDivElement>(null);
  const vScrollbarContentRef = useRef<HTMLDivElement>(null);
  const columns = Object.keys(data[0]);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => wrapperRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });

  // Scrollbar sync
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const hScrollbar = hScrollbarRef.current;
    const vScrollbar = vScrollbarRef.current;
    const hScrollbarContent = hScrollbarContentRef.current;
    const vScrollbarContent = vScrollbarContentRef.current;

    if (!wrapper || !hScrollbar || !vScrollbar || !hScrollbarContent || !vScrollbarContent) return;

    const updateScrollbarSizes = () => {
      const content = wrapper.querySelector('.virtual-table-content');
      if (content) {
        hScrollbarContent.style.width = `${content.scrollWidth}px`;
      }
      vScrollbarContent.style.height = `${rowVirtualizer.getTotalSize()}px`;
    };
    
    updateScrollbarSizes();
    const observer = new ResizeObserver(updateScrollbarSizes);
    observer.observe(wrapper);

    let syncing = false;

    const handleHScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollLeft = hScrollbar.scrollLeft;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    const handleVScrollbarScroll = () => {
      if (!syncing) {
        syncing = true;
        wrapper.scrollTop = vScrollbar.scrollTop;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    const handleWrapperScroll = () => {
      if (!syncing) {
        syncing = true;
        hScrollbar.scrollLeft = wrapper.scrollLeft;
        vScrollbar.scrollTop = wrapper.scrollTop;
        requestAnimationFrame(() => { syncing = false; });
      }
    };

    hScrollbar.addEventListener('scroll', handleHScrollbarScroll);
    vScrollbar.addEventListener('scroll', handleVScrollbarScroll);
    wrapper.addEventListener('scroll', handleWrapperScroll);

    return () => {
      hScrollbar.removeEventListener('scroll', handleHScrollbarScroll);
      vScrollbar.removeEventListener('scroll', handleVScrollbarScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
      observer.disconnect();
    };
  }, [data, rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  
  // Generate grid template columns - use full width for single column, Tags gets 2900px, others 150px
  const gridTemplateColumns = columns.length === 1 
    ? '1fr' 
    : columns.map(col => col === 'Tags' ? '2900px' : '150px').join(' ');

  return (
    <div className="flex gap-2 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div
          ref={wrapperRef}
          className="flex-1 overflow-auto scrollbar-hide rounded-lg border border-[#E5E7EB] bg-white"
        >
          <div className="virtual-table-content inline-block min-w-full">
            {/* Header */}
            <div 
              className="bg-[#F9FAFB] sticky top-0 z-20 grid border-b border-[#E5E7EB]"
              style={{ gridTemplateColumns }}
            >
              {columns.map((key) => (
                <div
                  key={key}
                  className="text-[#374151] font-semibold h-10 whitespace-nowrap px-4 flex items-center"
                >
                  {key}
                </div>
              ))}
            </div>
            
            {/* Virtual body */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const row = data[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    className="grid border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors absolute w-full"
                    style={{
                      gridTemplateColumns,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {columns.map((key, colIdx) => {
                      const value = row[key];
                      const isSingleColumn = columns.length === 1;
                      return (
                        <div
                          key={colIdx}
                          className={`text-[#111827] py-2 px-4 flex items-center ${
                            isSingleColumn ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden'
                          }`}
                        >
                          {formatCellValue(value, key)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* External horizontal scrollbar */}
        <div
          ref={hScrollbarRef}
          className="mt-2 overflow-x-auto overflow-y-hidden h-4 rounded bg-[#F3F4F6] flex-shrink-0"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div ref={hScrollbarContentRef} style={{ height: '1px' }} />
        </div>
      </div>

      {/* External vertical scrollbar */}
      <div
        ref={vScrollbarRef}
        className="overflow-y-auto overflow-x-hidden w-4 rounded bg-[#F3F4F6] flex-shrink-0"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div ref={vScrollbarContentRef} style={{ width: '1px' }} />
      </div>
    </div>
  );
}

// Embed User ID Display Component - Shows in sidebar footer for embed mode
function EmbedUserIdDisplay({ 
  displayId, 
  onRecover 
}: { 
  displayId: string; 
  onRecover: (newDisplayId: string) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      setError('Please enter an ID');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const success = await onRecover(inputValue.trim());
      if (success) {
        toast({
          title: "Session Recovered",
          description: "Your chat history has been restored.",
        });
        setIsEditing(false);
      } else {
        setError('ID not found. Please check and try again.');
      }
    } catch (e) {
      setError('Failed to recover session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="px-3 py-2 mt-3 border-t border-white/10 pt-3 space-y-2">
        <div className="text-xs text-white/50 mb-1">Enter your previous ID:</div>
        <div className="flex gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g., admin_k7m2x9"
            className="flex-1 bg-[#2C3E50] text-white text-xs px-2 py-1 rounded border border-[#4B5563] focus:border-[#8BC34A] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            disabled={isLoading}
            data-testid="input-recover-id"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-[#8BC34A] hover:bg-[#7CB342] text-white text-xs px-2 py-1 rounded disabled:opacity-50"
            data-testid="button-recover-submit"
          >
            {isLoading ? '...' : 'Go'}
          </button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <button
          onClick={() => { setIsEditing(false); setError(''); setInputValue(''); }}
          className="text-xs text-white/40 hover:text-white/60"
          data-testid="button-recover-cancel"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-3 border-t border-white/10 pt-3">
      <span className="text-xs text-white/40">ID:</span>
      <span className="text-xs text-white/50 font-mono" data-testid="text-embed-display-id">
        {displayId}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="text-xs text-white/30 hover:text-white/60 ml-auto"
        title="Enter a different ID to recover your previous session"
        data-testid="button-edit-embed-id"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}

// Helper to safely get embed token for navigation links (handles iframe third-party context)
// Prefers JWT token (which contains role info) over session token
function getSafeEmbedToken(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) return urlToken;
    
    const jwtToken = sessionStorage.getItem('jwtToken');
    if (jwtToken) return jwtToken;
    
    return sessionStorage.getItem('embedToken') || '';
  } catch {
    return '';
  }
}

// Helper to get embed ID for navigation links
function getSafeEmbedId(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmbedId = urlParams.get('embed');
    if (urlEmbedId) return urlEmbedId;
    
    return sessionStorage.getItem('currentEmbedId') || '';
  } catch {
    return '';
  }
}

function parseDidYouMean(text: string): { mainText: string; suggestions: string[] } {
  if (!text) return { mainText: text, suggestions: [] };
  const match = text.match(/\n\nDid you mean:\s*(.+?)(\?)?\s*$/i);
  if (!match) return { mainText: text, suggestions: [] };
  const suggestionsStr = match[1];
  const suggestions = suggestionsStr.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, '')) || [];
  return { mainText: text.replace(match[0], '').trim(), suggestions };
}

function buildCorrectedQuery(originalQuestion: string, messageText: string, suggestion: string): string {
  const entityMatch = messageText.match(/for\s+(?:client|company|project|category|region|pm|manager)?\s*"([^"]+)"/i);
  const originalEntity = entityMatch?.[1];
  if (originalEntity) {
    const escaped = originalEntity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const corrected = originalQuestion.replace(new RegExp(escaped, 'gi'), suggestion);
    if (corrected !== originalQuestion) return corrected;
  }
  return `${originalQuestion} (use "${suggestion}" instead)`;
}

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const embedContext = useEmbedContext();
  // Check if in embed mode via context OR if URL contains /embed/ OR if in iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isEmbedUrl = typeof window !== 'undefined' && window.location.pathname.includes('/embed/');
  const isEmbed = embedContext?.isEmbed || isEmbedUrl || isInIframe;
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [aiAnalysisInputs, setAiAnalysisInputs] = useState<Record<string, string>>({});
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<Record<string, boolean>>({});
  const [maximizedTable, setMaximizedTable] = useState<{ messageId: string; data: any[] } | null>(null);
  const [activeTabPerMessage, setActiveTabPerMessage] = useState<Record<string, string>>({});
  const [followUpTabs, setFollowUpTabs] = useState<Record<string, string>>({});
  const HIDE_FOLLOWUP = true;
  const [dismissedLimitNotification, setDismissedLimitNotification] = useState<Record<string, boolean>>({});
  const [usedSuggestions, setUsedSuggestions] = useState<Record<string, string>>({});  // messageId -> selected suggestion description
  const [showLargeDataAlert, setShowLargeDataAlert] = useState(false);
  const [clickedDisambiguationButton, setClickedDisambiguationButton] = useState<string | null>(null);  // Track which disambiguation button was clicked
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  
  // Column selection state for "Ask About Selected Columns" feature
  const [selectedColumnsPerMessage, setSelectedColumnsPerMessage] = useState<Record<string, Set<string>>>({});
  const [askAboutColumnsInput, setAskAboutColumnsInput] = useState<Record<string, string>>({});
  const [askAboutColumnsLoading, setAskAboutColumnsLoading] = useState<Record<string, boolean>>({});
  
  // Modal state for showing column analysis results
  const [columnAnalysisModal, setColumnAnalysisModal] = useState<{
    isOpen: boolean;
    messageId: string;
    question: string;
    response: QueryResponse | null;
    loading: boolean;
  }>({ isOpen: false, messageId: '', question: '', response: null, loading: false });
  
  // Handle column selection change for a specific message
  // Automatically opens popup when columns are selected or changed
  const handleColumnSelectionChange = (messageId: string, selectedColumns: Set<string>) => {
    const previousColumns = selectedColumnsPerMessage[messageId] || new Set();
    
    // Detect if a column was added OR changed (for single-select, size stays same but content changes)
    const isAddingColumn = selectedColumns.size > previousColumns.size;
    const isChangingColumn = selectedColumns.size === previousColumns.size && 
      selectedColumns.size > 0 && 
      ![...selectedColumns].every(col => previousColumns.has(col));
    
    setSelectedColumnsPerMessage(prev => ({ ...prev, [messageId]: selectedColumns }));
    
    // Open popup when ADDING or CHANGING a column
    if ((isAddingColumn || isChangingColumn) && selectedColumns.size > 0) {
      setColumnAnalysisModal(prev => {
        return {
          isOpen: true,
          messageId,
          question: '',
          response: null,
          loading: false,
        };
      });
    } else if (selectedColumns.size === 0) {
      // Close popup when all columns are deselected
      setColumnAnalysisModal(prev => {
        if (prev.messageId === messageId) {
          return { ...prev, isOpen: false };
        }
        return prev;
      });
    }
    // When removing a column but still have selections, don't change popup state
  };
  
  // Clear column selection for a message and close popup
  const clearColumnSelection = (messageId: string) => {
    setSelectedColumnsPerMessage(prev => ({ ...prev, [messageId]: new Set() }));
    setAskAboutColumnsInput(prev => ({ ...prev, [messageId]: '' }));
    setColumnAnalysisModal(prev => {
      if (prev.messageId === messageId) {
        return { ...prev, isOpen: false, response: null };
      }
      return prev;
    });
  };

  // Track which follow-ups are being deleted to prevent race conditions
  const deletingFollowUpsRef = useRef<Set<string>>(new Set());
  const followUpSubmittingRef = useRef<Set<string>>(new Set());
  
  // Delete a specific follow-up question and its response
  // This allows users to remove failed/unwanted follow-ups and ask new ones
  const deleteFollowUp = (parentMessageId: string, followUpId: string, event?: React.MouseEvent) => {
    // Log details about the event to understand what's triggering deletes
    console.log(`[DeleteFollowUp] Called for ${followUpId}`);
    if (event) {
      console.log(`[DeleteFollowUp] Event type: ${event.type}, isTrusted: ${event.isTrusted}, button: ${event.button}`);
      console.log(`[DeleteFollowUp] Target:`, event.target);
      console.log(`[DeleteFollowUp] CurrentTarget:`, event.currentTarget);
    } else {
      console.log(`[DeleteFollowUp] No event object - called programmatically?`);
      console.trace();
    }
    
    // Prevent duplicate deletions (race condition guard)
    if (deletingFollowUpsRef.current.has(followUpId)) {
      console.log(`[DeleteFollowUp] ⚠️ Already deleting ${followUpId}, skipping duplicate call`);
      return;
    }
    
    // TIMING GUARD: Prevent deleting follow-ups that were just created (within 3 seconds)
    // This catches accidental clicks from layout shifts or race conditions
    // Message ID format: user-{timestamp}-{random}
    const timestampMatch = followUpId.match(/^user-(\d+)-/);
    if (timestampMatch) {
      const createdAt = parseInt(timestampMatch[1], 10);
      const age = Date.now() - createdAt;
      if (age < 3000) { // Less than 3 seconds old
        console.log(`[DeleteFollowUp] ⚠️ Message ${followUpId} is only ${age}ms old, too new to delete - likely accidental click`);
        return;
      }
    }
    
    deletingFollowUpsRef.current.add(followUpId);
    
    // Clean up the ref after a delay
    setTimeout(() => {
      deletingFollowUpsRef.current.delete(followUpId);
    }, 2000);
    
    setMessages(prev => prev.map(m => {
      if (m.id === parentMessageId && m.aiAnalysisMessages) {
        // Find the user message index
        const userMsgIndex = m.aiAnalysisMessages.findIndex(msg => msg.id === followUpId && msg.type === "user");
        if (userMsgIndex === -1) {
          console.log(`[DeleteFollowUp] Follow-up ${followUpId} not found (already deleted?)`);
          return m;
        }
        
        // Find the corresponding assistant response (immediately after user message)
        // Follow-ups are stored as pairs: [user, assistant, user, assistant, ...]
        let assistantMsgIndex = -1;
        for (let i = userMsgIndex + 1; i < m.aiAnalysisMessages.length; i++) {
          if (m.aiAnalysisMessages[i].type === "assistant") {
            assistantMsgIndex = i;
            break;
          }
        }
        
        // Remove both the user question and its assistant response
        const updatedMessages = m.aiAnalysisMessages.filter((_, idx) => 
          idx !== userMsgIndex && idx !== assistantMsgIndex
        );
        
        console.log(`[DeleteFollowUp] Removed follow-up ${followUpId} and response. Remaining: ${updatedMessages.length}`);
        
        // Persist to database
        if (currentChatId) {
          updateMessageAIAnalysisMutation.mutate({
            chatId: currentChatId,
            messageId: parentMessageId,
            aiAnalysisMessages: updatedMessages,
          });
          
          // Also update the React Query cache directly so changes persist when navigating
          queryClient.setQueryData(['/api/chats', currentChatId, 'messages'], (oldData: any[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map((msg: any) => {
              if (msg.id === parentMessageId) {
                return { ...msg, aiAnalysisMessages: updatedMessages };
              }
              return msg;
            });
          });
        }
        
        return {
          ...m,
          aiAnalysisMessages: updatedMessages,
        };
      }
      return m;
    }));
    
    toast({
      title: "Follow-up deleted",
      description: "You can now ask a new follow-up question.",
    });
  };
  
  // Helper: Get column type for dynamic filter examples
  const getColumnFilterType = (columnNames: Set<string>): 'numeric' | 'percent' | 'text' | 'mixed' => {
    const numericColumns = ['Fee', 'Total Fee', 'Average Fee', 'Min Fee', 'Max Fee', 'total_value', 'avg_fee', 'min_fee', 'max_fee'];
    const percentColumns = ['Win %', 'Avg Win Rate', 'avg_win_rate', 'win_rate', 'historical_win_rate'];
    
    const columns = Array.from(columnNames);
    let hasNumeric = false;
    let hasPercent = false;
    let hasText = false;
    
    for (const col of columns) {
      const colLower = col.toLowerCase();
      if (numericColumns.some(nc => colLower.includes(nc.toLowerCase()) || nc.toLowerCase().includes(colLower))) {
        hasNumeric = true;
      } else if (percentColumns.some(pc => colLower.includes(pc.toLowerCase()) || pc.toLowerCase().includes(colLower))) {
        hasPercent = true;
      } else {
        hasText = true;
      }
    }
    
    if (hasNumeric && !hasPercent && !hasText) return 'numeric';
    if (hasPercent && !hasNumeric && !hasText) return 'percent';
    if (hasText && !hasNumeric && !hasPercent) return 'text';
    return 'mixed';
  };
  
  // Helper: Get real sample values from data for selected columns
  const getRealColumnValues = (messageId: string, selectedCols: Set<string>, limit: number = 4): string[] => {
    if (!messageId || !selectedCols || selectedCols.size === 0) return [];
    
    // Find the data source for this message
    let dataSource: any[] | null = null;
    const followupMatch = messageId.match(/^(?:ai-)?followup-(.+?)(?:-samples)?$/);
    if (followupMatch) {
      const parentMsgId = followupMatch[1];
      const isSamples = messageId.endsWith('-samples');
      for (const msg of messages) {
        if (msg.aiAnalysisMessages) {
          const followupMsg = msg.aiAnalysisMessages.find((m: any) => m.id === parentMsgId);
          if (followupMsg?.response?.data) {
            if (isSamples && followupMsg.response.data[0]?.samples) {
              dataSource = followupMsg.response.data[0].samples;
            } else {
              dataSource = followupMsg.response.data;
            }
            break;
          }
        }
      }
    } else {
      const msg = messages.find(m => m.id === messageId);
      if (msg?.response?.data) {
        dataSource = msg.response.data;
      }
    }
    
    if (!dataSource || dataSource.length === 0) return [];
    
    // Extract unique values from selected columns
    const uniqueValues = new Set<string>();
    const columnsArray = Array.from(selectedCols);
    
    for (const row of dataSource) {
      for (const col of columnsArray) {
        const val = row[col];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          let strVal = String(val).trim();
          // Truncate long values for display (keep first meaningful words)
          if (strVal.length > 25) {
            // Try to cut at a word boundary
            const words = strVal.split(/\s+/);
            let truncated = '';
            for (const word of words) {
              if ((truncated + ' ' + word).length > 22) break;
              truncated = truncated ? truncated + ' ' + word : word;
            }
            strVal = truncated ? truncated + '...' : strVal.slice(0, 22) + '...';
          }
          uniqueValues.add(strVal);
        }
        if (uniqueValues.size >= limit * 2) break; // Get more than needed for variety
      }
      if (uniqueValues.size >= limit * 2) break;
    }
    
    // Return a sample of unique values
    return Array.from(uniqueValues).slice(0, limit);
  };
  
  // Helper: Get dynamic filter examples based on column type
  const getFilterExamples = (columnType: 'numeric' | 'percent' | 'text' | 'mixed') => {
    switch (columnType) {
      case 'numeric':
        return {
          placeholder: 'e.g., below 100k, above 500k, between 100k-500k...',
          keywords: ['below', 'above', 'between X-Y', 'only X', 'equals'],
          examples: [
            { text: 'below 100k', color: 'emerald' },
            { text: 'above 500k', color: 'purple' },
            { text: 'between 100k-500k', color: 'amber' },
            { text: 'only 1M', color: 'cyan' },
          ]
        };
      case 'percent':
        return {
          placeholder: 'e.g., above 50%, below 30%, between 40-60%...',
          keywords: ['below', 'above', 'between X-Y%', 'at least', 'at most'],
          examples: [
            { text: 'above 50%', color: 'emerald' },
            { text: 'below 30%', color: 'purple' },
            { text: 'between 40-60%', color: 'amber' },
            { text: 'at least 70%', color: 'cyan' },
          ]
        };
      case 'text':
        return {
          placeholder: 'e.g., hospitals, education, contains bridge...',
          keywords: ['contains', 'starts with', 'ends with', 'equals', 'only'],
          examples: [
            { text: 'hospitals', color: 'emerald' },
            { text: 'education', color: 'purple' },
            { text: 'contains bridge', color: 'amber' },
            { text: 'starts with CA', color: 'cyan' },
          ]
        };
      case 'mixed':
      default:
        return {
          placeholder: 'e.g., above 100k, contains hospital, below 50%...',
          keywords: ['below', 'above', 'contains', 'between', 'only'],
          examples: [
            { text: 'above 100k', color: 'emerald' },
            { text: 'contains hospital', color: 'purple' },
            { text: 'below 50%', color: 'amber' },
            { text: 'only Won', color: 'cyan' },
          ]
        };
    }
  };
  
  // Helper: Parse currency/number strings like "$500K", "$1.5M", "100000" into numbers
  const parseNumericValue = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const str = String(value).replace(/[,$\s]/g, '').toUpperCase();
    const match = str.match(/^([\d.]+)(K|M|B)?$/);
    if (!match) return null;
    let num = parseFloat(match[1]);
    if (isNaN(num)) return null;
    if (match[2] === 'K') num *= 1000;
    if (match[2] === 'M') num *= 1000000;
    if (match[2] === 'B') num *= 1000000000;
    return num;
  };

  // Submit question about selected columns - local filtering/extraction (no AI)
  const submitColumnQuestion = async (messageId: string, data: any[]) => {
    const question = askAboutColumnsInput[messageId]?.trim();
    const questionLower = question?.toLowerCase() || '';
    const selectedColumns = selectedColumnsPerMessage[messageId];
    
    if (!question || !selectedColumns?.size) return;
    
    setAskAboutColumnsLoading(prev => ({ ...prev, [messageId]: true }));
    setColumnAnalysisModal({
      isOpen: true,
      messageId,
      question,
      response: null,
      loading: true,
    });
    
    try {
      const columnsArray = Array.from(selectedColumns);
      
      // Helper: Case-insensitive column value getter
      // Finds the actual column key in the row that matches (case-insensitive)
      const getColumnValue = (row: Record<string, any>, colName: string): any => {
        // First try exact match
        if (colName in row) return row[colName];
        // Then try case-insensitive match
        const colNameLower = colName.toLowerCase();
        const matchingKey = Object.keys(row).find(k => k.toLowerCase() === colNameLower);
        return matchingKey ? row[matchingKey] : undefined;
      };
      
      // Debug: Log what we're working with
      console.log('[ColumnFilter] Selected columns:', columnsArray);
      console.log('[ColumnFilter] Data length:', data.length);
      console.log('[ColumnFilter] Search query:', question);
      if (data.length > 0) {
        console.log('[ColumnFilter] First row keys:', Object.keys(data[0]));
        console.log('[ColumnFilter] Sample values for selected cols:', columnsArray.map(col => ({
          col,
          value: getColumnValue(data[0], col)
        })));
      }
      
      const isYearOrDateColumn = columnsArray.some(col => 
        /^(year|yr|date|month|quarter|period|fiscal.?year)$/i.test(col.trim())
      );

      const numericConditionPatterns = [
        // Column-prefixed patterns: "win percentage greater than 50", "fee below 100k"  
        { regex: /(?:win\s*(?:rate|%|percentage|pct)?)\s*(?:greater\s*th[ae]n|above|over|>)\s*\$?([\d.]+)\s*%?/i, op: '>', targetCol: 'Win %', isPercent: true },
        { regex: /(?:win\s*(?:rate|%|percentage|pct)?)\s*(?:less\s*th[ae]n|below|under|<)\s*\$?([\d.]+)\s*%?/i, op: '<', targetCol: 'Win %', isPercent: true },
        { regex: /(?:win\s*(?:rate|%|percentage|pct)?)\s*(?:at\s*least|>=)\s*\$?([\d.]+)\s*%?/i, op: '>=', targetCol: 'Win %', isPercent: true },
        { regex: /(?:win\s*(?:rate|%|percentage|pct)?)\s*(?:at\s*most|<=)\s*\$?([\d.]+)\s*%?/i, op: '<=', targetCol: 'Win %', isPercent: true },
        { regex: /(?:fee|cost|revenue|price)\s*(?:greater\s*th[ae]n|above|over|>)\s*\$?([\d.]+)\s*(k|m|b)?/i, op: '>', targetCol: 'Fee', isPercent: false },
        { regex: /(?:fee|cost|revenue|price)\s*(?:less\s*th[ae]n|below|under|<)\s*\$?([\d.]+)\s*(k|m|b)?/i, op: '<', targetCol: 'Fee', isPercent: false },
        // General patterns - when suffix is k/m/b (money), target Fee; when % target Win %
        { regex: /(?:below|under|less\s*th[ae]n|smaller\s*th[ae]n|lower\s*th[ae]n|<|up\s*to|max(?:imum)?)\s*\$?([\d.]+)\s*(k|m|b)/i, op: '<', targetCol: 'Fee', isPercent: false },
        { regex: /(?:above|over|greater\s*th[ae]n|more\s*th[ae]n|higher\s*th[ae]n|exceeds?|>|min(?:imum)?)\s*\$?([\d.]+)\s*(k|m|b)/i, op: '>', targetCol: 'Fee', isPercent: false },
        { regex: /\$?([\d.]+)\s*(k|m|b)\s*(?:\+|or\s*more|and\s*(?:above|over|up))/i, op: '>=', targetCol: 'Fee', isPercent: false },
        { regex: /\$?([\d.]+)\s*(k|m|b)\s*(?:or\s*less|and\s*(?:below|under))/i, op: '<=', targetCol: 'Fee', isPercent: false },
        { regex: /(?:at\s*least|>=)\s*\$?([\d.]+)\s*(k|m|b)/i, op: '>=', targetCol: 'Fee', isPercent: false },
        { regex: /(?:at\s*most|<=)\s*\$?([\d.]+)\s*(k|m|b)/i, op: '<=', targetCol: 'Fee', isPercent: false },
        { regex: /(?:equals?|=|exactly|is)\s*\$?([\d.]+)\s*(k|m|b)/i, op: '=', targetCol: 'Fee', isPercent: false },
        // Direct fee value with suffix (e.g., "800M", "$2M", "500k") - treated as exact match
        { regex: /^\s*\$?([\d.]+)\s*(m|k|b)\s*$/i, op: '=', targetCol: 'Fee', isPercent: false },
        // Direct bare number (e.g., "2.0", "800") - treated as millions when Fee column is selected
        // SKIP this pattern when the selected column is a year/date column to avoid treating "2023" as $2023M
        ...(isYearOrDateColumn ? [] : [{ regex: /^\s*\$?([\d.]+)\s*$/i, op: '=', targetCol: 'Fee', isPercent: false, assumeMillions: true }]),
        { regex: /(?:between|from)\s*\$?([\d.]+)\s*(k|m|b)\s*(?:and|to|-)\s*\$?([\d.]+)\s*(k|m|b)?/i, op: 'between', targetCol: 'Fee', isPercent: false },
        // Between pattern without units - treat plain numbers as millions for Fee column context
        { regex: /(?:between|from)\s*\$?([\d.]+)\s*(?:and|to|-)\s*\$?([\d.]+)(?!\s*[kmb%])/i, op: 'between', targetCol: null, isPercent: null },
        // Percentage patterns - target Win %
        { regex: /(?:below|under|less\s*th[ae]n|<)\s*([\d.]+)\s*(%|percent(?:age)?)/i, op: '<', targetCol: 'Win %', isPercent: true },
        { regex: /(?:above|over|greater\s*th[ae]n|>)\s*([\d.]+)\s*(%|percent(?:age)?)/i, op: '>', targetCol: 'Win %', isPercent: true },
        // General numeric (no suffix) - check any selected column
        { regex: /(?:below|under|less\s*th[ae]n|<)\s*\$?([\d.]+)(?!\s*[kmb%])/i, op: '<', targetCol: null, isPercent: null },
        { regex: /(?:above|over|greater\s*th[ae]n|>)\s*\$?([\d.]+)(?!\s*[kmb%])/i, op: '>', targetCol: null, isPercent: null },
      ];
      
      // Extract ALL numeric conditions (supports multiple)
      interface NumericFilter {
        op: string;
        value: number;
        value2?: number;
        isPercentage: boolean;
        targetColumn: string | null; // specific column or null for any
        matchText: string;
      }
      const numericFilters: NumericFilter[] = [];
      let workingText = questionLower;
      
      // First pass: find column-specific conditions
      for (const pattern of numericConditionPatterns) {
        const { regex, op, targetCol, isPercent, assumeMillions } = pattern as any;
        if (targetCol) { // Only column-specific patterns in first pass
          const match = workingText.match(regex);
          if (match) {
            let val = parseFloat(match[1]);
            const suffix = (match[2] || '').toLowerCase();
            const isPct = isPercent === true || suffix === '%' || suffix.startsWith('percent');
            
            if (!isPct) {
              if (suffix === 'k') val *= 1000;
              else if (suffix === 'm') val *= 1000000;
              else if (suffix === 'b') val *= 1000000000;
              else if (assumeMillions && !suffix) {
                // Bare number with assumeMillions flag - interpret as millions
                val *= 1000000;
              }
            }
            
            // Extract second value for "between" ranges
            let val2: number | undefined;
            if (op === 'between' && match[3]) {
              val2 = parseFloat(match[3]);
              const suffix2 = (match[4] || suffix).toLowerCase(); // Default to first suffix if second not provided
              if (!isPct && suffix2 !== '%' && !suffix2.startsWith('percent')) {
                if (suffix2 === 'k') val2 *= 1000;
                if (suffix2 === 'm') val2 *= 1000000;
                if (suffix2 === 'b') val2 *= 1000000000;
              }
            }
            
            numericFilters.push({
              op,
              value: val,
              value2: val2,
              isPercentage: isPct,
              targetColumn: targetCol,
              matchText: match[0]
            });
            workingText = workingText.replace(match[0], ' ');
          }
        }
      }
      
      // Second pass: find general numeric conditions on remaining text
      for (const { regex, op, targetCol, isPercent } of numericConditionPatterns) {
        if (!targetCol) { // Only general patterns
          const match = workingText.match(regex);
          if (match) {
            let val = parseFloat(match[1]);
            // Check if match[2] looks like a suffix (k/m/b/%) or a second number
            const possibleSuffix = (match[2] || '').toLowerCase();
            const isSecondNumber = /^\d/.test(possibleSuffix);
            const suffix = isSecondNumber ? '' : possibleSuffix;
            const isPct = isPercent === true || suffix === '%' || suffix.startsWith('percent');
            
            if (!isPct && !isSecondNumber) {
              if (suffix === 'k') val *= 1000;
              if (suffix === 'm') val *= 1000000;
              if (suffix === 'b') val *= 1000000000;
            }
            
            let val2: number | undefined;
            if (op === 'between') {
              // For pattern without suffix: match[2] is the second number
              // For pattern with suffix: match[3] is the second number
              if (isSecondNumber && match[2]) {
                // Pattern: "between X-Y" without units - assume millions for Fee context
                val2 = parseFloat(match[2]);
                // Auto-detect scale: if both values are small (< 1000), assume millions
                if (val < 1000 && val2 < 1000) {
                  val *= 1000000;
                  val2 *= 1000000;
                }
              } else if (match[3]) {
                val2 = parseFloat(match[3]);
                const suffix2 = (match[4] || '').toLowerCase();
                if (!isPct && suffix2 !== '%' && !suffix2.startsWith('percent')) {
                  if (suffix2 === 'k') val2 *= 1000;
                  if (suffix2 === 'm') val2 *= 1000000;
                  if (suffix2 === 'b') val2 *= 1000000000;
                }
              }
            }
            
            numericFilters.push({
              op,
              value: val,
              value2: val2,
              isPercentage: isPct,
              targetColumn: null, // matches any column
              matchText: match[0]
            });
            workingText = workingText.replace(match[0], ' ');
          }
        }
      }
      
      const hasNumericFilter = numericFilters.length > 0;
      const numericMatchTexts = numericFilters.map(f => f.matchText);
      
      // === ADVANCED FILTER PARSING ===
      
      // Check for negation patterns (not X, excluding X, without X)
      const negationMatch = questionLower.match(/(?:not|excluding|without|except|no)\s+(.+?)(?:\s+and|\s+or|\s*$)/i);
      let excludeTerms: string[] = [];
      if (negationMatch) {
        excludeTerms = negationMatch[1].split(/\s+/).filter(w => w.length >= 2);
      }
      
      // Check for date/year patterns
      const yearMatch = questionLower.match(/(?:from|in|during|year)\s*(\d{4})/i);
      const afterYearMatch = questionLower.match(/(?:after|since|>=)\s*(\d{4})/i);
      const beforeYearMatch = questionLower.match(/(?:before|until|prior\s*to|<=)\s*(\d{4})/i);
      let yearFilter: { type: string; year: number } | null = null;
      if (yearMatch) yearFilter = { type: 'equals', year: parseInt(yearMatch[1]) };
      else if (afterYearMatch) yearFilter = { type: 'after', year: parseInt(afterYearMatch[1]) };
      else if (beforeYearMatch) yearFilter = { type: 'before', year: parseInt(beforeYearMatch[1]) };
      
      // Check for Top-N / sorting patterns
      const topNMatch = questionLower.match(/(?:top|first|highest|largest|biggest)\s*(\d+)?/i);
      const bottomNMatch = questionLower.match(/(?:bottom|last|lowest|smallest)\s*(\d+)?/i);
      let sortConfig: { direction: 'asc' | 'desc'; limit?: number } | null = null;
      if (topNMatch) sortConfig = { direction: 'desc', limit: topNMatch[1] ? parseInt(topNMatch[1]) : 10 };
      else if (bottomNMatch) sortConfig = { direction: 'asc', limit: bottomNMatch[1] ? parseInt(bottomNMatch[1]) : 10 };
      
      // Check for empty/null patterns
      const emptyMatch = questionLower.match(/\b(empty|blank|missing|null|no\s*value|without\s*value)\b/i);
      const hasValueMatch = questionLower.match(/\b(has\s*value|not\s*empty|filled|with\s*value)\b/i);
      
      // Extract remaining text search terms
      let textSearchTerms: string[] = [];
      let remainingText = workingText; // Already has numeric patterns removed
      
      // Remove matched patterns from remaining text
      for (const matchText of numericMatchTexts) {
        remainingText = remainingText.replace(matchText, ' ');
      }
      if (negationMatch) remainingText = remainingText.replace(negationMatch[0], ' ');
      if (yearMatch) remainingText = remainingText.replace(yearMatch[0], ' ');
      if (afterYearMatch) remainingText = remainingText.replace(afterYearMatch[0], ' ');
      if (beforeYearMatch) remainingText = remainingText.replace(beforeYearMatch[0], ' ');
      if (topNMatch) remainingText = remainingText.replace(topNMatch[0], ' ');
      if (bottomNMatch) remainingText = remainingText.replace(bottomNMatch[0], ' ');
      if (emptyMatch) remainingText = remainingText.replace(emptyMatch[0], ' ');
      if (hasValueMatch) remainingText = remainingText.replace(hasValueMatch[0], ' ');
      
      // Check for AND logic in text search ("education and healthcare")
      // Works alongside numeric filters - only extract non-numeric AND terms
      let andTerms: string[] = [];
      // Split by " and " and filter out numeric patterns
      const andParts = remainingText.split(/\s+and\s+/i);
      if (andParts.length > 1) {
        for (const part of andParts) {
          const cleaned = part
            .replace(/\b(with|containing|projects?|records?|rows?|show|find|list|get|below|above|under|over|less|greater|than)\b/gi, '')
            .replace(/\$?[\d.]+\s*[kmb%]?/gi, '') // Remove numeric values
            .trim();
          if (cleaned.length >= 2) andTerms.push(cleaned);
        }
      }
      
      // Clean up remaining text - preserve the original query structure better
      // First, check if query looks like a direct value search (e.g., "Company F", "Status Won")
      const trimmedQuestion = question.trim();
      const isDirectValueSearch = !hasNumericFilter && andTerms.length === 0 && 
        !negationMatch && !yearFilter && !sortConfig && !emptyMatch && !hasValueMatch;
      
      let cleanedText: string;
      if (isDirectValueSearch) {
        // For direct searches, preserve the full query as-is (preserve &, commas, colons for tags and dates)
        cleanedText = trimmedQuestion
          .replace(/[^\w\s&,/:.+-]/g, ' ')  // Preserve & , / : . + - for tag matching and ISO dates
          .trim();
      } else {
        // For complex queries, apply keyword removal
        cleanedText = remainingText
          .replace(/\b(with|containing|includes?|has|and|or|the|a|an|projects?|records?|rows?|where|that|have|show|find|get|list|by|for|in|on|at)\b/gi, ' ')
          .replace(/\b(win\s*(?:rate|%|percentage)?|fee|cost|value|amount|price|date|year|status)\b/gi, ' ')
          .replace(/[^\w\s&,/:.+-]/g, ' ')  // Preserve & , / : . + - for tag matching and ISO dates
          .trim();
      }
      
      // For direct value searches, keep the full term; otherwise split into words
      if (isDirectValueSearch && cleanedText.length > 0) {
        textSearchTerms = [cleanedText]; // Keep as single search term
      } else {
        const words = cleanedText.split(/\s+/).filter(w => w.length >= 1); // Allow single chars
        if (words.length > 0 && andTerms.length === 0) {
          textSearchTerms = words;
        }
      }
      
      // === APPLY FILTERS ===
      let filteredData = [...data];
      const filterDescriptions: string[] = [];
      
      // 1. Apply empty/has value filter
      if (emptyMatch) {
        filteredData = filteredData.filter(row => {
          return columnsArray.some(col => {
            const val = getColumnValue(row, col);
            return val === null || val === undefined || val === '' || String(val).trim() === '';
          });
        });
        filterDescriptions.push('is empty');
      } else if (hasValueMatch) {
        filteredData = filteredData.filter(row => {
          return columnsArray.every(col => {
            const val = getColumnValue(row, col);
            return val !== null && val !== undefined && String(val).trim() !== '';
          });
        });
        filterDescriptions.push('has value');
      }
      
      // 2. Apply year/date filter
      if (yearFilter) {
        filteredData = filteredData.filter(row => {
          return columnsArray.some(col => {
            const val = String(getColumnValue(row, col) || '');
            const yearInVal = val.match(/\b(19|20)\d{2}\b/);
            if (!yearInVal) return false;
            const rowYear = parseInt(yearInVal[0]);
            switch (yearFilter!.type) {
              case 'equals': return rowYear === yearFilter!.year;
              case 'after': return rowYear >= yearFilter!.year;
              case 'before': return rowYear <= yearFilter!.year;
              default: return false;
            }
          });
        });
        filterDescriptions.push(yearFilter.type === 'equals' ? `year ${yearFilter.year}` : 
          yearFilter.type === 'after' ? `after ${yearFilter.year}` : `before ${yearFilter.year}`);
      }
      
      // 3. Apply AND terms filter (all terms must match)
      if (andTerms.length > 0) {
        filteredData = filteredData.filter(row => {
          // ALL terms must be found somewhere in selected columns
          return andTerms.every(term => {
            return columnsArray.some(col => {
              const cellValue = getColumnValue(row, col);
              if (cellValue === null || cellValue === undefined) return false;
              return String(cellValue).toLowerCase().includes(term.toLowerCase());
            });
          });
        });
        filterDescriptions.push(`contains "${andTerms.join('" AND "')}"`);
      }
      // 4. Apply text search filter (OR logic for simple searches)
      else if (textSearchTerms.length > 0) {
        filteredData = filteredData.filter(row => {
          return textSearchTerms.some(term => {
            const termLower = term.toLowerCase();
            return columnsArray.some(col => {
              const cellValue = getColumnValue(row, col);
              if (cellValue === null || cellValue === undefined) return false;
              return String(cellValue).toLowerCase().includes(termLower);
            });
          });
        });
        filterDescriptions.push(`contains "${textSearchTerms.join('" or "')}"`);
      }
      
      // 5. Apply exclusion filter
      if (excludeTerms.length > 0) {
        filteredData = filteredData.filter(row => {
          // Row should NOT contain any excluded terms
          return !excludeTerms.some(term => {
            const termLower = term.toLowerCase();
            return columnsArray.some(col => {
              const cellValue = getColumnValue(row, col);
              if (cellValue === null || cellValue === undefined) return false;
              return String(cellValue).toLowerCase().includes(termLower);
            });
          });
        });
        filterDescriptions.push(`excluding "${excludeTerms.join('" or "')}"`);
      }
      
      // 6. Apply numeric filters (supports multiple conditions)
      if (hasNumericFilter) {
        // Apply each numeric filter - ALL must pass (AND logic)
        for (const filter of numericFilters) {
          // Tighter tolerance for exact matches: 0.1M ($100k) for fees, 0.5% for percentages
          // This ensures "141" matches $141.0M but not $140.0M
          const tolerance = filter.isPercentage ? 0.5 : 100000; // 0.1M = $100k tolerance for fees
          
          filteredData = filteredData.filter(row => {
            // Determine which columns to check for this filter
            let colsToCheck: string[];
            if (filter.targetColumn) {
              // Look for the target column (case-insensitive match)
              const matchingCol = columnsArray.find(c => 
                c.toLowerCase().includes(filter.targetColumn!.toLowerCase()) ||
                filter.targetColumn!.toLowerCase().includes(c.toLowerCase())
              );
              colsToCheck = matchingCol ? [matchingCol] : columnsArray;
            } else {
              colsToCheck = columnsArray;
            }
            
            return colsToCheck.some(col => {
              const rawVal = getColumnValue(row, col);
              let numVal: number | null = null;
              
              if (typeof rawVal === 'number') {
                numVal = rawVal;
              } else if (typeof rawVal === 'string') {
                const percentMatch = rawVal.match(/^([\d.]+)\s*%?$/);
                if (percentMatch) {
                  numVal = parseFloat(percentMatch[1]);
                } else {
                  numVal = parseNumericValue(rawVal);
                }
              }
              
              if (numVal === null) return false;
              
              switch (filter.op) {
                case '<': return numVal < filter.value;
                case '>': return numVal > filter.value;
                case '<=': return numVal <= filter.value;
                case '>=': return numVal >= filter.value;
                case '=': return Math.abs(numVal - filter.value) <= tolerance;
                case 'between': return numVal >= filter.value && numVal <= (filter.value2 || filter.value);
                default: return false;
              }
            });
          });
          
          // Build description for this filter
          const opLabel = filter.op === '<' ? 'below' : filter.op === '>' ? 'above' : filter.op === '<=' ? 'at most' : filter.op === '>=' ? 'at least' : filter.op === 'between' ? 'between' : 'equal to';
          const colLabel = filter.targetColumn ? `${filter.targetColumn} ` : '';
          if (filter.isPercentage) {
            filterDescriptions.push(filter.op === 'between' 
              ? `${colLabel}${opLabel} ${filter.value}% and ${filter.value2}%`
              : `${colLabel}${opLabel} ${filter.value}%`);
          } else {
            const formattedVal = filter.value >= 1000000 
              ? `$${(filter.value/1000000).toFixed(1)}M` 
              : filter.value >= 1000 
                ? `$${(filter.value/1000).toFixed(0)}K`
                : `$${filter.value}`;
            filterDescriptions.push(filter.op === 'between'
              ? `${colLabel}${opLabel} ${formattedVal} and $${(filter.value2 || 0) >= 1000000 ? ((filter.value2 || 0)/1000000).toFixed(1) + 'M' : ((filter.value2 || 0)/1000).toFixed(0) + 'K'}`
              : `${colLabel}${opLabel} ${formattedVal}`);
          }
        }
      }
      
      // 7. Apply sorting (Top N / Bottom N)
      if (sortConfig) {
        // Find a numeric column to sort by
        const numericCol = columnsArray.find(col => {
          const sampleVal = getColumnValue(filteredData[0] || {}, col);
          return typeof sampleVal === 'number' || parseNumericValue(sampleVal) !== null;
        });
        
        if (numericCol) {
          filteredData.sort((a, b) => {
            const aVal = parseNumericValue(getColumnValue(a, numericCol)) || 0;
            const bVal = parseNumericValue(getColumnValue(b, numericCol)) || 0;
            return sortConfig!.direction === 'desc' ? bVal - aVal : aVal - bVal;
          });
          
          if (sortConfig.limit && filteredData.length > sortConfig.limit) {
            filteredData = filteredData.slice(0, sortConfig.limit);
          }
          
          filterDescriptions.push(`${sortConfig.direction === 'desc' ? 'top' : 'bottom'} ${sortConfig.limit || 'sorted'} by ${numericCol}`);
        }
      }
      
      // Fallback: simple text search if no filters applied
      if (filterDescriptions.length === 0) {
        const searchTerm = questionLower.replace(/\b(with|containing|includes?|has|show|find|get|list|projects?|records?)\b/gi, '').trim();
        if (searchTerm) {
          filteredData = data.filter(row => {
            return columnsArray.some(col => {
              const cellValue = getColumnValue(row, col);
              if (cellValue === null || cellValue === undefined) return false;
              return String(cellValue).toLowerCase().includes(searchTerm);
            });
          });
          filterDescriptions.push(`contains "${searchTerm}"`);
        }
      }
      
      const summaryMessage = filteredData.length > 0
        ? `Found ${filteredData.length} record${filteredData.length !== 1 ? 's' : ''} where ${columnsArray.join(' or ')} ${filterDescriptions.join(' AND ')}.`
        : `No records found where ${columnsArray.join(' or ')} ${filterDescriptions.join(' AND ')}.`;
      
      // Keep ALL columns in the filtered rows
      setColumnAnalysisModal(prev => ({
        ...prev,
        loading: false,
        response: {
          success: true,
          data: filteredData,
          ai_insights: summaryMessage,
          function_name: "column_filter",
          row_count: filteredData.length,
        } as QueryResponse,
      }));
      
      // Clear input but keep selection visible
      setAskAboutColumnsInput(prev => ({ ...prev, [messageId]: '' }));
      
    } catch (error) {
      console.error("Error filtering column data:", error);
      setColumnAnalysisModal(prev => ({
        ...prev,
        loading: false,
        response: {
          success: false,
          data: [],
          ai_insights: "Failed to filter the selected columns. Please try again.",
          function_name: "error",
        } as QueryResponse,
      }));
    } finally {
      setAskAboutColumnsLoading(prev => ({ ...prev, [messageId]: false }));
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      
      // Clear local state
      setMessages([]);
      setCurrentChatId(null);
      setSelectedChats(new Set());
      setInput("");
      setSearchQuery("");
      
      // Set user to null in cache to trigger unauthenticated view immediately
      queryClient.setQueryData(["/api/auth/user"], null);
      // Clear all other cached queries
      queryClient.clear();
      
      // Use wouter navigation instead of hard reload for smooth transition
      setLocation("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "Please try again",
      });
    }
  };

  // React Query hooks for database-backed storage
  const { data: chats = [], isLoading: chatsLoading } = useChats();
  const { data: currentMessages = [], isLoading: messagesLoading, isFetching: messagesFetching } = useMessages(currentChatId);
  const createChatMutation = useCreateChat();
  const deleteChatMutation = useDeleteChat();
  const updateChatMutation = useUpdateChat();
  const createMessageMutation = useCreateMessage();
  
  // Fetch FAQ sample questions for home page
  const { data: faqSamplesData } = useQuery<{ success: boolean; data: FAQSampleQuestion[] }>({
    queryKey: ['/api/faq-samples'],
  });
  
  // Check if current user is admin (for activity page access)
  const { data: adminCheckData } = useQuery<{ isAdmin: boolean } | null>({
    queryKey: ['/api/admin/check'],
    queryFn: async () => {
      const res = await fetch('/api/admin/check', { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: "always",
  });
  const isAdmin = adminCheckData?.isAdmin === true;
  
  // Fetch current user data for role-based access control
  const { data: currentUserData } = useQuery<{ id: string; email: string; role?: string } | null>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: "always",
  });
  
  // Use embed role if in embed mode, otherwise use user role from auth
  const userRole = isEmbed && embedContext?.role ? embedContext.role : (currentUserData?.role || 'user');
  const isSuperadmin = userRole === 'superadmin';
  const isAdminOrAbove = userRole === 'superadmin' || userRole === 'admin';
  const canViewQueryLogs = isAdminOrAbove; // Superadmin sees all logs, admin sees only their own logs
  const canViewLogsTab = isAdminOrAbove; // Superadmin and admin can see Logs tab
  const canManageFAQ = isAdminOrAbove; // Superadmin and admin can add/edit FAQ samples
  const canEditChat = isAdminOrAbove; // Superadmin and admin can edit chat titles
  
  // Fetch hidden FAQs from server (persisted per-user in database)
  const { data: hiddenFaqsData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/hidden-faqs"],
    refetchOnMount: "always",
    staleTime: 0,
  });
  
  const hiddenDefaults = hiddenFaqsData?.data || [];

  // Mutation to add a hidden FAQ
  const addHiddenFaqMutation = useMutation({
    mutationFn: async (faqText: string) => {
      return apiRequest("POST", "/api/hidden-faqs", { faqText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hidden-faqs"] });
    },
  });
  
  // Session keepalive - ping auth endpoint every 10 minutes to prevent session expiration
  // Helper to get embed token for fetch calls
  const getEmbedHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    try {
      const embedToken = sessionStorage.getItem('embedToken');
      if (embedToken) {
        headers['X-Embed-Token'] = embedToken;
      }
    } catch {}
    return headers;
  };
  
  useEffect(() => {
    // Skip keepalive in embed mode - embed tokens are stateless
    if (isEmbed) return;
    
    const keepaliveInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/user', { 
          credentials: 'include',
          headers: getEmbedHeaders()
        });
        if (!response.ok) {
          console.warn('[ChatPage] Session check failed, session may have expired');
          // Don't redirect here - let the next action handle it
        }
      } catch (error) {
        console.warn('[ChatPage] Session keepalive ping failed:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(keepaliveInterval);
  }, [isEmbed]);
  
  // Function to hide a default example (persisted in database)
  const hideDefaultExample = (text: string) => {
    // Prevent duplicates
    if (hiddenDefaults.includes(text)) return;
    addHiddenFaqMutation.mutate(text);
    toast({
      title: "Example removed",
      description: "This example will no longer appear",
    });
  };
  
  // Get all unique categories (default + custom from FAQ samples + custom from chats + General)
  const allCategories = useMemo(() => {
    const faqSamples = faqSamplesData?.data || [];
    const customCategories = new Set<string>();
    
    // Include custom categories from FAQ samples
    faqSamples.forEach(sample => {
      // If not a default category, it's custom
      if (!DEFAULT_FAQ_CATEGORIES.includes(sample.category as any)) {
        customCategories.add(sample.category);
      }
    });
    
    // Include categories from chats
    chats.forEach(chat => {
      if (chat.faq_category && !DEFAULT_FAQ_CATEGORIES.includes(chat.faq_category as any)) {
        customCategories.add(chat.faq_category);
      }
    });
    
    // Remove "General" from custom categories if it exists (to avoid duplicates)
    customCategories.delete("General");
    
    // Always include "General" for uncategorized chats, and put it first
    return ["General", ...DEFAULT_FAQ_CATEGORIES, ...Array.from(customCategories).sort()];
  }, [faqSamplesData, chats]);
  
  // Merge default examples with user-defined FAQ samples (including custom categories)
  // Now tracks which items are user FAQs (with IDs for deletion and chatId for loading)
  interface QueryItem {
    text: string;
    id?: string; // Message ID - only present for user-added FAQs
    chatId?: string; // Chat ID - for loading the original chat when clicked
    isUserFaq: boolean;
  }
  
  const mergedExampleQueries = useMemo(() => {
    const faqSamples = faqSamplesData?.data || [];
    
    // Group FAQ samples by category with full data
    const faqByCategory: Record<string, QueryItem[]> = {};
    faqSamples.forEach(sample => {
      if (!faqByCategory[sample.category]) {
        faqByCategory[sample.category] = [];
      }
      faqByCategory[sample.category].push({
        text: sample.displayText || sample.question,
        id: sample.id,
        chatId: sample.chatId, // Include chatId for loading the original chat
        isUserFaq: true,
      });
    });
    
    // Create array with default categories (merging in user queries)
    const defaultGroups = exampleQueries.map(group => {
      const userQueries = faqByCategory[group.category] || [];
      delete faqByCategory[group.category]; // Remove so we don't duplicate
      
      // Convert default queries to QueryItem format, filtering out hidden ones
      const defaultItems: QueryItem[] = group.queries
        .filter(q => !hiddenDefaults.includes(q)) // Filter out hidden defaults
        .map(q => ({
          text: q,
          isUserFaq: false,
        }));
      
      return {
        ...group,
        queryItems: [...userQueries, ...defaultItems], // User queries first
      };
    });
    
    // Add custom category groups (those not in defaults)
    const customGroups = Object.entries(faqByCategory).map(([category, queryItems]) => ({
      icon: Star, // Use Star icon for custom categories
      category,
      queryItems,
    }));
    
    return [...defaultGroups, ...customGroups];
  }, [faqSamplesData, hiddenDefaults]);
  
  // Edit chat state - now uses a dialog instead of inline edit
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsMessageId, setChatSettingsMessageId] = useState<string | null>(null);
  const [chatSettingsMessageContent, setChatSettingsMessageContent] = useState("");
  const [chatSettingsIsFaq, setChatSettingsIsFaq] = useState(false);
  const [chatSettingsFaqCategory, setChatSettingsFaqCategory] = useState("");
  const [chatSettingsLoading, setChatSettingsLoading] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  
  // FAQ edit state (for message-level FAQ dialog - keeping for backward compatibility)
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [faqEditMessageId, setFaqEditMessageId] = useState<string | null>(null);
  const [faqIsFaq, setFaqIsFaq] = useState(false);
  const [faqCategory, setFaqCategory] = useState("");

  // Error log dialog state
  const [errorLogDialogOpen, setErrorLogDialogOpen] = useState(false);
  const [errorLogMessageId, setErrorLogMessageId] = useState<string | null>(null);
  const [errorLogQuestion, setErrorLogQuestion] = useState("");
  const [errorLogErrorMessage, setErrorLogErrorMessage] = useState("");
  const [errorLogComment, setErrorLogComment] = useState("");
  const [errorLogLoading, setErrorLogLoading] = useState(false);
  const [errorLogScreenshot, setErrorLogScreenshot] = useState<File | null>(null);

  // Keep ref in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Track the chat ID we're loading to avoid race conditions
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  
  // Handle URL parameter to load specific chat (from error logs page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatIdFromUrl = params.get('chat');
    
    if (chatIdFromUrl && !currentChatId) {
      console.log('[ChatPage] Loading chat from URL parameter:', chatIdFromUrl);
      setCurrentChatId(chatIdFromUrl);
      setLoadingChatId(chatIdFromUrl);
      
      // Clear the URL parameter to prevent reloading on refresh
      window.history.replaceState({}, '', '/');
    }
  }, [currentChatId]);
  
  // Load messages when switching to a saved chat
  useEffect(() => {
    // Only load if we have a chat ID we're waiting to load
    if (!loadingChatId || !currentChatId || loadingChatId !== currentChatId) {
      return;
    }
    
    // Wait until messages are done fetching
    if (messagesLoading || messagesFetching) {
      return;
    }

    // Convert DB messages to local format
    const convertedMessages: Message[] = currentMessages.map((msg: any) => ({
      id: msg.id,
      type: msg.type as "user" | "bot",
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      response: msg.response as QueryResponse | undefined,
      aiAnalysisMessages: msg.aiAnalysisMessages as AIAnalysisMessage[] | undefined,
    }));
    
    // IMPORTANT: Preserve any optimistic messages AND optimistic aiAnalysisMessages
    // This prevents follow-up questions from disappearing when server data is fetched
    setMessages(prev => {
      // Find any messages that are NOT in the loaded messages (optimistic/pending)
      const loadedIds = new Set(convertedMessages.map(m => m.id));
      const optimisticMessages = prev.filter(m => !loadedIds.has(m.id));
      
      // Merge aiAnalysisMessages: if local state has more follow-ups than server, preserve local
      const mergedMessages = convertedMessages.map(serverMsg => {
        const localMsg = prev.find(m => m.id === serverMsg.id);
        if (localMsg && localMsg.aiAnalysisMessages) {
          const serverFollowUps = serverMsg.aiAnalysisMessages?.length || 0;
          const localFollowUps = localMsg.aiAnalysisMessages.length;
          // If local has more follow-ups (optimistic updates), use local's aiAnalysisMessages
          if (localFollowUps > serverFollowUps) {
            console.log('[ChatPage] Preserving optimistic aiAnalysisMessages:', localFollowUps, 'vs server:', serverFollowUps);
            return { ...serverMsg, aiAnalysisMessages: localMsg.aiAnalysisMessages };
          }
        }
        return serverMsg;
      });
      
      // If there are optimistic messages, append them to the loaded messages
      if (optimisticMessages.length > 0) {
        console.log('[ChatPage] Preserving optimistic messages:', optimisticMessages.length);
        return [...mergedMessages, ...optimisticMessages];
      }
      return mergedMessages;
    });
    setLoadingChatId(null); // Done loading
  }, [loadingChatId, currentChatId, currentMessages, messagesLoading, messagesFetching]);

  // EAGER PREFETCH: Load messages for first 5 chats immediately when page loads
  // This makes switching between recent chats instant
  useEffect(() => {
    if (chats.length > 0 && !chatsLoading) {
      // Prefetch top 5 most recent chats (excluding current)
      const chatsToPreload = chats
        .filter(chat => chat.id !== currentChatId)
        .slice(0, 5);
      
      chatsToPreload.forEach(chat => {
        prefetchMessages(queryClient, chat.id);
      });
    }
  }, [chats, chatsLoading, currentChatId, queryClient]);

  // Filter chats based on search and category
  // Chats without a category are treated as "General"
  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const matchesSearch = chat.title.toLowerCase().includes(searchQuery.toLowerCase());
      // Treat null/undefined category as "General"
      const chatCategory = chat.faq_category || "General";
      const matchesCategory = categoryFilter === "all" || chatCategory === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [chats, searchQuery, categoryFilter]);

  // Query mutation
  // Mutation for updating message AI analysis follow-ups
  const updateMessageAIAnalysisMutation = useMutation({
    mutationFn: async ({ chatId, messageId, aiAnalysisMessages }: { 
      chatId: string; 
      messageId: string; 
      aiAnalysisMessages: AIAnalysisMessage[] 
    }) => {
      console.log('[ChatPage] Saving AI Analysis follow-ups to database:', { chatId, messageId, count: aiAnalysisMessages.length });
      return await apiRequest("PATCH", `/api/chats/${chatId}/messages/${messageId}`, { 
        ai_analysis_messages: aiAnalysisMessages 
      });
    },
    onSuccess: () => {
      console.log('[ChatPage] AI Analysis follow-ups saved successfully');
    },
    onError: (error) => {
      console.error('[ChatPage] Failed to save AI Analysis follow-ups:', error);
      toast({
        variant: "destructive",
        title: "Failed to save follow-up conversation",
        description: "Your follow-up will be lost when you switch chats.",
      });
    }
  });

  // Mutation for updating message FAQ status
  const updateMessageFAQMutation = useMutation({
    mutationFn: async ({ chatId, messageId, is_faq, faq_category, faq_display_text }: { 
      chatId: string; 
      messageId: string; 
      is_faq: boolean;
      faq_category: string | null;
      faq_display_text?: string | null;
    }) => {
      console.log('[ChatPage] Updating FAQ status:', { chatId, messageId, is_faq, faq_category, faq_display_text });
      return await apiRequest("PATCH", `/api/chats/${chatId}/messages/${messageId}`, { 
        is_faq,
        faq_category: is_faq ? faq_category : null,
        faq_display_text: is_faq ? faq_display_text : null,
      });
    },
    onSuccess: () => {
      console.log('[ChatPage] FAQ status updated successfully');
      toast({
        title: "FAQ updated",
        description: faqIsFaq ? "Question marked as FAQ sample" : "FAQ status removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faq-samples'] });
      // Also invalidate chats to update sidebar category display
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
    onError: (error) => {
      console.error('[ChatPage] Failed to update FAQ status:', error);
      toast({
        variant: "destructive",
        title: "Failed to update FAQ status",
        description: "Please try again.",
      });
    }
  });
  
  // Mutation for deleting FAQ sample
  const deleteFAQSampleMutation = useMutation({
    mutationFn: async (messageId: string) => {
      console.log('[ChatPage] Deleting FAQ sample:', messageId);
      return await apiRequest("DELETE", `/api/faq-samples/${messageId}`);
    },
    onSuccess: () => {
      console.log('[ChatPage] FAQ sample deleted successfully');
      toast({
        title: "FAQ removed",
        description: "Question removed from FAQ samples",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faq-samples'] });
      // Also invalidate chats to update sidebar category display
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
    onError: (error) => {
      console.error('[ChatPage] Failed to delete FAQ sample:', error);
      toast({
        variant: "destructive",
        title: "Failed to remove FAQ",
        description: "Please try again.",
      });
    }
  });

  // Function to delete entire category (all FAQ samples in that category)
  const handleDeleteCategory = async (categoryName: string) => {
    const faqSamples = faqSamplesData?.data || [];
    const samplesInCategory = faqSamples.filter(sample => sample.category === categoryName);
    
    if (samplesInCategory.length === 0) {
      toast({
        title: "Category empty",
        description: "No FAQ samples to delete in this category.",
      });
      return;
    }
    
    try {
      // Delete all FAQ samples in this category (id is the message ID)
      await Promise.all(
        samplesInCategory.map(sample => 
          apiRequest("DELETE", `/api/faq-samples/${sample.id}`)
        )
      );
      
      toast({
        title: "Category deleted",
        description: `Removed ${samplesInCategory.length} FAQ sample${samplesInCategory.length > 1 ? 's' : ''} from "${categoryName}"`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/faq-samples'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    } catch (error) {
      console.error('[ChatPage] Failed to delete category:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete category",
        description: "Please try again.",
      });
    }
  };

  const queryMutation = useMutation({
    mutationFn: async ({ question, tempUserMessageId, forceNewChat }: { question: string; tempUserMessageId: string; forceNewChat?: boolean }) => {
      // MAIN INPUT QUERIES: Detect follow-up patterns and include context if needed
      console.log('[ChatPage] Sending query:', question, forceNewChat ? '(FORCE NEW CHAT)' : '');
      
      // If forcing new chat, skip follow-up detection
      if (forceNewChat) {
        console.log('[ChatPage] Skipping follow-up detection - forcing new chat');
        const res = await apiRequest("POST", "/api/query", { question });
        const data = await res.json() as Promise<QueryResponse>;
        console.log('[ChatPage] Response:', data);
        return data;
      }
      
      // Detect follow-up patterns that reference previous results
      const followUpPatterns = [
        /\b(in\s+above|from\s+above|in\s+these|from\s+these|of\s+these|above\s+results?)\b/i,
        /\b(bottom|top|first|last|lowest|highest|smallest|largest)\s*\d+\s*(in|from|of)?\s*(above|these|the\s+results?)?\b/i,
      ];
      
      const looksLikeFollowUp = followUpPatterns.some(pattern => pattern.test(question));
      
      // Build context from most recent assistant message if this looks like a follow-up
      let previousContext = undefined;
      let originalContext = undefined;
      
      if (looksLikeFollowUp && messages.length > 0) {
        // Find the most recent bot message with valid response data
        const recentBotMessages = [...messages].reverse().filter(m => m.type === 'bot' && m.response?.function_name);
        const lastBotMessage = recentBotMessages[0];
        
        if (lastBotMessage?.response?.function_name && lastBotMessage?.response?.arguments) {
          previousContext = {
            question: lastBotMessage.originalQuestion || lastBotMessage.response.question || '',
            function_name: lastBotMessage.response.function_name,
            arguments: lastBotMessage.response.arguments,
          };
          originalContext = previousContext; // For simple follow-ups, original = previous
          console.log('[ChatPage] 🔄 FOLLOW-UP DETECTED in main input:', question);
          console.log('[ChatPage] 📎 Using context from previous message:', previousContext.function_name);
        }
      }
      
      if (!previousContext) {
        console.log('[ChatPage] Previous context:', 'None (new query or no valid previous message)');
      }

      const res = await apiRequest("POST", "/api/query", { 
        question,
        ...(previousContext && { previousContext }),
        ...(originalContext && { originalContext }),
      });
      const data = await res.json() as Promise<QueryResponse>;
      console.log('[ChatPage] Response:', data);
      return data;
    },
    onSuccess: async (data, variables) => {
      try {
        const tempBotMessageId = Date.now().toString();
        // Always ensure the original question is preserved in the response
        const responseWithQuestion = {
          ...data,
          question: data.question || variables.question, // Fallback to original input
        };
        const botMessage: Message = {
          id: tempBotMessageId,
          type: "bot",
          content: data.message || "Query executed successfully",
          timestamp: new Date(),
          response: responseWithQuestion,
          originalQuestion: variables.question, // Store original question separately
          _tempId: tempBotMessageId, // Store temp ID for follow-up lookups after ID changes
        };

        setMessages((prev) => [...prev, botMessage]);

        // Save chat and messages to database
        // If forceNewChat is true, always create a new chat (ignore currentChatId)
        let chatId = variables.forceNewChat ? null : currentChatId;
        
        if (!chatId) {
          // Create new chat - first verify session is still valid (skip in embed mode)
          try {
            // Quick auth check before creating chat
            const authCheck = await fetch('/api/auth/user', { 
              credentials: 'include',
              headers: getEmbedHeaders()
            });
            if (!authCheck.ok && !isEmbed) {
              console.error('[ChatPage] ✗ Session expired, redirecting to login');
              toast({
                variant: "destructive",
                title: "Session Expired",
                description: "Please log in again to continue.",
                duration: 3000,
              });
              queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              setLocation("/");
              return;
            }
            
            console.log('[ChatPage] Creating new chat with title:', variables.question);
            const newChat = await createChatMutation.mutateAsync({
              title: variables.question
            });
            console.log('[ChatPage] ✓ Chat created successfully:', newChat);
            chatId = newChat.id;
            setCurrentChatId(chatId);
          } catch (storageError: any) {
            // Check if this is an auth error (401)
            const isAuthError = storageError?.message?.toLowerCase().includes('unauthorized') ||
                               storageError?.message?.includes('401');
            
            console.error("[ChatPage] ✗ Failed to create chat:", {
              error: storageError,
              message: storageError?.message,
              isAuthError,
            });
            
            if (isAuthError) {
              toast({
                variant: "destructive",
                title: "Session Expired",
                description: "Please log in again to continue.",
                duration: 3000,
              });
              queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              setLocation("/");
              return;
            }
            
            toast({
              variant: "destructive",
              title: "Database Error",
              description: storageError?.message || "Failed to save chat. Please try again.",
              duration: 5000,
            });
            // Continue without saving - UI should still work
          }
        }

        // Save user message and bot response to database
        // IMPORTANT: Use mutateAsync to get server-assigned IDs for both
        if (chatId) {
          // Save user message and UPDATE local state with server-assigned ID
          try {
            const savedUserMessage = await createMessageMutation.mutateAsync({
              chatId,
              type: "user",
              content: variables.question,
            });
            
            // Update the local user message with the server-assigned ID
            console.log('[ChatPage] ✓ User message saved with ID:', savedUserMessage.id);
            setMessages(prev => prev.map(m => 
              m.id === variables.tempUserMessageId ? { ...m, id: savedUserMessage.id } : m
            ));
          } catch (error) {
            console.error('[ChatPage] ✗ Failed to save user message:', error);
            // Continue with temp ID if save fails
          }

          // Save bot message and UPDATE local state with server-assigned ID
          try {
            const savedBotMessage = await createMessageMutation.mutateAsync({
              chatId,
              type: "bot",
              content: botMessage.content,
              response: data,
            });
            
            // Update the local message with the server-assigned ID
            console.log('[ChatPage] ✓ Bot message saved with ID:', savedBotMessage.id);
            setMessages(prev => prev.map(m => 
              m.id === tempBotMessageId ? { ...m, id: savedBotMessage.id } : m
            ));
          } catch (error) {
            console.error('[ChatPage] ✗ Failed to save bot message:', error);
            // Continue with temp ID if save fails
          }
        }

        // Only show toast for rate limit errors, not for "don't know" responses
        if (!data.success && data.error === "rate_limit") {
          toast({
            title: "High Demand",
            description: "Many users are querying at once. Please try again in a moment.",
          });
        }
        
        // Auto-log queries that don't return table data
        // Log: errors, AI fallbacks, AI analysis, empty results
        // Skip: off_topic, restricted_operation, rate_limit (user errors)
        // Skip: successful queries with actual table data
        const skipAutoLogErrors = ["off_topic", "restricted_operation", "rate_limit"];
        const isActualError = !data.success && data.error && !skipAutoLogErrors.includes(data.error);
        
        // Check if this is an AI-assisted response (no real table data)
        const isAIFallback = data.function_name === "ai_fallback" || 
                            data.function_name === "provide_simple_answer" ||
                            (data.data?.[0]?.is_fallback === true);
        
        // Check if this is AI data analysis (conceptual/analytical response)
        const isAIAnalysis = data.function_name === "ai_data_analysis" ||
                            (data.data?.[0]?.type === "ai_analysis" && !data.data?.[0]?.is_fallback);
        
        // Check if query returned no data (0 results)
        const hasNoData = data.success && (data.row_count === 0 || !data.data || data.data.length === 0);
        
        // Skip disambiguation queries - these are intermediate steps, not failures
        const isDisambiguation = data.function_name === "disambiguation_required";
        
        // Auto-log if any of these conditions are true (but never for disambiguation)
        const shouldAutoLog = !isDisambiguation && (isActualError || isAIFallback || hasNoData);
        
        if (shouldAutoLog && chatId) {
          try {
            let logReason = "[Auto-logged] ";
            if (isActualError) {
              logReason += "Query failed to execute";
            } else if (isAIFallback) {
              logReason += "Query handled by AI fallback";
            } else if (isAIAnalysis) {
              logReason += "Query required AI analysis (no direct data)";
            } else if (hasNoData) {
              logReason += "Query returned no results";
            }
            
            // For auto-logging, use the current question directly
            // The messages state may be stale due to React's async state updates,
            // especially when forceNewChat resets the messages array
            // Using variables.question ensures we log exactly what was sent
            const fullConversation = variables.question;
            
            console.log('[ChatPage] Auto-logging to Query Logs:', data.function_name || data.error);
            
            // Get a clean, short error message (not JSON)
            let cleanErrorMessage = "Query required AI assistance";
            if (data.message && typeof data.message === 'string' && data.message.length < 200 && !data.message.startsWith('{')) {
              cleanErrorMessage = data.message;
            } else if (data.data?.[0]?.message && typeof data.data[0].message === 'string' && data.data[0].message.length < 200) {
              cleanErrorMessage = data.data[0].message;
            } else if (isAIFallback) {
              cleanErrorMessage = "Query handled by AI fallback";
            } else if (isAIAnalysis) {
              cleanErrorMessage = "AI analysis response";
            } else if (hasNoData) {
              cleanErrorMessage = "No matching records found";
            }
            
            await apiRequest("POST", "/api/error-logs", {
              session_id: "auto-logged",
              chat_id: chatId,
              message_id: tempBotMessageId,
              question: fullConversation,
              error_message: cleanErrorMessage,
              user_comment: logReason,
            });
            console.log('[ChatPage] ✓ Query auto-logged to Query Logs');
            // Invalidate error-logs cache so Logs page refreshes automatically
            queryClient.invalidateQueries({ queryKey: ['/api/error-logs'] });
          } catch (logError) {
            console.error('[ChatPage] ✗ Failed to auto-log:', logError);
            // Don't show toast for logging failure - not critical
          }
        }
      } catch (error) {
        console.error("Error in onSuccess callback:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to process response",
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: String(error),
      });
    },
    onSettled: () => {
      setClickedDisambiguationButton(null);
    },
  });

  // Delete chat from database
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChatMutation.mutateAsync(chatId);
      toast({
        title: "Chat deleted",
        description: "Successfully deleted the chat",
      });
      if (currentChatId && chatId === currentChatId) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete chat. Please try again.",
      });
    }
  };
  
  // AbortController ref for cleanup
  const chatSettingsAbortRef = useRef<AbortController | null>(null);
  
  // Start editing a chat - now opens the Chat Settings dialog
  const handleStartEdit = async (chatId: string, currentTitle: string) => {
    // Abort any pending request
    if (chatSettingsAbortRef.current) {
      chatSettingsAbortRef.current.abort();
    }
    
    const abortController = new AbortController();
    chatSettingsAbortRef.current = abortController;
    
    setEditingChatId(chatId);
    setEditTitle(currentTitle);
    setChatSettingsLoading(true);
    setChatSettingsOpen(true);
    
    // Fetch the first user message to get FAQ status
    try {
      const headers: Record<string, string> = {};
      const embedToken = sessionStorage.getItem('embedToken');
      if (embedToken) {
        headers['X-Embed-Token'] = embedToken;
      }
      
      const response = await fetch(`/api/chats/${chatId}/first-user-message`, {
        credentials: 'include',
        headers,
        signal: abortController.signal,
      });
      
      // Check if aborted
      if (abortController.signal.aborted) return;
      
      // Handle non-OK responses
      if (!response.ok) {
        console.error("Failed to fetch first user message:", response.status);
        setChatSettingsMessageId(null);
        setChatSettingsMessageContent("");
        setChatSettingsIsFaq(false);
        setChatSettingsFaqCategory("");
        setChatSettingsLoading(false);
        return;
      }
      
      const data = await response.json();
      
      // Check if aborted after parsing
      if (abortController.signal.aborted) return;
      
      if (data.success && data.data) {
        setChatSettingsMessageId(data.data.id);
        setChatSettingsMessageContent(data.data.content);
        setChatSettingsIsFaq(data.data.is_faq || false);
        setChatSettingsFaqCategory(data.data.faq_category || "");
      } else {
        setChatSettingsMessageId(null);
        setChatSettingsMessageContent("");
        setChatSettingsIsFaq(false);
        setChatSettingsFaqCategory("");
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error?.name === 'AbortError') return;
      
      console.error("Failed to fetch first user message:", error);
      setChatSettingsMessageId(null);
      setChatSettingsMessageContent("");
      setChatSettingsIsFaq(false);
      setChatSettingsFaqCategory("");
    } finally {
      // Only update loading state if not aborted
      if (!abortController.signal.aborted) {
        setChatSettingsLoading(false);
      }
    }
  };
  
  // Close the Chat Settings dialog
  const handleCloseChatSettings = () => {
    // Abort any pending fetch request
    if (chatSettingsAbortRef.current) {
      chatSettingsAbortRef.current.abort();
      chatSettingsAbortRef.current = null;
    }
    
    setChatSettingsOpen(false);
    setEditingChatId(null);
    setEditTitle("");
    setChatSettingsMessageId(null);
    setChatSettingsMessageContent("");
    setChatSettingsIsFaq(false);
    setChatSettingsFaqCategory("");
    setChatSettingsLoading(false);
    setCategoryPopoverOpen(false);
    setNewCategoryInput("");
  };
  
  // Save Chat Settings (title + FAQ)
  const handleSaveChatSettings = async () => {
    if (!editingChatId || !editTitle.trim()) return;
    
    // Validation: if marking as FAQ, category is required
    if (chatSettingsIsFaq && !chatSettingsFaqCategory) {
      toast({
        variant: "destructive",
        title: "Category required",
        description: "Please select a category for the FAQ sample.",
      });
      return;
    }
    
    try {
      // Update the chat title
      await updateChatMutation.mutateAsync({ 
        chatId: editingChatId, 
        title: editTitle.trim() 
      });
      
      // Update FAQ status if we have a message ID
      if (chatSettingsMessageId) {
        // Use the custom chat title as the FAQ display text so it shows on home page
        const displayText = editTitle.trim() !== chatSettingsMessageContent ? editTitle.trim() : null;
        
        await updateMessageFAQMutation.mutateAsync({
          chatId: editingChatId,
          messageId: chatSettingsMessageId,
          is_faq: chatSettingsIsFaq,
          faq_category: chatSettingsIsFaq && chatSettingsFaqCategory ? chatSettingsFaqCategory : null,
          faq_display_text: chatSettingsIsFaq ? displayText : null,
        });
        
        // Invalidate FAQ samples to refresh home page
        queryClient.invalidateQueries({ queryKey: ['/api/faq-samples'] });
      }
      
      toast({
        title: "Chat updated",
        description: chatSettingsIsFaq ? "Chat saved and marked as FAQ sample" : "Chat settings updated",
      });
      
      handleCloseChatSettings();
    } catch (error) {
      console.error("Failed to update chat settings:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update chat settings. Please try again.",
      });
    }
  };
  
  // Legacy: Save edited chat title (keeping for inline edits if any)
  const handleSaveEdit = async () => {
    if (!editingChatId || !editTitle.trim()) return;
    
    try {
      await updateChatMutation.mutateAsync({ 
        chatId: editingChatId, 
        title: editTitle.trim() 
      });
      toast({
        title: "Chat updated",
        description: "Successfully updated the chat title",
      });
      setEditingChatId(null);
      setEditTitle("");
    } catch (error) {
      console.error("Failed to update chat:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update chat title. Please try again.",
      });
    }
  };

  // Open FAQ edit dialog for a message
  const handleOpenFaqDialog = (messageId: string) => {
    // Find the user message that corresponds to this bot message
    // In the current design, we look for the user message before this bot message
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1];
      if (userMessage && userMessage.type === "user") {
        setFaqEditMessageId(userMessage.id);
        setFaqIsFaq(false); // Default to not checked
        setFaqCategory("");
        setFaqDialogOpen(true);
        return;
      }
    }
    // Fallback: use the bot message's ID but look for user question in response
    setFaqEditMessageId(messageId);
    setFaqIsFaq(false);
    setFaqCategory("");
    setFaqDialogOpen(true);
  };

  // Save FAQ settings
  const handleSaveFaq = async () => {
    if (!currentChatId || !faqEditMessageId) return;
    
    // Validation: if marking as FAQ, category is required
    if (faqIsFaq && !faqCategory) {
      toast({
        variant: "destructive",
        title: "Category required",
        description: "Please select a category for the FAQ sample.",
      });
      return;
    }
    
    try {
      await updateMessageFAQMutation.mutateAsync({
        chatId: currentChatId,
        messageId: faqEditMessageId,
        is_faq: faqIsFaq,
        faq_category: faqIsFaq && faqCategory ? faqCategory : null,
      });
      setFaqDialogOpen(false);
      setFaqEditMessageId(null);
    } catch (error) {
      console.error("Failed to update FAQ status:", error);
    }
  };

  // Open error log dialog for a message
  const handleOpenErrorLogDialog = (message: Message) => {
    const currentQuestion = message.response?.question || message.originalQuestion || message.content;
    
    // Build full conversation context (all user questions from this chat)
    const userMessages = messages.filter(m => m.type === "user");
    const currentMsgIndex = userMessages.findIndex(m => m.content === currentQuestion);
    
    // Include all questions up to and including the current one
    const relevantQuestions = userMessages
      .slice(0, currentMsgIndex >= 0 ? currentMsgIndex + 1 : userMessages.length)
      .map((m, idx) => `Q${idx + 1}: ${m.content}`)
      .join("\n");
    
    // Also include follow-up questions if any
    const followUpQuestions = (message.aiAnalysisMessages || [])
      .filter(m => m.type === 'user' && m.content)
      .map((m, idx) => `F${idx + 1}: ${m.content}`)
      .join("\n");
    
    const fullConversation = followUpQuestions 
      ? `${relevantQuestions || `Q1: ${currentQuestion}`}\n${followUpQuestions}`
      : (relevantQuestions || `Q1: ${currentQuestion}`);
    
    // For successful queries, show a different message indicating it's about wrong results
    const errorMessage = message.response?.success 
      ? "Results may be incorrect or unexpected"
      : (message.response?.message || message.response?.error || "Unknown error");
    
    setErrorLogMessageId(message.id);
    setErrorLogQuestion(fullConversation);
    setErrorLogErrorMessage(errorMessage);
    setErrorLogComment("");
    setErrorLogScreenshot(null);
    setErrorLogDialogOpen(true);
  };

  // Submit error log
  const handleSubmitErrorLog = async () => {
    if (!currentChatId || !errorLogComment.trim()) {
      toast({
        variant: "destructive",
        title: "Comment required",
        description: "Please add a comment describing the issue.",
      });
      return;
    }
    
    setErrorLogLoading(true);
    try {
      const response = await apiRequest("POST", "/api/error-logs", {
        chat_id: currentChatId,
        message_id: errorLogMessageId,
        question: errorLogQuestion,
        error_message: errorLogErrorMessage,
        user_comment: errorLogComment.trim(),
      });
      
      const errorLogData = await response.json();
      const errorLogId = errorLogData?.data?.id;
      
      // Upload screenshot if one was selected
      if (errorLogScreenshot && errorLogId) {
        try {
          const formData = new FormData();
          formData.append("screenshot", errorLogScreenshot);
          
          await fetch(`/api/error-logs/${errorLogId}/screenshot`, {
            method: "POST",
            body: formData,
            credentials: "include",
          });
        } catch (uploadError) {
          console.error("Failed to upload screenshot:", uploadError);
          // Don't fail the whole operation - the error log is already saved
        }
      }
      
      toast({
        title: "Query logged",
        description: "The query has been recorded for review.",
      });
      
      setErrorLogDialogOpen(false);
      setErrorLogMessageId(null);
      setErrorLogQuestion("");
      setErrorLogErrorMessage("");
      setErrorLogComment("");
      setErrorLogScreenshot(null);
      
      // Invalidate error logs cache
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
    } catch (error) {
      console.error("Failed to log error:", error);
      toast({
        variant: "destructive",
        title: "Failed to log query",
        description: "Please try again.",
      });
    } finally {
      setErrorLogLoading(false);
    }
  };

  // Bulk delete from database
  const handleBulkDelete = async () => {
    if (selectedChats.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedChats).map(chatId => deleteChatMutation.mutateAsync(chatId))
      );
      setSelectedChats(new Set());
      toast({
        title: "Chats deleted",
        description: `Successfully deleted ${selectedChats.size} chats`,
      });
      if (currentChatId && selectedChats.has(currentChatId)) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to bulk delete chats:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete some chats. Please try again.",
      });
    }
  };

  // Clear oldest chats to free up storage
  const handleClearOldChats = async () => {
    if (chats.length === 0) return;

    // Delete oldest 50% of chats or minimum 10 chats, whichever is greater
    const chatsToDelete = Math.max(10, Math.floor(chats.length * 0.5));
    const oldestChats = [...chats]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, chatsToDelete)
      .map(chat => chat.id);

    try {
      await Promise.all(
        oldestChats.map(chatId => deleteChatMutation.mutateAsync(chatId))
      );
      toast({
        title: "Storage Cleared",
        description: `Deleted ${oldestChats.length} oldest chats to free up space`,
      });

      if (currentChatId && oldestChats.includes(currentChatId)) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to clear old chats:", error);
      toast({
        variant: "destructive",
        title: "Clear failed",
        description: "Failed to clear old chats. Please try again.",
      });
    }
  };

  // Track the last submitted question to prevent duplicates
  const lastSubmittedRef = useRef<string>("");
  const submittingRef = useRef<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard against double submissions
    if (!input.trim() || queryMutation.isPending || submittingRef.current) {
      console.log('[handleSubmit] Blocked - already submitting or pending');
      return;
    }

    const questionToSend = input.trim();
    
    // Prevent exact duplicate submissions within same session
    if (questionToSend === lastSubmittedRef.current && queryMutation.isPending) {
      console.log('[handleSubmit] Blocked - duplicate question while pending');
      return;
    }
    
    // ALWAYS start a new chat when using the top input (main input)
    // Follow-up questions are only done via the inline follow-up inputs below responses
    const hasExistingChat = messages.length > 0;
    
    console.log('[handleSubmit] Has existing chat:', hasExistingChat);
    
    submittingRef.current = true;
    lastSubmittedRef.current = questionToSend;
    console.log('[handleSubmit] Submitting:', questionToSend);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: questionToSend,
      timestamp: new Date(),
    };

    // Clear input FIRST to prevent double submission from rapid clicks
    setInput("");
    
    if (hasExistingChat) {
      console.log('[handleSubmit] Starting new chat (main input always creates new chat)');
      // Start fresh chat with ONLY the new user message
      setMessages([userMessage]);
      setCurrentChatId(null);
      setAiAnalysisInputs({});
      setAiAnalysisLoading({});
      setActiveTabPerMessage({});
      setFollowUpTabs({});
      // Pass forceNewChat flag to ensure no context is carried over
      queryMutation.mutate({ question: questionToSend, tempUserMessageId: userMessage.id, forceNewChat: true });
    } else {
      // First message in empty chat
      setMessages([userMessage]);
      queryMutation.mutate({ question: questionToSend, tempUserMessageId: userMessage.id, forceNewChat: true });
    }
    
    // Reset the submitting flag after a short delay
    setTimeout(() => {
      submittingRef.current = false;
    }, 500);
    
    console.log('[handleSubmit] Input cleared, mutation started');
  };

  const handleExampleClick = (query: string) => {
    if (queryMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    // Continue in same chat context - disambiguation options should NOT force new chat
    // This prevents the "click twice" issue when selecting disambiguation columns
    queryMutation.mutate({ question: query, tempUserMessageId: userMessage.id, forceNewChat: false });
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setAiAnalysisInputs({});
    setAiAnalysisLoading({});
    setActiveTabPerMessage({});
    setFollowUpTabs({});
  };

  const handleSelectChat = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const handleLoadChat = (chatId: string) => {
    // Skip if already on this chat
    if (chatId === currentChatId) return;
    
    // Check if we have cached messages - instant switch like ChatGPT/Claude
    const cachedMessages = getCachedMessages(queryClient, chatId);
    
    if (cachedMessages && cachedMessages.length > 0) {
      // Instant switch - use cached data immediately
      const convertedMessages: Message[] = cachedMessages.map((msg: any) => ({
        id: msg.id,
        type: msg.type as "user" | "bot",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        response: msg.response as QueryResponse | undefined,
        aiAnalysisMessages: msg.aiAnalysisMessages as AIAnalysisMessage[] | undefined,
      }));
      setMessages(convertedMessages);
      setCurrentChatId(chatId);
      setSelectedChats(new Set());
      setLoadingChatId(null); // No loading needed
    } else {
      // No cache - show loading and fetch
      setMessages([]);
      setCurrentChatId(chatId);
      setLoadingChatId(chatId);
      setSelectedChats(new Set());
    }
  };
  
  // Prefetch chat messages on hover for instant switching
  const handleChatHover = (chatId: string) => {
    // Don't prefetch current chat
    if (chatId === currentChatId) return;
    prefetchMessages(queryClient, chatId);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Data copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please select and copy manually",
        variant: "destructive",
      });
    }
  };


  const handleAIAnalysis = async (messageId: string, question: string) => {
    if (!question.trim()) return;

    // SYNCHRONOUS GUARD: Prevent duplicate submissions (ref-based, instant check)
    if (followUpSubmittingRef.current.has(messageId)) {
      console.log(`[Follow-up] Synchronous guard: already submitting for message:`, messageId);
      return;
    }

    // GUARD: Prevent duplicate submissions while loading
    if (aiAnalysisLoading[messageId]) {
      console.log(`[Follow-up] Already loading for message:`, messageId, `- ignoring duplicate submission`);
      return;
    }

    // Mark as submitting IMMEDIATELY (synchronous, before any async setState)
    followUpSubmittingRef.current.add(messageId);

    // Find message by ID or by _tempId (handles race condition when ID changes after save)
    const message = messages.find(m => m.id === messageId || m._tempId === messageId);
    if (!message || !message.response) {
      followUpSubmittingRef.current.delete(messageId);
      return;
    }
    
    // Use the current message ID (may have changed from temp to server ID)
    const currentMessageId = message.id;

    // GUARD: Ensure response is fully ready (has function_name and arguments)
    // This prevents race conditions when user asks follow-up immediately after original response
    if (!message.response.function_name || !message.response.arguments) {
      console.log(`[Follow-up] Response not fully ready yet. function_name:`, message.response.function_name, `arguments:`, message.response.arguments);
      followUpSubmittingRef.current.delete(messageId);
      toast({
        title: "Please wait",
        description: "The response is still loading. Please try again in a moment.",
      });
      return;
    }

    // Check if we've reached the 3 follow-up question limit
    const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
    if (userFollowUpCount >= 3) {
      followUpSubmittingRef.current.delete(messageId);
      toast({
        variant: "destructive",
        title: "Follow-up Limit Reached",
        description: "Maximum 3 follow-up questions allowed. Please start a new query.",
      });
      return;
    }

    // Add user question to AI analysis messages with unique ID
    const userMsgId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userMsg: AIAnalysisMessage = {
      id: userMsgId,
      type: "user",
      content: question,
    };
    
    console.log(`[Follow-up] Adding user message with ID:`, userMsgId, `for parent message:`, currentMessageId, `(original:`, messageId, `)`);

    setMessages(prev => prev.map(m => 
      (m.id === currentMessageId || m._tempId === messageId)
        ? { ...m, aiAnalysisMessages: [...(m.aiAnalysisMessages || []), userMsg] }
        : m
    ));

    // Clear input for this message (use both old and new IDs for state cleanup)
    setAiAnalysisInputs(prev => ({ ...prev, [messageId]: "", [currentMessageId]: "" }));
    setAiAnalysisLoading(prev => ({ ...prev, [messageId]: true, [currentMessageId]: true }));

    try {
      // Check if this is an AI Analysis response (extraction-only mode)
      const isAIAnalysis = message.response.data?.[0]?.type === 'ai_analysis';
      
      // STAR PATTERN: ALL follow-ups should reference the ORIGINAL/ROOT message context
      // Find the most recent assistant message for previousContext (immediate results)
      const aiMessages = message.aiAnalysisMessages || [];
      const lastAssistantMessage = [...aiMessages].reverse().find(m => m.type === "assistant" && m.response);
      
      // originalContext = ROOT message (the message user clicked "Ask follow-up" on)
      // This preserves filters (dates, status, client, etc.) from the original query
      // IMPORTANT: Include ALL results for accurate "which of these" queries
      // Use the original question from the response, originalQuestion field, or the response.question
      // GUARD: Only include tabular data (skip AI Analysis format which has narrative/aggregates)
      const rootQuestion = message.response.question || message.originalQuestion || message.content.trim();
      const rootDataIsTabular = message.response.data && message.response.data.length > 0 && 
        message.response.data[0]?.type !== 'ai_analysis';
      const originalContext = message.response.function_name && message.response.arguments ? {
        question: rootQuestion,
        function_name: message.response.function_name,
        arguments: message.response.arguments,
        result_data: rootDataIsTabular ? message.response.data : undefined,
      } : undefined;
      
      console.log(`[Follow-up] Root question:`, rootQuestion);
      console.log(`[Follow-up] Original context built:`, originalContext ? 'YES' : 'NO');
      console.log(`[Follow-up] Original function_name:`, message.response.function_name);
      console.log(`[Follow-up] Original arguments:`, message.response.arguments);
      
      // For AI Analysis: ALL follow-ups extract from the ORIGINAL narrative
      // For regular queries: Use the most recent follow-up result for anaphora like "these projects"
      // GUARD: Only include tabular data from follow-up responses
      // GUARD: Only build previousContext if function_name exists (required by schema)
      const lastAssistantDataIsTabular = lastAssistantMessage?.response?.data && 
        lastAssistantMessage.response.data.length > 0 && 
        lastAssistantMessage.response.data[0]?.type !== 'ai_analysis';
      const canBuildPreviousContext = lastAssistantMessage?.response?.function_name;
      const previousContext = isAIAnalysis 
        ? originalContext  // Always use original AI Analysis narrative for extraction
        : (canBuildPreviousContext ? {
            question: lastAssistantMessage.response.question || question.trim(),
            function_name: lastAssistantMessage.response.function_name,
            arguments: lastAssistantMessage.response.arguments || {},
            result_data: lastAssistantDataIsTabular
              ? lastAssistantMessage.response.data
              : undefined,
          } : originalContext);
      
      console.log(`[Follow-up] AI Analysis mode:`, isAIAnalysis);
      console.log(`[Follow-up] Sending originalContext (root):`, originalContext);
      console.log(`[Follow-up] Sending previousContext (immediate):`, previousContext);
      
      // Execute a new SQL query with BOTH contexts
      const res = await apiRequest("POST", "/api/query", {
        question: question.trim(),
        previousContext,
        originalContext,
      });

      const data = await res.json() as QueryResponse;
      
      console.log(`[Follow-up] Received response:`, {
        success: data.success,
        function_name: data.function_name,
        dataCount: data.data?.length || 0,
        hasError: !!data.error,
      });

      // Add assistant response with full query results
      // Use unique ID to avoid React key collisions
      const assistantMsgId = `followup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const assistantMsg: AIAnalysisMessage = {
        id: assistantMsgId,
        type: "assistant",
        content: "",
        response: data,
      };

      console.log(`[Follow-up] Adding assistant message with ID:`, assistantMsgId, `to parent:`, currentMessageId);

      setMessages(prev => prev.map(m => {
        // Match by current ID or original temp ID (handles race condition)
        if (m.id === currentMessageId || m._tempId === messageId) {
          // STAR PATTERN: DO NOT mutate the parent message's response
          // Keep the original context unchanged so all follow-ups reference the root query
          const updatedMessages = [...(m.aiAnalysisMessages || []), assistantMsg];
          console.log(`[Follow-up] Updated aiAnalysisMessages count:`, updatedMessages.length, `for message:`, m.id);

          const updatedMessage = {
            ...m,
            aiAnalysisMessages: updatedMessages,
            // CRITICAL: Do NOT update m.response - keep it as the original/root context
          };

          // Persist follow-up messages to database AND update React Query cache
          if (currentChatId) {
            updateMessageAIAnalysisMutation.mutate({
              chatId: currentChatId,
              messageId: m.id,
              aiAnalysisMessages: updatedMessages,
            });
            
            // Also update the React Query cache directly so changes persist when navigating
            queryClient.setQueryData(['/api/chats', currentChatId, 'messages'], (oldData: any[] | undefined) => {
              if (!oldData) return oldData;
              return oldData.map((msg: any) => {
                if (msg.id === m.id || msg.id === currentMessageId) {
                  return { ...msg, aiAnalysisMessages: updatedMessages };
                }
                return msg;
              });
            });
          }

          return updatedMessage;
        }
        return m;
      }));

      // Detect follow-up filter loss: when follow-up returns significantly more records than original
      const originalRecordCount = message.response?.row_count || message.response?.summary?.total_records || message.response?.data?.length || 0;
      const followUpRecordCount = data.row_count || data.summary?.total_records || data.data?.length || 0;
      const isFilterLoss = data.success && originalRecordCount > 0 && followUpRecordCount > 0 && 
        followUpRecordCount > originalRecordCount * 1.5 && followUpRecordCount > originalRecordCount + 50;

      // Auto-log follow-up questions that fail or get AI Analysis responses
      const shouldAutoLog = !data.success || 
        data.function_name === 'ai_fallback' || 
        data.function_name === 'provide_simple_answer' ||
        data.data?.[0]?.is_fallback === true ||
        (data.data && data.data.length === 0) ||
        isFilterLoss;
      
      // Don't auto-log user input errors (off_topic, restricted, rate_limit)
      const isUserInputError = data.function_name === 'off_topic' || 
        data.function_name === 'restricted_operation' ||
        data.error === 'rate_limit';
      
      if (shouldAutoLog && !isUserInputError && currentChatId) {
        try {
          // Build full conversation: Original question + all follow-ups
          const originalQuestion = message.response.question || message.originalQuestion || message.content.trim();
          const allFollowUps = [...(message.aiAnalysisMessages || []), userMsg].filter(m => m.type === 'user');
          const followUpQuestions = allFollowUps.map((m, i) => `F${i + 1}: ${m.content}`).join("\n");
          const fullConversation = `Q1: ${originalQuestion}\n${followUpQuestions}`;
          
          // Determine auto-log reason
          let logReason = '[Auto-logged] Follow-up query failed';
          if (isFilterLoss) {
            logReason = `[Auto-logged] Follow-up likely lost filters - original: ${originalRecordCount} records, follow-up: ${followUpRecordCount} records`;
          } else if (data.function_name === 'ai_fallback' || data.data?.[0]?.is_fallback) {
            logReason = '[Auto-logged] Follow-up handled by AI fallback';
          } else if (data.function_name === 'provide_simple_answer' || data.function_name === 'ai_data_analysis' || data.data?.[0]?.type === 'ai_analysis') {
            logReason = '[Auto-logged] Follow-up required AI analysis (no direct data)';
          } else if (data.data && data.data.length === 0) {
            logReason = '[Auto-logged] Follow-up returned no results';
          }
          
          console.log('[Follow-up] Auto-logging to Query Logs:', data.function_name || data.error);
          
          // Get a clean, short error message (not JSON)
          let cleanErrorMsg = "Follow-up query required AI assistance";
          if (isFilterLoss) {
            cleanErrorMsg = `Follow-up lost filters: ${originalRecordCount} → ${followUpRecordCount} records`;
          } else if (data.message && typeof data.message === 'string' && data.message.length < 200 && !data.message.startsWith('{')) {
            cleanErrorMsg = data.message;
          } else if (data.data?.[0]?.message && typeof data.data[0].message === 'string' && data.data[0].message.length < 200) {
            cleanErrorMsg = data.data[0].message;
          } else if (data.function_name === 'ai_fallback' || data.data?.[0]?.is_fallback) {
            cleanErrorMsg = "Query handled by AI fallback";
          } else if (data.function_name === 'ai_data_analysis' || data.data?.[0]?.type === 'ai_analysis') {
            cleanErrorMsg = "AI analysis response";
          } else if (data.data && data.data.length === 0) {
            cleanErrorMsg = "No matching records found";
          }
          
          await apiRequest("POST", "/api/error-logs", {
            session_id: "auto-logged",
            chat_id: currentChatId,
            message_id: messageId,
            question: fullConversation,
            error_message: cleanErrorMsg,
            user_comment: logReason,
          });
          console.log('[Follow-up] ✓ Query auto-logged to Query Logs');
          queryClient.invalidateQueries({ queryKey: ['/api/error-logs'] });
        } catch (logError) {
          console.error('[Follow-up] ✗ Failed to auto-log:', logError);
        }
      }

      // Only show toast for rate limit errors, not for "don't know" responses
      if (!data.success && data.error === "rate_limit") {
        toast({
          title: "High Demand",
          description: "Many users are querying at once. Please try again in a moment.",
        });
      }
    } catch (error) {
      // Log the error but also show user-friendly message in chat
      console.error("Follow-up query error:", error);
      
      // Add an error response message so user knows what happened
      const errorMsgId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const errorMsg: AIAnalysisMessage = {
        id: errorMsgId,
        type: "assistant",
        content: "",
        response: {
          success: false,
          message: "I couldn't process that follow-up question. Please try rephrasing your question or start a new query.",
          data: [],
        },
      };
      
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const updatedMessages = [...(m.aiAnalysisMessages || []), errorMsg];
          return {
            ...m,
            aiAnalysisMessages: updatedMessages,
          };
        }
        return m;
      }));
    } finally {
      // Clear loading state for both old and new IDs
      setAiAnalysisLoading(prev => ({ ...prev, [messageId]: false, [currentMessageId]: false }));
      // Clear synchronous submission guard
      followUpSubmittingRef.current.delete(messageId);
      followUpSubmittingRef.current.delete(currentMessageId);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden relative">
      {/* Header - Dark Navy */}
      <header className="bg-[#3A4A57] px-4 py-3 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-white/10 transition-all"
            data-testid="button-toggle-sidebar"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-[#8BC34A] to-[#689F38] flex items-center justify-center shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white" data-testid="text-app-title">
              AI RMOne agents
            </h1>
            <p className="text-xs text-white/60">Natural language queries</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard">
            <Button
              size="sm"
              variant="ghost"
              className="text-white border border-white/20 hover:bg-white/10"
              data-testid="button-dashboard"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              RMOne Business Insights
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Dark Navy Sidebar */}
        {isSidebarOpen && (
          <aside className="w-80 bg-[#3A4A57] border-r border-[#4B5563]/50 flex flex-col shrink-0">
          {/* Search Section */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#8BC34A]" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Chat History</span>
              </div>
              {chats.length > 10 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                  onClick={handleClearOldChats}
                  data-testid="button-clear-old-chats"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Old
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="pl-9 bg-[#2C3E50] text-white placeholder:text-white/40 border-[#4B5563] focus:border-[#8BC34A] focus:ring-[#8BC34A]/20"
                data-testid="input-search-chats"
              />
            </div>
            {/* Category Filter */}
            <div className="relative">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger 
                  className="bg-[#2C3E50] text-white border-[#4B5563] focus:border-[#8BC34A] focus:ring-[#8BC34A]/20"
                  data-testid="select-category-filter"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-white/40" />
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-4" />

          {/* Bulk Actions */}
          {selectedChats.size > 0 && (
            <div className="p-3 mx-4 my-2 bg-[#8BC34A]/20 border border-[#8BC34A]/30 rounded-lg flex items-center justify-between gap-2">
              <span className="text-sm text-white font-medium">{selectedChats.size} selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setSelectedChats(new Set())}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Chat List */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-1.5">
              {filteredChats.length === 0 && (
                <div className="text-center py-12 text-white/40 text-sm">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">
                    {searchQuery 
                      ? "No chats found" 
                      : categoryFilter !== "all" 
                        ? `No chats in "${categoryFilter}"` 
                        : "No saved chats yet"}
                  </p>
                  <p className="text-xs mt-1 text-white/30">
                    {categoryFilter !== "all" 
                      ? "Mark a chat as FAQ to add it to this category" 
                      : "Start a new conversation above"}
                  </p>
                </div>
              )}

              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative rounded-lg p-3 transition-all cursor-pointer border ${
                    currentChatId === chat.id 
                      ? "bg-[#8BC34A]/20 border-[#8BC34A]/40" 
                      : "bg-[#2C3E50]/60 border-transparent hover:bg-[#2C3E50] hover:border-white/10"
                  }`}
                  onClick={() => handleLoadChat(chat.id)}
                  onMouseEnter={() => handleChatHover(chat.id)}
                  data-testid={`chat-item-${chat.id}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedChats.has(chat.id)}
                      onChange={() => handleSelectChat(chat.id)}
                      className="mt-1.5 shrink-0 w-4 h-4 accent-[#8BC34A] rounded cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-chat-${chat.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium break-words ${
                        currentChatId === chat.id ? "text-white" : "text-white/90"
                      }`}>
                        {chat.title}
                      </p>
                      <p className="text-xs text-white/40 mt-1.5 flex items-center gap-2">
                        <span>{new Date(chat.created_at).toLocaleDateString()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          chat.faq_category 
                            ? "bg-[#8BC34A]/20 text-[#8BC34A]" 
                            : "bg-white/10 text-white/50"
                        }`}>
                          {chat.faq_category || "General"}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEditChat && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(chat.id, chat.title);
                          }}
                          data-testid={`button-edit-${chat.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        data-testid={`button-delete-${chat.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Bottom Navigation */}
          <div className="p-4 border-t border-white/10 space-y-1">
            {/* Show Query Logs for admin/superadmin (even in embed mode) */}
            {canViewQueryLogs && (
              <Link href={isEmbed ? `/logs?embed=${embedContext.embedId || getSafeEmbedId()}&token=${encodeURIComponent(getSafeEmbedToken())}` : "/logs"}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                  data-testid="button-logs"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Query Logs
                </Button>
              </Link>
            )}
            {/* Show Integration for superadmin (including in embed mode) */}
            {isSuperadmin && (
              <Link href={isEmbed ? `/integration?embed=${embedContext.embedId || getSafeEmbedId()}&token=${encodeURIComponent(getSafeEmbedToken())}` : "/integration"}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                  data-testid="button-integration"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Integration
                </Button>
              </Link>
            )}
            <Link href={isEmbed ? `/help?embed=${embedContext.embedId || getSafeEmbedId()}&token=${encodeURIComponent(getSafeEmbedToken())}` : "/help"}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                data-testid="button-help"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Guidelines
              </Button>
            </Link>
            
            {/* Hide Sign Out and User Email in embed mode */}
            {!isEmbed && (
              <>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full justify-start text-white/70 hover:text-white hover:bg-red-500/20"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
                
                {/* User Email Display */}
                {currentUserData?.email && (
                  <div className="flex items-center gap-2 px-3 py-2 mt-3 border-t border-white/10 pt-3">
                    <User className="h-4 w-4 text-white/40 shrink-0" />
                    <span className="text-xs text-white/50 truncate" data-testid="text-user-email">
                      {currentUserData.email}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
        )}

        {/* Main Chat Area - White background */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Top Input Area with New Chat button */}
          <div className="bg-[#F9FAFB] border-b border-[#E5E7EB] shrink-0">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3">
                <form onSubmit={handleSubmit} className="flex-1 relative">
                  <div className="bg-white border border-[#D1D5DB] rounded-3xl p-1 flex items-end gap-2 shadow-sm">
                    <Textarea
                      ref={mainInputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask anything about your data..."
                      className="flex-1 min-h-[44px] max-h-32 bg-transparent border-0 text-[#111827] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-0 px-4 py-2.5"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      data-testid="input-query"
                      disabled={queryMutation.isPending}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="bg-[#3B82F6] hover:bg-[#1D4ED8] rounded-2xl h-10 w-10 shrink-0 mr-1 mb-1 transition-colors shadow-lg"
                      disabled={!input.trim() || queryMutation.isPending}
                      data-testid="button-submit"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </form>
                <Button
                  onClick={handleNewChat}
                  className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white shrink-0 h-12 rounded-3xl px-5"
                  data-testid="button-new-chat-top"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-4xl mx-auto py-6">
              {loadingChatId ? (
                /* Loading Chat State */
                <div className="flex items-center justify-center py-20">
                  <div className="text-center space-y-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-[#8BC34A] to-[#689F38] animate-pulse">
                      <Loader2 className="h-7 w-7 text-white animate-spin" />
                    </div>
                    <p className="text-[#3A4A57]/70">Loading conversation...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                /* Welcome Screen - FAQ Grid Only */
                <div className="space-y-6 pb-4 pt-2">
                  {/* Responsive category grid - adapts to number of categories */}
                  <div className={`grid gap-3 max-w-4xl mx-auto ${
                    mergedExampleQueries.length <= 4 
                      ? "md:grid-cols-2" 
                      : mergedExampleQueries.length <= 6
                        ? "md:grid-cols-2 lg:grid-cols-3"
                        : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  }`}>
                    {mergedExampleQueries.filter(group => group.queryItems.length > 0).map((group, idx) => (
                      <div 
                        key={idx} 
                        className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-2.5 transition-all hover:border-[#8BC34A]/30 group/category"
                        data-testid={`card-category-${group.category.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="flex items-center gap-2 text-[#111827]">
                          <group.icon className="h-4 w-4 text-[#8BC34A] shrink-0" />
                          <h3 className="font-semibold text-sm truncate flex-1" title={group.category}>
                            {group.category}
                          </h3>
                          {!DEFAULT_FAQ_CATEGORIES.includes(group.category as any) && (
                            <>
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#8BC34A]/10 text-[#8BC34A] rounded-full shrink-0">
                                Custom
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCategory(group.category);
                                }}
                                className="opacity-0 group-hover/category:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-[#9CA3AF] hover:text-red-500"
                                title={`Delete "${group.category}" category`}
                                data-testid={`button-delete-category-${group.category.replace(/\s+/g, '-').toLowerCase()}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {group.queryItems.slice(0, 5).map((item: { text: string; id?: string; chatId?: string; isUserFaq: boolean }, qIdx: number) => (
                            <div 
                              key={qIdx}
                              className="relative group/faqitem"
                            >
                              <button
                                onClick={() => {
                                  // If it's a user FAQ with a chatId, load that chat's history
                                  if (item.isUserFaq && item.chatId) {
                                    handleLoadChat(item.chatId);
                                  } else {
                                    // For default examples, submit as a new query
                                    handleExampleClick(item.text);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 pr-8 rounded-lg text-sm text-[#374151] bg-white border border-[#E5E7EB] transition-all hover:bg-[#F3F4F6] hover:border-[#D1D5DB]"
                                data-testid={`button-example-${idx}-${qIdx}`}
                                title={item.isUserFaq ? `${item.text} (Click to load chat history)` : item.text}
                              >
                                {item.text}
                              </button>
                              {/* Delete button - for ALL questions (user FAQs and default examples) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (item.isUserFaq && item.id) {
                                    // User-added FAQ: remove from database
                                    deleteFAQSampleMutation.mutate(item.id);
                                  } else {
                                    // Default example: hide locally
                                    hideDefaultExample(item.text);
                                  }
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/faqitem:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 bg-white text-[#9CA3AF] hover:text-red-500 z-10 border border-transparent hover:border-red-200"
                                title={item.isUserFaq ? "Remove from FAQ" : "Hide this example"}
                                data-testid={`button-delete-faq-${item.id || `default-${qIdx}`}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {group.queryItems.length > 5 && (
                            <p className="text-xs text-[#9CA3AF] text-center pt-1">
                              +{group.queryItems.length - 5} more examples
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show total category count if more than 4 */}
                  {mergedExampleQueries.filter(g => g.queryItems.length > 0).length > 4 && (
                    <p className="text-center text-xs text-[#9CA3AF] mt-4">
                      Showing {mergedExampleQueries.filter(g => g.queryItems.length > 0).length} categories
                    </p>
                  )}
                </div>
              ) : (
                /* Chat Messages - Only show bot messages, user question shown in "Your Query" header */
                <div className="space-y-6 pb-4">
                  {messages.filter(m => m.type === "bot").map((message) => (
                    <div
                      key={message.id}
                      className="space-y-4"
                    >
                      {/* User Query - Right aligned like a user message */}
                      <div className="flex justify-end">
                        <div className="bg-[#3B82F6] rounded-2xl px-5 py-3 max-w-2xl shadow-sm group relative">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-white/80 font-medium">Your Query</span>
                            {(message.aiAnalysisMessages?.filter(m => m.type === "user").length ?? 0) > 0 && (
                              <span className="text-xs text-white/70 ml-auto">
                                +{message.aiAnalysisMessages?.filter(m => m.type === "user").length} follow-ups
                              </span>
                            )}
                            {/* FAQ Edit Button - appears on hover (only for admin/superadmin) */}
                            {canManageFAQ && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/20 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFaqDialog(message.id);
                                }}
                                title="Mark as FAQ sample"
                                data-testid={`button-faq-edit-${message.id}`}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-white" data-testid={`text-bot-message-${message.id}`}>
                            {message.response?.question || message.originalQuestion || message.content}
                          </p>
                        </div>
                      </div>
                      
                      {/* Response - Left aligned with green border */}
                      <div className="max-w-full w-full">
                        <div className="space-y-4 border-l-4 border-[#8BC34A] pl-4 ml-2">

                            {message.response && (
                              <div className="space-y-4">
                                {/* Fallback/Alternative Notice Banner */}
                                {message.response.success && message.response.is_fallback_result && message.response.message && (() => {
                                  const { mainText, suggestions } = parseDidYouMean(message.response.message);
                                  const originalQuestion = message.response?.question || message.content || '';
                                  return (
                                    <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl p-3 space-y-2">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-[#92400E]" data-testid="text-fallback-notice">
                                          {mainText}
                                        </p>
                                      </div>
                                      {suggestions.length > 0 && (
                                        <div className="pl-6 space-y-1">
                                          <p className="text-xs text-[#92400E] font-medium">Did you mean:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {suggestions.map((s, i) => (
                                              <Button
                                                key={i}
                                                size="sm"
                                                variant="outline"
                                                className="bg-white border-[#F59E0B] text-[#92400E] hover:bg-[#FEF3C7]"
                                                onClick={() => handleExampleClick(buildCorrectedQuery(originalQuestion, message.response.message, s))}
                                                data-testid={`button-did-you-mean-${i}`}
                                              >
                                                {s}
                                              </Button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                                {/* Summary Stats */}
                                {message.response.summary && message.response.success && (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {message.response.summary.total_records !== undefined && (
                                      <div className="bg-[#E8F5E9] border border-[#8BC34A]/30 rounded-xl p-4">
                                        <p className="text-xs text-[#558B2F] mb-1">Records</p>
                                        <p className="text-xl font-bold text-[#8BC34A]" data-testid="text-total-records">
                                          {message.response.summary.total_records}
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.total_value !== undefined && (
                                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                        <p className="text-xs text-[#6B7280] mb-1">Total Value</p>
                                        <p className="text-xl font-bold text-[#111827]" data-testid="text-total-value">
                                          ${(message.response.summary.total_value / 1e6).toFixed(1)}M
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.avg_fee !== undefined && (
                                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                        <p className="text-xs text-[#6B7280] mb-1">Avg Fee</p>
                                        <p className="text-xl font-bold text-[#111827]" data-testid="text-avg-fee">
                                          ${(message.response.summary.avg_fee / 1e6).toFixed(1)}M
                                        </p>
                                      </div>
                                    )}
                                    {message.response.summary.avg_win_rate !== undefined && (
                                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                        <p className="text-xs text-[#6B7280] mb-1">Avg Win Rate</p>
                                        <p className="text-xl font-bold text-[#111827]" data-testid="text-avg-win-rate">
                                          {message.response.summary.avg_win_rate.toFixed(1)}%
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Ask Follow-up Question Button - Temporarily hidden */}
                                {!HIDE_FOLLOWUP && message.response.success && 
                                 message.response.data && 
                                 message.response.data.length > 0 && 
                                 message.response.data[0]?.type !== 'ai_analysis' && 
                                 message.response.data[0]?.type !== 'suggested_queries' &&
                                 message.response.data[0]?.type !== 'disambiguation' &&
                                 message.response.function_name !== 'ai_fallback' &&
                                 message.response.function_name !== 'ai_data_analysis' &&
                                 message.response.function_name !== 'provide_simple_answer' &&
                                 message.response.function_name !== 'disambiguation_required' &&
                                 !(message.response.data[0]?.is_fallback) &&
                                 !(message.response.suggested_queries) && (
                                  <div className="flex justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-[#1F2937] hover:bg-[#374151] text-white border-[#1F2937] hover:border-[#374151]"
                                      onClick={() => {
                                        const followUpSection = document.getElementById(`followup-section-${message.id}`);
                                        if (followUpSection) {
                                          followUpSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                          setTimeout(() => {
                                            const input = followUpSection.querySelector('textarea');
                                            if (input) (input as HTMLTextAreaElement).focus();
                                          }, 600);
                                        } else {
                                          const testIdElement = document.querySelector(`[data-testid="form-followup-${message.id}"]`);
                                          if (testIdElement) {
                                            testIdElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            setTimeout(() => {
                                              const input = testIdElement.querySelector('textarea');
                                              if (input) (input as HTMLTextAreaElement).focus();
                                            }, 600);
                                          }
                                        }
                                      }}
                                      data-testid={`button-scroll-followup-${message.id}`}
                                    >
                                      <MessageSquare className="h-4 w-4 mr-2" />
                                      Ask Follow-up Question
                                    </Button>
                                  </div>
                                )}

                                {/* Error Display - Show for all error responses */}
                                {!message.response.success && message.response.error && (
                                  <div className="space-y-2">
                                    <Alert 
                                      variant="default" 
                                      className={
                                        message.response.error === "restricted_operation"
                                          ? "border-[#F59E0B]/50 bg-[#FEF3C7]"
                                          : message.response.error === "off_topic"
                                          ? "border-[#8B5CF6]/50 bg-[#EDE9FE]"
                                          : "border-[#3B82F6]/50 bg-[#3B82F6]/10"
                                      }
                                      data-testid="alert-error"
                                    >
                                      {message.response.error === "rate_limit" ? (
                                        <Clock className="h-4 w-4 text-[#3B82F6]" />
                                      ) : message.response.error === "restricted_operation" ? (
                                        <AlertCircle className="h-4 w-4 text-[#F59E0B]" />
                                      ) : message.response.error === "off_topic" ? (
                                        <Info className="h-4 w-4 text-[#8B5CF6]" />
                                      ) : (
                                        <MessageSquare className="h-4 w-4 text-[#3B82F6]" />
                                      )}
                                      <AlertDescription className="text-[#374151]">
                                        {message.response.error === "rate_limit" 
                                          ? (message.response.message || "Rate limit reached. Please wait a moment.")
                                          : message.response.error === "restricted_operation"
                                          ? (message.response.message || "This operation is not allowed.")
                                          : message.response.error === "off_topic"
                                          ? (message.response.message || "I am designed for RMOne database queries only.")
                                          : message.response.error === "no_results" && message.response.message
                                          ? (() => {
                                              const { mainText, suggestions } = parseDidYouMean(message.response.message);
                                              const originalQuestion = message.response?.question || message.content || '';
                                              return (
                                                <div className="space-y-3">
                                                  <p>{mainText}</p>
                                                  {suggestions.length > 0 && (
                                                    <div className="space-y-2">
                                                      <p className="text-sm font-medium">Did you mean:</p>
                                                      <div className="flex flex-wrap gap-2">
                                                        {suggestions.map((s, i) => (
                                                          <Button
                                                            key={i}
                                                            size="sm"
                                                            className="bg-[#8BC34A] hover:bg-[#7CB342] text-white"
                                                            onClick={() => handleExampleClick(buildCorrectedQuery(originalQuestion, message.response.message, s))}
                                                            data-testid={`button-did-you-mean-error-${i}`}
                                                          >
                                                            {s}
                                                          </Button>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()
                                          : `Great question! I need to talk to my creators to ensure that I have the right answer for you. Query #${message.id.slice(-6).toUpperCase()}`
                                        }
                                      </AlertDescription>
                                    </Alert>
                                    {message.response.error !== "restricted_operation" && message.response.error !== "off_topic" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-[#3B82F6] border-[#3B82F6]/30 hover:bg-[#3B82F6]/10"
                                        onClick={() => handleOpenErrorLogDialog(message)}
                                        data-testid={`button-log-error-${message.id}`}
                                      >
                                        <FileText className="h-4 w-4 mr-1" />
                                        Log Query
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {/* Data Display */}
                                {message.response.success && (
                                  <>
                                    {/* Check if this is a suggested queries response */}
                                    {message.response.data?.[0]?.type === 'suggested_queries' || message.response.suggested_queries ? (
                                      usedSuggestions[message.id] ? (
                                        <div className="bg-[#F0FDF4] border border-[#8BC34A]/30 rounded-xl p-4">
                                          <div className="flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-[#8BC34A] flex-shrink-0" />
                                            <p className="text-sm text-[#166534]">
                                              Selected: <span className="font-medium">{usedSuggestions[message.id]}</span>
                                            </p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-4">
                                          <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl p-4">
                                            <div className="flex items-start gap-2 mb-3">
                                              <Search className="h-5 w-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                              <div>
                                                <p className="text-sm font-medium text-[#92400E]" data-testid="text-no-results-message">
                                                  No results found for your query. This is not an error - no matching records exist in the database.
                                                </p>
                                                <p className="text-base font-semibold text-[#DC2626] mt-2">
                                                  Try one of these alternative queries:
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <div className="space-y-2" data-testid="suggested-queries-list">
                                              {(message.response.suggested_queries || message.response.data?.[0]?.suggestions || []).map((suggestion: { description: string; suggested_question: string; filters: Record<string, any>; function_name: string }, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className="group bg-white hover:bg-[#F0FDF4] border border-[#E5E7EB] hover:border-[#8BC34A] rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all"
                                                  onClick={() => {
                                                    setUsedSuggestions(prev => ({ ...prev, [message.id]: suggestion.suggested_question }));
                                                    handleExampleClick(suggestion.suggested_question);
                                                  }}
                                                  data-testid={`suggestion-card-${idx}`}
                                                >
                                                  <div className="flex-1 min-w-0 mr-3">
                                                    <p className="text-sm font-medium text-[#111827]" data-testid={`suggestion-description-${idx}`}>
                                                      {suggestion.suggested_question}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-8 px-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInput(suggestion.suggested_question);
                                                        mainInputRef.current?.focus();
                                                      }}
                                                      data-testid={`button-edit-suggestion-${idx}`}
                                                    >
                                                      <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      className="h-8 px-3 bg-[#8BC34A] hover:bg-[#7CB342] text-white"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setUsedSuggestions(prev => ({ ...prev, [message.id]: suggestion.suggested_question }));
                                                        handleExampleClick(suggestion.suggested_question);
                                                      }}
                                                      data-testid={`button-run-suggestion-${idx}`}
                                                    >
                                                      <Send className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    ) : message.response.data?.[0]?.type === 'disambiguation' ? (
                                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                          <Brain className="h-5 w-5 text-blue-600" />
                                          <h3 className="font-semibold text-[#111827]">RMOne Agent</h3>
                                        </div>
                                        <p className="text-[#374151] mb-4">
                                          {message.response.data[0].message || message.response.data[0].narrative || 
                                            `I found "${message.response.data[0].entity || message.response.data[0].value || message.response.data[0].search_term || 'your search term'}" under multiple columns. Please select the column you're looking for to get the most accurate results.`
                                          }
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                          {(message.response.data[0].columns || message.response.data[0].options)?.map((option: { displayName: string; count: number; paramName: string; column: string }, idx: number) => {
                                            const buttonId = `${message.id}-${option.paramName}`;
                                            const isThisButtonLoading = clickedDisambiguationButton === buttonId && queryMutation.isPending;
                                            const isAnyButtonLoading = clickedDisambiguationButton !== null && queryMutation.isPending;
                                            
                                            return (
                                            <Button
                                              key={idx}
                                              variant="outline"
                                              className={`justify-between p-4 h-auto hover:bg-blue-100 hover:border-blue-400 ${isAnyButtonLoading ? 'opacity-60 cursor-wait' : ''}`}
                                              disabled={isAnyButtonLoading}
                                              onClick={() => {
                                                if (queryMutation.isPending) {
                                                  console.log('[Disambiguation] Click blocked - query still pending');
                                                  return;
                                                }
                                                setClickedDisambiguationButton(buttonId);
                                                const searchTerm = message.response.data[0].entity || message.response.data[0].value || message.response.data[0].search_term || '';
                                                const rawQuestion = message.response.question || message.content;
                                                const originalQuestion = rawQuestion.replace(/\s*\[filter by [^\]]+\]/gi, '').trim();
                                                const clarifiedQuery = `${originalQuestion} [filter by ${option.displayName}: "${searchTerm}"]`;
                                                console.log('[Disambiguation] Button clicked - submitting:', clarifiedQuery);
                                                handleExampleClick(clarifiedQuery);
                                              }}
                                              data-testid={`button-disambiguate-${option.paramName}`}
                                            >
                                              <span className="font-medium">{option.displayName}</span>
                                              <span className="text-sm text-[#6B7280]">
                                                {isThisButtonLoading ? 'Loading...' : `(${option.count} matches)`}
                                              </span>
                                            </Button>
                                          );})}
                                        </div>
                                      </div>
                                    ) : message.response.data?.[0]?.type === 'ai_analysis' ? (
                                      <>
                                        <Tabs
                                          value={activeTabPerMessage[message.id] || "data"}
                                          className="w-full"
                                          onValueChange={(value) => {
                                            setActiveTabPerMessage(prev => ({
                                              ...prev,
                                              [message.id]: value
                                            }));
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                                              <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-ai-response">
                                                Response
                                              </TabsTrigger>
                                              <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-ai-chart">
                                                Chart
                                              </TabsTrigger>
                                              {canViewLogsTab && (
                                                <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-ai-logs">
                                                  <FileText className="h-4 w-4 mr-1" />
                                                  Logs
                                                </TabsTrigger>
                                              )}
                                            </TabsList>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/10"
                                                onClick={() => {
                                                  const originalQ = message.content;
                                                  const followUps = (message.aiAnalysisMessages || [])
                                                    .filter(m => m.type === "user")
                                                    .map((m, idx) => `Follow-up ${idx + 1}: ${m.content}`)
                                                    .join('\n\n');
                                                  const combinedQuestion = followUps 
                                                    ? `Original: ${originalQ}\n\n${followUps}` 
                                                    : originalQ;
                                                  setErrorLogMessageId(message.id);
                                                  setErrorLogQuestion(combinedQuestion);
                                                  setErrorLogErrorMessage("Results may be incorrect or unexpected");
                                                  setErrorLogComment("");
                                                  setErrorLogDialogOpen(true);
                                                }}
                                                data-testid={`button-report-issue-${message.id}`}
                                              >
                                                <AlertCircle className="h-4 w-4 mr-1" />
                                                Report Issue
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]"
                                                onClick={() => {
                                                  const narrative = message.response?.data?.[0]?.narrative || '';
                                                  if (navigator.clipboard && window.isSecureContext) {
                                                    navigator.clipboard.writeText(narrative);
                                                  } else {
                                                    const ta = document.createElement('textarea');
                                                    ta.value = narrative;
                                                    ta.style.position = 'fixed';
                                                    ta.style.left = '-9999px';
                                                    document.body.appendChild(ta);
                                                    ta.focus();
                                                    ta.select();
                                                    document.execCommand('copy');
                                                    document.body.removeChild(ta);
                                                  }
                                                  toast({
                                                    title: "Copied!",
                                                    description: "AI Analysis copied to clipboard",
                                                  });
                                                }}
                                                data-testid={`button-copy-ai-analysis-${message.id}`}
                                              >
                                                <Copy className="h-4 w-4 mr-1" />
                                                Copy
                                              </Button>
                                            </div>
                                          </div>

                                          <TabsContent value="data" className="space-y-4 mt-4">
                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6">
                                              <div className="flex items-center gap-2 mb-4">
                                                <Brain className="h-5 w-5 text-[#8BC34A]" />
                                                <h3 className="font-semibold text-[#111827]">AI Analysis</h3>
                                              </div>
                                              <div className="bg-white border border-[#E5E7EB] rounded-lg p-6">
                                                {(() => {
                                                  const narrative = message.response.data[0].narrative || '';
                                                  const { mainText, suggestions } = parseDidYouMean(narrative);
                                                  const originalQuestion = message.response?.question || message.content || '';
                                                  return (
                                                    <>
                                                      <MarkdownRenderer content={mainText} />
                                                      {suggestions.length > 0 && (
                                                        <div className="mt-4 space-y-2">
                                                          <p className="text-sm text-[#374151] font-medium">Did you mean one of these?</p>
                                                          <div className="flex flex-wrap gap-2">
                                                            {suggestions.map((s, i) => (
                                                              <Button
                                                                key={i}
                                                                size="sm"
                                                                className="bg-[#8BC34A] hover:bg-[#7CB342] text-white"
                                                                onClick={() => handleExampleClick(buildCorrectedQuery(originalQuestion, narrative, s))}
                                                                data-testid={`button-did-you-mean-analysis-${i}`}
                                                              >
                                                                {s}
                                                              </Button>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      )}
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                            {message.response.data[0].breakdown_data && message.response.data[0].breakdown_data.length > 0 && (
                                              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                  <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-[#111827]">Data Table</h3>
                                                  </div>
                                                </div>
                                                <TableWithExternalScrollbar
                                                  data={message.response.data[0].breakdown_data}
                                                  messageId={`ai-breakdown-${message.id}`}
                                                  height="300px"
                                                  enableColumnSelection={false}
                                                  selectedColumns={new Set()}
                                                  onColumnSelectionChange={() => {}}
                                                />
                                              </div>
                                            )}
                                          </TabsContent>

                                          <TabsContent value="chart" className="space-y-4 mt-4">
                                            {message.response.chart_config ? (
                                              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                                <ChartComparison config={message.response.chart_config} />
                                              </div>
                                            ) : (
                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6 text-center text-[#6B7280]">
                                                No chart available for this analysis
                                              </div>
                                            )}
                                          </TabsContent>

                                          {canViewLogsTab && (
                                            <TabsContent value="logs" className="space-y-4 mt-4">
                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                                                <div>
                                                  <p className="text-xs text-[#6B7280] mb-1 font-mono">SQL QUERY:</p>
                                                  <pre className="text-xs text-[#8BC34A] font-mono bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">{message.response.sql_query || "N/A"}</pre>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-[#6B7280] mb-1 font-mono">PARAMETERS:</p>
                                                  <pre className="text-xs text-[#EA580C] font-mono bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">{JSON.stringify(message.response.sql_params || [], null, 2)}</pre>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-[#6B7280] mb-1 font-mono">FUNCTION:</p>
                                                  <pre className="text-xs text-[#3B82F6] font-mono bg-white p-3 rounded border overflow-x-auto">{message.response.function_name || "N/A"}</pre>
                                                </div>
                                              </div>
                                            </TabsContent>
                                          )}
                                        </Tabs>

                                        {/* Follow-up Questions Section - Temporarily hidden */}
                                        {!HIDE_FOLLOWUP && !(message.response.data?.[0]?.is_fallback) && 
                                         message.response.function_name !== 'ai_fallback' && 
                                         message.response.function_name !== 'ai_data_analysis' &&
                                         message.response.data?.[0]?.type !== 'ai_analysis' && (() => {
                                          const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
                                          const canAskMore = userFollowUpCount < 3;
                                          
                                          return (
                                        <div id={`followup-section-${message.id}`} className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <MessageSquare className="h-5 w-5 text-[#6B7280]" />
                                              <span className="text-sm text-[#6B7280]">Follow up questions</span>
                                              <span className="text-xs text-[#9CA3AF] ml-2">
                                                ({userFollowUpCount}/3)
                                              </span>
                                            </div>
                                            {/* Report Issue button - always visible when there are follow-ups */}
                                            {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/10"
                                                onClick={() => {
                                                  const originalQ = message.content;
                                                  const followUps = (message.aiAnalysisMessages || [])
                                                    .filter(m => m.type === "user")
                                                    .map((m, idx) => `Follow-up ${idx + 1}: ${m.content}`)
                                                    .join('\n\n');
                                                  const combinedQuestion = `Original: ${originalQ}\n\n${followUps}`;
                                                  setErrorLogMessageId(message.id);
                                                  setErrorLogQuestion(combinedQuestion);
                                                  setErrorLogErrorMessage("Results may be incorrect or unexpected");
                                                  setErrorLogComment("");
                                                  setErrorLogDialogOpen(true);
                                                }}
                                                data-testid={`button-report-followup-header-${message.id}`}
                                              >
                                                <AlertCircle className="h-4 w-4 mr-1" />
                                                Report Issue
                                              </Button>
                                            )}
                                          </div>

                                          {/* Follow-up Chat History - Always visible */}
                                          {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                            <div className="space-y-4 mb-4">
                                              {message.aiAnalysisMessages.map((msg) => (
                                                <div key={msg.id} className="space-y-3">
                                                  {/* User Question */}
                                                  {msg.type === "user" && msg.content && (
                                                    <div className="flex justify-end items-start gap-2">
                                                      <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 shrink-0"
                                                        onClick={(e) => deleteFollowUp(message.id, msg.id, e)}
                                                        title="Delete this follow-up question"
                                                        data-testid={`button-delete-followup-${msg.id}`}
                                                      >
                                                        <X className="h-4 w-4" />
                                                      </Button>
                                                      <div className="bg-[#3B82F6] rounded-lg p-3 max-w-[80%]">
                                                        <p className="text-sm text-white font-medium">{msg.content}</p>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Assistant Response - Error/off-topic messages */}
                                                  {msg.response && !msg.response.success && (
                                                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                      <p className="text-sm text-[#374151]">{msg.response.message || "I couldn't process that question. Please try asking something about your project data."}</p>
                                                    </div>
                                                  )}

                                                  {/* Assistant Response - Full tabbed interface */}
                                                  {msg.response && msg.response.success && (
                                                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                      {msg.response.data?.[0]?.type === 'ai_analysis' ? (
                                                        <MarkdownRenderer content={msg.response.data[0].narrative} />
                                                      ) : msg.response.data?.[0]?.type === 'suggested_queries' ? (
                                                        <div className="space-y-3">
                                                          <p className="text-[#374151]">{msg.response.data[0].message || "No matching records found."}</p>
                                                          {msg.response.data[0].suggestions && msg.response.data[0].suggestions.length > 0 && (
                                                            <div className="space-y-2">
                                                              <p className="text-sm text-[#6B7280]">Try these alternatives:</p>
                                                              <div className="flex flex-wrap gap-2">
                                                                {msg.response.data[0].suggestions.map((suggestion: any, idx: number) => (
                                                                  <span key={idx} className="bg-[#EFF6FF] text-[#1E40AF] px-3 py-1.5 rounded-full text-sm">
                                                                    {suggestion.description || suggestion.query || JSON.stringify(suggestion)}
                                                                  </span>
                                                                ))}
                                                              </div>
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <Tabs 
                                                          value={followUpTabs[msg.id] || "data"}
                                                          className="w-full"
                                                          onValueChange={(value) => {
                                                            setFollowUpTabs(prev => ({
                                                              ...prev,
                                                              [msg.id]: value
                                                            }));
                                                          }}
                                                        >
                                                          <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151] mb-4">
                                                            <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                              Response
                                                            </TabsTrigger>
                                                            <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                              Chart
                                                            </TabsTrigger>
                                                            {canViewLogsTab && (
                                                              <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                                Logs
                                                              </TabsTrigger>
                                                            )}
                                                          </TabsList>
                                                          
                                                          <TabsContent value="data" className="space-y-4">
                                                            {/* Summary stats */}
                                                            {msg.response.data && msg.response.data.length > 0 && (
                                                              <div className="flex flex-wrap gap-4 mb-4">
                                                                <div className="flex items-center gap-2 bg-[#EFF6FF] text-[#1E40AF] px-3 py-1.5 rounded-full text-sm font-medium">
                                                                  <span>{msg.response.data.length} results</span>
                                                                </div>
                                                                {msg.response.ai_insights && (
                                                                  <div className="flex-1 text-sm text-[#374151]">
                                                                    {msg.response.ai_insights}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            )}
                                                            {/* Data table */}
                                                            {msg.response.data && msg.response.data.length > 0 && (
                                                              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded">
                                                                <table className="min-w-full divide-y divide-[#E5E7EB]">
                                                                  <thead className="bg-[#F9FAFB] sticky top-0">
                                                                    <tr>
                                                                      {Object.keys(msg.response.data[0]).map((key) => (
                                                                        <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap">
                                                                          {key}
                                                                        </th>
                                                                      ))}
                                                                    </tr>
                                                                  </thead>
                                                                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                                                                    {msg.response.data.slice(0, 50).map((row: any, rowIdx: number) => (
                                                                      <tr key={rowIdx} className="hover:bg-[#F9FAFB]">
                                                                        {Object.values(row).map((val: any, colIdx: number) => (
                                                                          <td key={colIdx} className="px-3 py-2 text-sm text-[#374151] whitespace-nowrap max-w-[200px] truncate">
                                                                            {val === null || val === undefined ? '-' : String(val)}
                                                                          </td>
                                                                        ))}
                                                                      </tr>
                                                                    ))}
                                                                  </tbody>
                                                                </table>
                                                                {msg.response.data.length > 50 && (
                                                                  <div className="text-center py-2 text-sm text-[#6B7280] bg-[#F9FAFB] border-t">
                                                                    Showing 50 of {msg.response.data.length} results
                                                                  </div>
                                                                )}
                                                              </div>
                                                            )}
                                                            {(!msg.response.data || msg.response.data.length === 0) && (
                                                              <div className="text-center py-4 text-[#6B7280]">
                                                                No results found
                                                              </div>
                                                            )}
                                                          </TabsContent>
                                                          
                                                          <TabsContent value="chart">
                                                            {msg.response.data && msg.response.data.length > 0 ? (
                                                              <ChartVisualization data={msg.response.data} />
                                                            ) : (
                                                              <div className="text-center py-4 text-[#6B7280]">
                                                                No data available for chart
                                                              </div>
                                                            )}
                                                          </TabsContent>
                                                          
                                                          <TabsContent value="logs">
                                                            <div className="space-y-2 text-sm">
                                                              <div className="flex gap-2">
                                                                <span className="text-[#6B7280]">Template:</span>
                                                                <span className="text-[#111827] font-mono">{msg.response.function_name || 'N/A'}</span>
                                                              </div>
                                                              {msg.response.sql && (
                                                                <div>
                                                                  <span className="text-[#6B7280]">SQL:</span>
                                                                  <pre className="mt-1 p-2 bg-[#1F2937] text-[#10B981] text-xs rounded overflow-x-auto">
                                                                    {msg.response.sql}
                                                                  </pre>
                                                                </div>
                                                              )}
                                                            </div>
                                                          </TabsContent>
                                                        </Tabs>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Follow-up Input - Always visible if under 3 questions */}
                                          {canAskMore ? (
                                            aiAnalysisLoading[message.id] ? (
                                              <div className="flex justify-start mb-4">
                                                <TypingIndicator />
                                              </div>
                                            ) : (
                                              <form
                                                onSubmit={(e) => {
                                                  e.preventDefault();
                                                  if (aiAnalysisLoading[message.id]) return;
                                                  const value = aiAnalysisInputs[message.id] || "";
                                                  if (value.trim()) handleAIAnalysis(message.id, value);
                                                }}
                                                className="bg-white border border-[#D1D5DB] rounded-lg p-2 flex items-end gap-2"
                                                data-testid={`form-followup-${message.id}`}
                                              >
                                                <Textarea
                                                  value={aiAnalysisInputs[message.id] || ""}
                                                  onChange={(e) => setAiAnalysisInputs(prev => ({ ...prev, [message.id]: e.target.value }))}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                      e.preventDefault();
                                                      const value = e.currentTarget.value;
                                                      if (value.trim() && !aiAnalysisLoading[message.id]) handleAIAnalysis(message.id, value);
                                                    }
                                                  }}
                                                  placeholder={userFollowUpCount === 0 ? "Ask a follow-up question..." : `Ask follow-up ${userFollowUpCount + 1} of 3...`}
                                                  className="flex-1 min-h-[44px] max-h-32 bg-transparent border-0 text-[#111827] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-0 px-3 py-2"
                                                  disabled={aiAnalysisLoading[message.id]}
                                                  data-testid={`input-followup-${message.id}`}
                                                />
                                                <Button
                                                  type="submit"
                                                  size="icon"
                                                  disabled={!aiAnalysisInputs[message.id]?.trim() || aiAnalysisLoading[message.id]}
                                                  className="h-10 w-10 shrink-0 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white border-0"
                                                  data-testid={`button-send-followup-${message.id}`}
                                                >
                                                  <Send className="h-4 w-4" />
                                                </Button>
                                              </form>
                                            )
                                          ) : (
                                            <div className="text-center py-3 space-y-2">
                                              <p className="text-sm text-[#9CA3AF]">Maximum 3 follow-up questions reached</p>
                                              <Button onClick={handleNewChat} size="sm" className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white rounded-full px-4" data-testid="button-new-chat-limit">
                                                <Plus className="h-4 w-4 mr-1" />Start New Chat
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                          );
                                        })()}
                                      </>
                                    ) : (
                                      /* Regular data response with tabs */
                                      <Tabs 
                                        value={activeTabPerMessage[message.id] || "data"}
                                        className="w-full"
                                        onValueChange={(value) => {
                                          setActiveTabPerMessage(prev => ({
                                            ...prev,
                                            [message.id]: value
                                          }));
                                        }}
                                      >
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                          <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                                            <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-data">
                                              Response
                                            </TabsTrigger>
                                            <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-chart">
                                              Chart
                                            </TabsTrigger>
                                            {canViewLogsTab && (
                                              <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]" data-testid="tab-logs">
                                                <FileText className="h-4 w-4 mr-1" />
                                                Logs
                                              </TabsTrigger>
                                            )}
                                          </TabsList>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/10"
                                            onClick={() => handleOpenErrorLogDialog(message)}
                                            data-testid={`button-report-issue-${message.id}`}
                                          >
                                            <AlertCircle className="h-4 w-4 mr-1" />
                                            Report Issue
                                          </Button>
                                        </div>

                                    <TabsContent value="chart" className="space-y-4 mt-4">
                                      {message.response.chart_config ? (
                                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                          <ChartComparison config={message.response.chart_config} />
                                        </div>
                                      ) : (
                                        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-6 text-center text-[#6B7280]">
                                          No chart available
                                        </div>
                                      )}
                                      
                                      {/* Follow-up Questions in Chart Tab - Temporarily hidden */}
                                      {!HIDE_FOLLOWUP && (message.response.data && message.response.data.length > 0) && (() => {
                                        const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
                                        const canAskMore = userFollowUpCount < 3;
                                        return (
                                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <MessageSquare className="h-5 w-5 text-[#6B7280]" />
                                              <span className="text-sm text-[#6B7280]">Follow up questions</span>
                                              <span className="text-xs text-[#9CA3AF] ml-2">({userFollowUpCount}/3)</span>
                                            </div>
                                          </div>

                                          {/* Follow-up Chat History */}
                                          {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                            <div className="space-y-4 mb-4">
                                              {message.aiAnalysisMessages.map((msg) => (
                                                <div key={msg.id} className="space-y-3">
                                                  {msg.type === "user" && msg.content && (
                                                    <div className="flex justify-end items-start gap-2">
                                                      <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 shrink-0"
                                                        onClick={(e) => deleteFollowUp(message.id, msg.id, e)}
                                                        title="Delete this follow-up question"
                                                        data-testid={`button-delete-followup-chart-${msg.id}`}
                                                      >
                                                        <X className="h-4 w-4" />
                                                      </Button>
                                                      <div className="bg-[#3B82F6] rounded-lg p-3 max-w-[80%]">
                                                        <p className="text-sm text-white font-medium">{msg.content}</p>
                                                      </div>
                                                    </div>
                                                  )}
                                                  {msg.response && !msg.response.success && (
                                                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                      <p className="text-sm text-[#374151]">{msg.response.message || "I couldn't process that question. Please try asking something about your project data."}</p>
                                                    </div>
                                                  )}
                                                  {msg.response && msg.response.success && (
                                                    <>
                                                      {msg.response.summary && (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                          {msg.response.summary.total_records !== undefined && (
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                                              <p className="text-xs text-[#6B7280] mb-1">Records</p>
                                                              <p className="text-xl font-bold text-[#8BC34A]">{msg.response.summary.total_records}</p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      <Tabs defaultValue="data" className="w-full">
                                                        <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                                                          <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><Table className="h-4 w-4 mr-1" />Response</TabsTrigger>
                                                          <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><BarChart3 className="h-4 w-4 mr-1" />Chart</TabsTrigger>
                                                          {canViewLogsTab && <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><FileText className="h-4 w-4 mr-1" />Logs</TabsTrigger>}
                                                        </TabsList>
                                                        <TabsContent value="data" className="mt-4">
                                                          {msg.response.data?.[0]?.type === 'ai_analysis' ? (
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4"><MarkdownRenderer content={msg.response.data[0].narrative} /></div>
                                                          ) : msg.response.data && msg.response.data.length > 0 ? (
                                                            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4"><TableWithExternalScrollbar data={msg.response.data} messageId={`followup-chart-${msg.id}`} height="300px" enableColumnSelection={false} selectedColumns={new Set()} onColumnSelectionChange={() => {}} /></div>
                                                          ) : (<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No data available</div>)}
                                                        </TabsContent>
                                                        <TabsContent value="chart" className="mt-4">
                                                          {msg.response.chart_config ? (<div className="bg-white border border-[#E5E7EB] rounded-xl p-4"><ChartComparison config={msg.response.chart_config} /></div>) : (<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No chart available</div>)}
                                                        </TabsContent>
                                                        <TabsContent value="logs" className="mt-4">
                                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                                                            <div><p className="text-xs text-[#6B7280] mb-1 font-mono">SQL QUERY:</p><pre className="text-xs text-[#8BC34A] font-mono bg-white p-2 rounded border overflow-x-auto">{msg.response.sql_query || "N/A"}</pre></div>
                                                            <div><p className="text-xs text-[#6B7280] mb-1 font-mono">PARAMETERS:</p><pre className="text-xs text-[#EA580C] font-mono bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(msg.response.sql_params || [], null, 2)}</pre></div>
                                                          </div>
                                                        </TabsContent>
                                                      </Tabs>
                                                    </>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Loading Indicator - Show AI orchestration thinking */}
                                          {aiAnalysisLoading[message.id] && (
                                            <div className="flex justify-start mb-4"><TypingIndicator /></div>
                                          )}

                                          {/* Follow-up Input */}
                                          {canAskMore ? (
                                            aiAnalysisLoading[message.id] ? null : (
                                              <form onSubmit={(e) => { e.preventDefault(); if (aiAnalysisLoading[message.id]) return; const value = aiAnalysisInputs[message.id] || ""; if (value.trim()) handleAIAnalysis(message.id, value); }} className="bg-white border border-[#D1D5DB] rounded-lg p-2 flex items-end gap-2" data-testid={`form-followup-chart-${message.id}`}>
                                                <Textarea value={aiAnalysisInputs[message.id] || ""} onChange={(e) => setAiAnalysisInputs(prev => ({ ...prev, [message.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const value = e.currentTarget.value; if (value.trim() && !aiAnalysisLoading[message.id]) handleAIAnalysis(message.id, value); }}} placeholder={userFollowUpCount === 0 ? "Ask a follow-up question..." : `Ask follow-up ${userFollowUpCount + 1} of 3...`} className="flex-1 min-h-[44px] max-h-32 bg-transparent border-0 text-[#111827] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-0 px-3 py-2" disabled={aiAnalysisLoading[message.id]} data-testid={`input-followup-chart-${message.id}`} />
                                                <Button type="submit" size="icon" disabled={!aiAnalysisInputs[message.id]?.trim() || aiAnalysisLoading[message.id]} className="h-10 w-10 shrink-0 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white border-0" data-testid={`button-send-followup-chart-${message.id}`}>
                                                  <Send className="h-4 w-4" />
                                                </Button>
                                              </form>
                                            )
                                          ) : (
                                            <div className="text-center py-3 space-y-2"><p className="text-sm text-[#9CA3AF]">Maximum 3 follow-up questions reached</p><Button onClick={handleNewChat} size="sm" className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white rounded-full px-4" data-testid="button-new-chat-limit"><Plus className="h-4 w-4 mr-1" />Start New Chat</Button></div>
                                          )}
                                        </div>
                                        );
                                      })()}
                                    </TabsContent>

                                    <TabsContent value="data" className="space-y-4 mt-4">
                                      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                              <h3 className="font-semibold text-[#111827]">Data Table</h3>
                                              <span className="text-xs text-[#3B82F6] ml-1 font-semibold">(click columns to filter)</span>
                                            </div>
                                            {message.response.data_truncated && message.response.total_row_count && (
                                              <span className="text-xs text-[#F59E0B] bg-[#FEF3C7] px-2 py-1 rounded">
                                                Showing {message.response.data?.length} of {message.response.total_row_count.toLocaleString()} rows (re-run query for full data)
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
                                              onClick={() => {
                                                const data = message.response?.data || [];
                                                if (data.length > 0) {
                                                  const headers = Object.keys(data[0]);
                                                  const csv = [
                                                    headers.join(","),
                                                    ...data.map((row: any) =>
                                                      headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
                                                    ),
                                                  ].join("\n");
                                                  copyToClipboard(csv);
                                                }
                                              }}
                                              data-testid="button-copy-data"
                                            >
                                              {copied ? (
                                                <Check className="h-4 w-4" />
                                              ) : (
                                                <Copy className="h-4 w-4" />
                                              )}
                                              <span className="ml-2">Copy CSV</span>
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
                                              onClick={() => {
                                                if (message.response?.data) {
                                                  setMaximizedTable({
                                                    messageId: message.id,
                                                    data: message.response.data,
                                                  });
                                                }
                                              }}
                                              data-testid="button-maximize-table"
                                            >
                                              <Maximize2 className="h-4 w-4" />
                                              <span className="ml-2">Maximize</span>
                                            </Button>
                                          </div>
                                        </div>
                                        {message.response.data && message.response.data.length > 0 ? (
                                          message.response.data[0]?.type === 'ai_analysis' ? (
                                            <div className="space-y-4">
                                              {/* AI Analysis Narrative - Red border for no results/fallback */}
                                              <div className={`rounded-lg p-4 ${
                                                message.response.data[0]?.is_fallback || message.response.function_name === 'ai_fallback'
                                                  ? 'bg-red-50 border-2 border-red-400'
                                                  : 'bg-[#F9FAFB] border border-[#E5E7EB]'
                                              }`}>
                                                <div className="flex items-center gap-2 mb-3">
                                                  {message.response.data[0]?.is_fallback || message.response.function_name === 'ai_fallback' ? (
                                                    <>
                                                      <AlertCircle className="h-5 w-5 text-red-500" />
                                                      <h4 className="font-semibold text-red-700">No Results Found</h4>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Brain className="h-5 w-5 text-[#8BC34A]" />
                                                      <h4 className="font-semibold text-[#111827]">AI Analysis Response</h4>
                                                    </>
                                                  )}
                                                </div>
                                                <MarkdownRenderer content={message.response.data[0].narrative || ''} />
                                              </div>
                                              {/* Sample Data Table if available */}
                                              {message.response.data[0].samples && message.response.data[0].samples.length > 0 && (
                                                <div>
                                                  <h4 className="font-semibold text-[#111827] mb-2">Sample Data</h4>
                                                  <TableWithExternalScrollbar 
                                                    data={message.response.data[0].samples}
                                                    messageId={`${message.id}-samples`}
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="relative">
                                              <TableWithExternalScrollbar 
                                                data={message.response.data}
                                                messageId={message.id}
                                                enableColumnSelection={true}
                                                selectedColumns={selectedColumnsPerMessage[message.id] || new Set()}
                                                onColumnSelectionChange={(cols) => handleColumnSelectionChange(message.id, cols)}
                                              />
                                              
                                              {/* Column selection indicator - no input here, popup opens automatically */}
                                            </div>
                                          )
                                        ) : (
                                          <div className="rounded-lg border-2 border-red-400 bg-red-50 p-8 text-center text-red-600">
                                            <div className="flex items-center justify-center gap-2">
                                              <AlertCircle className="h-5 w-5" />
                                              <span>No data available</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* AI Analysis Section with Integrated Follow-up - Hide for ai_fallback responses */}
                                      {message.response.function_name !== 'ai_fallback' && !(message.response.data?.[0]?.is_fallback) && (
                                      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                        <h3 className="font-semibold text-[#111827] mb-4 flex items-center gap-2">
                                          <Brain className="h-5 w-5" />
                                          AI Analysis
                                        </h3>
                                        {message.response.ai_insights ? (
                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                            <p className="text-[#374151] whitespace-pre-wrap leading-relaxed">
                                              {message.response.ai_insights}
                                            </p>
                                          </div>
                                        ) : (!message.response.data || message.response.data.length === 0) ? (
                                          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 text-red-600">
                                              <AlertCircle className="h-5 w-5" />
                                              <span>No data available for AI analysis</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                            <p className="text-[#374151] leading-relaxed">
                                              {(() => {
                                                const data = message.response.data || [];
                                                const count = message.response.row_count || data.length;
                                                const summary = message.response.summary;
                                                const totalValue = summary?.total_value || (summary as any)?.totalFee;
                                                const avgFee = summary?.avg_fee || (summary as any)?.avgFee;
                                                if (totalValue) {
                                                  return `Found ${count.toLocaleString()} projects with a total value of $${(totalValue / 1000000).toFixed(1)}M and average fee of $${((avgFee || 0) / 1000000).toFixed(2)}M.`;
                                                }
                                                return `Found ${count.toLocaleString()} matching records. Review the data table above for details.`;
                                              })()}
                                            </p>
                                          </div>
                                        )}

                                        {/* Follow-up Questions - Temporarily hidden */}
                                        {!HIDE_FOLLOWUP && (message.response.data && message.response.data.length > 0) && (() => {
                                          const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
                                          const canAskMore = userFollowUpCount < 3;
                                          return (
                                          <div id={`followup-section-${message.id}`} className="mt-4 pt-4 border-t border-[#E5E7EB]">
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <MessageSquare className="h-5 w-5 text-[#6B7280]" />
                                                <span className="text-sm text-[#6B7280]">Follow up questions</span>
                                                <span className="text-xs text-[#9CA3AF] ml-2">({userFollowUpCount}/3)</span>
                                              </div>
                                            </div>

                                            {/* Follow-up Chat History */}
                                            {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                              <div className="space-y-4 mb-4">
                                                {message.aiAnalysisMessages.map((msg) => (
                                                  <div key={msg.id} className="space-y-3">
                                                    {msg.type === "user" && msg.content && (
                                                      <div className="flex justify-end items-start gap-2">
                                                        <Button
                                                          size="icon"
                                                          variant="ghost"
                                                          className="h-7 w-7 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 shrink-0"
                                                          onClick={(e) => deleteFollowUp(message.id, msg.id, e)}
                                                          title="Delete this follow-up question"
                                                          data-testid={`button-delete-followup-data-${msg.id}`}
                                                        >
                                                          <X className="h-4 w-4" />
                                                        </Button>
                                                        <div className="bg-[#3B82F6] rounded-lg p-3 max-w-[80%]">
                                                          <p className="text-sm text-white font-medium">{msg.content}</p>
                                                        </div>
                                                      </div>
                                                    )}
                                                    {msg.response && !msg.response.success && (
                                                      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                        <p className="text-sm text-[#374151]">{msg.response.message || "I couldn't process that question. Please try asking something about your project data."}</p>
                                                      </div>
                                                    )}
                                                    {msg.response && msg.response.success && (
                                                      <>
                                                        {/* Summary Stats for Follow-up */}
                                                        {msg.response.summary && (
                                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {msg.response.summary.total_records !== undefined && (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                                                <p className="text-xs text-[#6B7280] mb-1">Records</p>
                                                                <p className="text-xl font-bold text-[#8BC34A]">{msg.response.summary.total_records}</p>
                                                              </div>
                                                            )}
                                                            {msg.response.summary.total_value !== undefined && (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                                                <p className="text-xs text-[#6B7280] mb-1">Total Value</p>
                                                                <p className="text-xl font-bold text-[#111827]">${(msg.response.summary.total_value / 1e6).toFixed(1)}M</p>
                                                              </div>
                                                            )}
                                                          </div>
                                                        )}
                                                        {/* Follow-up Response Tabs */}
                                                        <Tabs defaultValue="data" className="w-full">
                                                          <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                                                            <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                              <Table className="h-4 w-4 mr-1" />Response
                                                            </TabsTrigger>
                                                            <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                              <BarChart3 className="h-4 w-4 mr-1" />Chart
                                                            </TabsTrigger>
                                                            {canViewLogsTab && (
                                                              <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]">
                                                                <FileText className="h-4 w-4 mr-1" />Logs
                                                              </TabsTrigger>
                                                            )}
                                                          </TabsList>
                                                          <TabsContent value="data" className="mt-4">
                                                            {msg.response.data?.[0]?.type === 'ai_analysis' ? (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                                <MarkdownRenderer content={msg.response.data[0].narrative} />
                                                              </div>
                                                            ) : msg.response.data?.[0]?.type === 'suggested_queries' ? (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                                                                <p className="text-[#374151]">{msg.response.data[0].message || "No matching records found."}</p>
                                                                {msg.response.data[0].suggestions?.length > 0 && (
                                                                  <div className="space-y-2">
                                                                    <p className="text-sm text-[#6B7280]">Try these alternatives:</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                      {msg.response.data[0].suggestions.map((s: any, i: number) => (
                                                                        <span key={i} className="bg-[#EFF6FF] text-[#1E40AF] px-3 py-1.5 rounded-full text-sm">{s.description || s.query || JSON.stringify(s)}</span>
                                                                      ))}
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            ) : msg.response.data && msg.response.data.length > 0 ? (
                                                              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                                                                <TableWithExternalScrollbar data={msg.response.data} messageId={`followup-${msg.id}`} height="300px" enableColumnSelection={false} selectedColumns={new Set()} onColumnSelectionChange={() => {}} />
                                                              </div>
                                                            ) : (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No data available</div>
                                                            )}
                                                          </TabsContent>
                                                          <TabsContent value="chart" className="mt-4">
                                                            {msg.response.chart_config ? (
                                                              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                                                                <ChartComparison config={msg.response.chart_config} />
                                                              </div>
                                                            ) : (
                                                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No chart available</div>
                                                            )}
                                                          </TabsContent>
                                                          <TabsContent value="logs" className="mt-4">
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                                                              <div>
                                                                <p className="text-xs text-[#6B7280] mb-1 font-mono">SQL QUERY:</p>
                                                                <pre className="text-xs text-[#8BC34A] font-mono bg-white p-2 rounded border overflow-x-auto">{msg.response.sql_query || "N/A"}</pre>
                                                              </div>
                                                              <div>
                                                                <p className="text-xs text-[#6B7280] mb-1 font-mono">PARAMETERS:</p>
                                                                <pre className="text-xs text-[#EA580C] font-mono bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(msg.response.sql_params || [], null, 2)}</pre>
                                                              </div>
                                                            </div>
                                                          </TabsContent>
                                                        </Tabs>
                                                      </>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Loading Indicator - Show AI orchestration thinking */}
                                            {aiAnalysisLoading[message.id] && (
                                              <div className="flex justify-start mb-4">
                                                <TypingIndicator />
                                              </div>
                                            )}

                                            {/* Follow-up Input */}
                                            {canAskMore ? (
                                              aiAnalysisLoading[message.id] ? null : (
                                                <form onSubmit={(e) => { e.preventDefault(); if (aiAnalysisLoading[message.id]) return; const value = aiAnalysisInputs[message.id] || ""; if (value.trim()) handleAIAnalysis(message.id, value); }} className="bg-white border border-[#D1D5DB] rounded-lg p-2 flex items-end gap-2" data-testid={`form-followup-data-${message.id}`}>
                                                  <Textarea value={aiAnalysisInputs[message.id] || ""} onChange={(e) => setAiAnalysisInputs(prev => ({ ...prev, [message.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const value = e.currentTarget.value; if (value.trim() && !aiAnalysisLoading[message.id]) handleAIAnalysis(message.id, value); }}} placeholder={userFollowUpCount === 0 ? "Ask a follow-up question..." : `Ask follow-up ${userFollowUpCount + 1} of 3...`} className="flex-1 min-h-[44px] max-h-32 bg-transparent border-0 text-[#111827] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-0 px-3 py-2" disabled={aiAnalysisLoading[message.id]} data-testid={`input-ai-analysis-${message.id}`} />
                                                  <Button type="submit" size="icon" disabled={!aiAnalysisInputs[message.id]?.trim() || aiAnalysisLoading[message.id]} className="h-10 w-10 shrink-0 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white border-0" data-testid={`button-submit-ai-analysis-${message.id}`}>
                                                    <Send className="h-4 w-4" />
                                                  </Button>
                                                </form>
                                              )
                                            ) : (
                                              <div className="text-center py-3 space-y-2"><p className="text-sm text-[#9CA3AF]">Maximum 3 follow-up questions reached</p><Button onClick={handleNewChat} size="sm" className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white rounded-full px-4" data-testid="button-new-chat-limit"><Plus className="h-4 w-4 mr-1" />Start New Chat</Button></div>
                                            )}
                                          </div>
                                          );
                                        })()}
                                      </div>
                                      )}
                                    </TabsContent>

                                    <TabsContent value="logs" className="space-y-4 mt-4">
                                      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                        <h3 className="font-semibold text-[#111827] mb-4 flex items-center gap-2">
                                          <FileText className="h-5 w-5" />
                                          SQL Query & Execution Details
                                        </h3>
                                        
                                        {/* SQL Query */}
                                        <div className="mb-4">
                                          <p className="text-xs text-[#6B7280] mb-2 font-mono">SQL QUERY:</p>
                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 overflow-x-auto">
                                            <pre className="text-sm text-[#8BC34A] font-mono whitespace-pre-wrap">
                                              {message.response.sql_query || "No SQL query available"}
                                            </pre>
                                          </div>
                                        </div>

                                        {/* SQL Parameters */}
                                        <div className="mb-4">
                                          <p className="text-xs text-[#6B7280] mb-2 font-mono">PARAMETERS:</p>
                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 overflow-x-auto">
                                            <pre className="text-sm text-[#EA580C] font-mono">
                                              {JSON.stringify(message.response.sql_params || [], null, 2)}
                                            </pre>
                                          </div>
                                        </div>

                                        {/* Raw JSON Response */}
                                        <div>
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs text-[#6B7280] font-mono">RAW JSON RESPONSE:</p>
                                            <Button
                                              size="sm"
                                              className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white h-7"
                                              onClick={() => {
                                                copyToClipboard(JSON.stringify(message.response, null, 2));
                                              }}
                                              data-testid="button-copy-json"
                                            >
                                              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                              <span className="ml-1 text-xs">Copy</span>
                                            </Button>
                                          </div>
                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 overflow-x-auto">
                                            <ScrollArea className="h-[300px]">
                                              <pre className="text-sm text-[#374151] font-mono">
                                                {JSON.stringify(message.response, null, 2)}
                                              </pre>
                                            </ScrollArea>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Follow-up Questions in Logs Tab - Temporarily hidden */}
                                      {!HIDE_FOLLOWUP && (message.response.data && message.response.data.length > 0) && (() => {
                                        const userFollowUpCount = (message.aiAnalysisMessages || []).filter(m => m.type === "user").length;
                                        const canAskMore = userFollowUpCount < 3;
                                        return (
                                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <MessageSquare className="h-5 w-5 text-[#6B7280]" />
                                              <span className="text-sm text-[#6B7280]">Follow up questions</span>
                                              <span className="text-xs text-[#9CA3AF] ml-2">({userFollowUpCount}/3)</span>
                                            </div>
                                          </div>

                                          {/* Follow-up Chat History */}
                                          {message.aiAnalysisMessages && message.aiAnalysisMessages.length > 0 && (
                                            <div className="space-y-4 mb-4">
                                              {message.aiAnalysisMessages.map((msg) => (
                                                <div key={msg.id} className="space-y-3">
                                                  {msg.type === "user" && msg.content && (
                                                    <div className="flex justify-end items-start gap-2">
                                                      <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 shrink-0"
                                                        onClick={(e) => deleteFollowUp(message.id, msg.id, e)}
                                                        title="Delete this follow-up question"
                                                        data-testid={`button-delete-followup-logs-${msg.id}`}
                                                      >
                                                        <X className="h-4 w-4" />
                                                      </Button>
                                                      <div className="bg-[#3B82F6] rounded-lg p-3 max-w-[80%]">
                                                        <p className="text-sm text-white font-medium">{msg.content}</p>
                                                      </div>
                                                    </div>
                                                  )}
                                                  {msg.response && !msg.response.success && (
                                                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                                                      <p className="text-sm text-[#374151]">{msg.response.message || "I couldn't process that question. Please try asking something about your project data."}</p>
                                                    </div>
                                                  )}
                                                  {msg.response && msg.response.success && (
                                                    <>
                                                      {msg.response.summary && (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                          {msg.response.summary.total_records !== undefined && (
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
                                                              <p className="text-xs text-[#6B7280] mb-1">Records</p>
                                                              <p className="text-xl font-bold text-[#8BC34A]">{msg.response.summary.total_records}</p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      <Tabs defaultValue="data" className="w-full">
                                                        <TabsList className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                                                          <TabsTrigger value="data" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><Table className="h-4 w-4 mr-1" />Response</TabsTrigger>
                                                          <TabsTrigger value="chart" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><BarChart3 className="h-4 w-4 mr-1" />Chart</TabsTrigger>
                                                          {canViewLogsTab && <TabsTrigger value="logs" className="!text-[#374151] data-[state=active]:!bg-white data-[state=active]:!text-[#111827]"><FileText className="h-4 w-4 mr-1" />Logs</TabsTrigger>}
                                                        </TabsList>
                                                        <TabsContent value="data" className="mt-4">
                                                          {msg.response.data?.[0]?.type === 'ai_analysis' ? (
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4"><MarkdownRenderer content={msg.response.data[0].narrative} /></div>
                                                          ) : msg.response.data?.[0]?.type === 'suggested_queries' ? (
                                                            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                                                              <p className="text-[#374151]">{msg.response.data[0].message || "No matching records found."}</p>
                                                              {msg.response.data[0].suggestions?.length > 0 && (
                                                                <div className="space-y-2">
                                                                  <p className="text-sm text-[#6B7280]">Try these alternatives:</p>
                                                                  <div className="flex flex-wrap gap-2">
                                                                    {msg.response.data[0].suggestions.map((s: any, i: number) => (
                                                                      <span key={i} className="bg-[#EFF6FF] text-[#1E40AF] px-3 py-1.5 rounded-full text-sm">{s.description || s.query || JSON.stringify(s)}</span>
                                                                    ))}
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                          ) : msg.response.data && msg.response.data.length > 0 ? (
                                                            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4"><TableWithExternalScrollbar data={msg.response.data} messageId={`followup-logs-${msg.id}`} height="300px" enableColumnSelection={false} selectedColumns={new Set()} onColumnSelectionChange={() => {}} /></div>
                                                          ) : (<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No data available</div>)}
                                                        </TabsContent>
                                                        <TabsContent value="chart" className="mt-4">
                                                          {msg.response.chart_config ? (<div className="bg-white border border-[#E5E7EB] rounded-xl p-4"><ChartComparison config={msg.response.chart_config} /></div>) : (<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-center text-[#6B7280]">No chart available</div>)}
                                                        </TabsContent>
                                                        <TabsContent value="logs" className="mt-4">
                                                          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                                                            <div><p className="text-xs text-[#6B7280] mb-1 font-mono">SQL QUERY:</p><pre className="text-xs text-[#8BC34A] font-mono bg-white p-2 rounded border overflow-x-auto">{msg.response.sql_query || "N/A"}</pre></div>
                                                            <div><p className="text-xs text-[#6B7280] mb-1 font-mono">PARAMETERS:</p><pre className="text-xs text-[#EA580C] font-mono bg-white p-2 rounded border overflow-x-auto">{JSON.stringify(msg.response.sql_params || [], null, 2)}</pre></div>
                                                          </div>
                                                        </TabsContent>
                                                      </Tabs>
                                                    </>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Loading Indicator - Show AI orchestration thinking */}
                                          {aiAnalysisLoading[message.id] && (
                                            <div className="flex justify-start mb-4"><TypingIndicator /></div>
                                          )}

                                          {/* Follow-up Input */}
                                          {canAskMore ? (
                                            aiAnalysisLoading[message.id] ? null : (
                                              <form onSubmit={(e) => { e.preventDefault(); if (aiAnalysisLoading[message.id]) return; const value = aiAnalysisInputs[message.id] || ""; if (value.trim()) handleAIAnalysis(message.id, value); }} className="bg-white border border-[#D1D5DB] rounded-lg p-2 flex items-end gap-2" data-testid={`form-followup-logs-${message.id}`}>
                                                <Textarea value={aiAnalysisInputs[message.id] || ""} onChange={(e) => setAiAnalysisInputs(prev => ({ ...prev, [message.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const value = e.currentTarget.value; if (value.trim() && !aiAnalysisLoading[message.id]) handleAIAnalysis(message.id, value); }}} placeholder={userFollowUpCount === 0 ? "Ask a follow-up question..." : `Ask follow-up ${userFollowUpCount + 1} of 3...`} className="flex-1 min-h-[44px] max-h-32 bg-transparent border-0 text-[#111827] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-0 px-3 py-2" disabled={aiAnalysisLoading[message.id]} data-testid={`input-followup-logs-${message.id}`} />
                                                <Button type="submit" size="icon" disabled={!aiAnalysisInputs[message.id]?.trim() || aiAnalysisLoading[message.id]} className="h-10 w-10 shrink-0 bg-[#3B82F6] hover:bg-[#1D4ED8] text-white border-0" data-testid={`button-send-followup-logs-${message.id}`}>
                                                  <Send className="h-4 w-4" />
                                                </Button>
                                              </form>
                                            )
                                          ) : (
                                            <div className="text-center py-3 space-y-2"><p className="text-sm text-[#9CA3AF]">Maximum 3 follow-up questions reached</p><Button onClick={handleNewChat} size="sm" className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white rounded-full px-4" data-testid="button-new-chat-limit"><Plus className="h-4 w-4 mr-1" />Start New Chat</Button></div>
                                          )}
                                        </div>
                                        );
                                      })()}
                                    </TabsContent>
                                  </Tabs>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                      </div>
                    </div>
                  ))}

                  {/* Show pending user question immediately while waiting for response */}
                  {queryMutation.isPending && (() => {
                    // Only show if we have a user message without a corresponding bot response
                    const userMessages = messages.filter(m => m.type === "user");
                    const botMessages = messages.filter(m => m.type === "bot");
                    
                    // If we have more user messages than bot messages, show the pending UI
                    // This prevents showing duplicate "Your Query" when the bot has already responded
                    if (userMessages.length <= botMessages.length) {
                      return null;
                    }
                    
                    const pendingUserMessage = userMessages.slice(-1)[0];
                    if (!pendingUserMessage) return null;
                    
                    return (
                      <div className="space-y-4 animate-fade-in-up">
                        {/* User's question - Right aligned */}
                        <div className="flex justify-end">
                          <div className="bg-[#3B82F6] rounded-2xl px-5 py-3 max-w-2xl shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="h-4 w-4 text-white/80" />
                              <span className="text-xs text-white/80 font-medium">Your Query</span>
                            </div>
                            <p className="text-sm text-white">
                              {pendingUserMessage.content}
                            </p>
                          </div>
                        </div>
                        {/* Loading indicator - Left aligned */}
                        <div className="flex justify-start">
                          <TypingIndicator />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Maximized Table Dialog */}
      <Dialog open={!!maximizedTable} onOpenChange={() => setMaximizedTable(null)}>
        <DialogContent className="max-w-[95vw] h-[95vh] bg-white border border-[#E5E7EB] flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[#111827] text-xl">Data Table (Full View)</DialogTitle>
              <Button
                size="sm"
                className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
                onClick={() => {
                  if (maximizedTable?.data && maximizedTable.data.length > 0) {
                    const headers = Object.keys(maximizedTable.data[0]);
                    const csv = [
                      headers.join(","),
                      ...maximizedTable.data.map((row: any) =>
                        headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
                      ),
                    ].join("\n");
                    
                    // Create download link
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `data-export-${Date.now()}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    toast({
                      title: "CSV Downloaded",
                      description: "Data exported successfully",
                    });
                  }
                }}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 mt-4">
            {maximizedTable?.data && maximizedTable.data.length > 0 && (
              <MaximizedTableWithScrollbars data={maximizedTable.data} />
            )}
          </div>
          
          <div className="mt-4 text-sm text-[#6B7280] text-center flex-shrink-0">
            Total Rows: {maximizedTable?.data?.length || 0}
          </div>
        </DialogContent>
      </Dialog>

      {/* Large Data Alert Dialog */}
      <AlertDialog open={showLargeDataAlert} onOpenChange={setShowLargeDataAlert}>
        <AlertDialogContent className="bg-white border border-[#E5E7EB] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#111827] text-xl flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-[#EA580C]" />
              Chat Contains Large Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280] text-base leading-relaxed">
              This chat contains too much data (16,000+ rows) and exceeds browser storage limits. 
              The conversation cannot be restored from history.
              <br /><br />
              Please start a new query if you need to access this data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
              data-testid="button-close-alert"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat Settings Dialog (Title Edit + FAQ) */}
      <Dialog open={chatSettingsOpen} onOpenChange={(open) => !open && handleCloseChatSettings()}>
        <DialogContent className="bg-white border border-[#E5E7EB] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#111827] text-lg flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#8BC34A]" />
              Chat Settings
            </DialogTitle>
            <DialogDescription className="text-[#6B7280] text-sm">
              Edit chat title and FAQ settings.
            </DialogDescription>
          </DialogHeader>
          
          {chatSettingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#8BC34A]" />
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {/* Chat Title */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">
                  Chat Title
                </Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter chat title"
                  className="border-[#D1D5DB] focus:border-[#8BC34A] focus:ring-[#8BC34A]"
                  data-testid="input-chat-title"
                />
              </div>
              
              {/* Divider */}
              <div className="h-px bg-[#E5E7EB]" />
              
              {/* FAQ Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#8BC34A]" />
                  <span className="text-sm font-semibold text-[#374151]">FAQ Sample Settings</span>
                </div>
                
                {chatSettingsMessageContent ? (
                  <>
                    {/* Show the question that will be marked */}
                    <div className="p-3 bg-[#F3F4F6] rounded-lg border border-[#E5E7EB]">
                      <p className="text-xs text-[#6B7280] mb-1">Question to mark as FAQ:</p>
                      <p className="text-sm text-[#374151] line-clamp-2">{chatSettingsMessageContent}</p>
                    </div>
                    
                    {/* Mark as FAQ Checkbox - only for admin/superadmin */}
                    {canManageFAQ && (
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="chat-settings-is-faq"
                          checked={chatSettingsIsFaq}
                          onCheckedChange={(checked) => setChatSettingsIsFaq(checked === true)}
                          className="border-[#D1D5DB] data-[state=checked]:bg-[#8BC34A] data-[state=checked]:border-[#8BC34A]"
                          data-testid="checkbox-chat-settings-faq"
                        />
                        <Label 
                          htmlFor="chat-settings-is-faq" 
                          className="text-sm font-medium text-[#374151] cursor-pointer"
                        >
                          Mark as FAQ sample (show on home page)
                        </Label>
                      </div>
                    )}
                    
                    {/* Category Selector - Combobox with create new option (only for admin/superadmin) */}
                    {canManageFAQ && chatSettingsIsFaq && (
                      <div className="space-y-2 pl-6">
                        <Label className="text-sm font-medium text-[#374151]">
                          Category <span className="text-red-500">*</span>
                        </Label>
                        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={categoryPopoverOpen}
                              className="w-full justify-between border-[#D1D5DB] hover:bg-[#F9FAFB] text-left font-normal"
                              data-testid="select-chat-settings-category"
                            >
                              {chatSettingsFaqCategory || "Select or create a category..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-white" align="start">
                            <div className="p-2 border-b border-[#E5E7EB]">
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4 text-[#8BC34A]" />
                                <input
                                  type="text"
                                  placeholder="Type to create new category..."
                                  value={newCategoryInput}
                                  onChange={(e) => setNewCategoryInput(e.target.value)}
                                  className="flex-1 text-sm outline-none bg-transparent text-[#111827] placeholder:text-[#9CA3AF]"
                                  data-testid="input-category-search"
                                />
                              </div>
                              <p className="text-xs text-[#9CA3AF] mt-1 ml-6">Or select from existing categories below</p>
                            </div>
                            <Command>
                              <CommandList>
                                <CommandEmpty>
                                  {newCategoryInput.trim() && (
                                    <button
                                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                                      onClick={() => {
                                        setChatSettingsFaqCategory(newCategoryInput.trim());
                                        setCategoryPopoverOpen(false);
                                        setNewCategoryInput("");
                                      }}
                                      data-testid="button-create-category"
                                    >
                                      <PlusCircle className="h-4 w-4 text-[#8BC34A]" />
                                      Create "{newCategoryInput.trim()}"
                                    </button>
                                  )}
                                </CommandEmpty>
                                <CommandGroup heading="Existing Categories">
                                  {allCategories
                                    .filter((cat: string) => cat.toLowerCase().includes(newCategoryInput.toLowerCase()))
                                    .map((category) => (
                                    <CommandItem
                                      key={category}
                                      value={category}
                                      onSelect={() => {
                                        setChatSettingsFaqCategory(category);
                                        setCategoryPopoverOpen(false);
                                        setNewCategoryInput("");
                                      }}
                                      className="cursor-pointer"
                                      data-testid={`option-category-${category}`}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          chatSettingsFaqCategory === category ? "opacity-100 text-[#8BC34A]" : "opacity-0"
                                        }`}
                                      />
                                      {category}
                                      {!DEFAULT_FAQ_CATEGORIES.includes(category as any) && (
                                        <span className="ml-auto text-xs text-[#9CA3AF]">custom</span>
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {newCategoryInput.trim() && !allCategories.some(c => c.toLowerCase() === newCategoryInput.trim().toLowerCase()) && (
                                  <CommandGroup heading="Create New">
                                    <CommandItem
                                      value={`create-${newCategoryInput.trim()}`}
                                      onSelect={() => {
                                        setChatSettingsFaqCategory(newCategoryInput.trim());
                                        setCategoryPopoverOpen(false);
                                        setNewCategoryInput("");
                                      }}
                                      className="cursor-pointer text-[#8BC34A]"
                                      data-testid="button-create-new-category"
                                    >
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Create "{newCategoryInput.trim()}"
                                    </CommandItem>
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-[#6B7280]">
                          Select an existing category or type to create a new one.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 bg-[#FEF2F2] rounded-lg border border-[#FECACA]">
                    <p className="text-sm text-[#991B1B]">No user question found in this chat to mark as FAQ.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseChatSettings}
              className="border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]"
              data-testid="button-chat-settings-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChatSettings}
              disabled={updateChatMutation.isPending || updateMessageFAQMutation.isPending || chatSettingsLoading}
              className="bg-[#8BC34A] hover:bg-[#689F38] text-white"
              data-testid="button-chat-settings-save"
            >
              {(updateChatMutation.isPending || updateMessageFAQMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAQ Edit Dialog */}
      <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
        <DialogContent className="bg-white border border-[#E5E7EB] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#111827] text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-[#8BC34A]" />
              FAQ Sample Settings
            </DialogTitle>
            <DialogDescription className="text-[#6B7280] text-sm">
              Mark this question as an FAQ sample to show it on the home page.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mark as FAQ Checkbox */}
            <div className="flex items-center space-x-3">
              <Checkbox
                id="is-faq"
                checked={faqIsFaq}
                onCheckedChange={(checked) => setFaqIsFaq(checked === true)}
                className="border-[#D1D5DB] data-[state=checked]:bg-[#8BC34A] data-[state=checked]:border-[#8BC34A]"
                data-testid="checkbox-is-faq"
              />
              <Label 
                htmlFor="is-faq" 
                className="text-sm font-medium text-[#374151] cursor-pointer"
              >
                Mark as FAQ sample
              </Label>
            </div>
            
            {/* Category Selector - Only shown when checkbox is checked */}
            {faqIsFaq && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#374151]">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryPopoverOpen}
                      className="w-full justify-between border-[#D1D5DB] focus:border-[#8BC34A] focus:ring-[#8BC34A] bg-white hover:bg-[#F9FAFB]"
                      data-testid="select-faq-category"
                    >
                      {faqCategory || "Select a category"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 bg-white" align="start">
                    <div className="p-2 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-[#8BC34A]" />
                        <input
                          type="text"
                          placeholder="Type to create new category..."
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          className="flex-1 text-sm outline-none bg-transparent text-[#111827] placeholder:text-[#9CA3AF]"
                          data-testid="input-new-category"
                        />
                      </div>
                      <p className="text-xs text-[#9CA3AF] mt-1 ml-6">Or select from existing categories below</p>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <div className="p-1 text-xs text-[#6B7280] px-2 pt-2">Existing Categories</div>
                      {allCategories
                        .filter((cat: string) => 
                          cat.toLowerCase().includes(newCategoryInput.toLowerCase())
                        )
                        .map((category: string) => (
                          <div
                            key={category}
                            className={`flex items-center justify-between px-2 py-2 text-sm cursor-pointer hover:bg-[#F3F4F6] rounded-md mx-1 ${faqCategory === category ? 'bg-[#8BC34A]/10 text-[#689F38]' : 'text-[#374151]'}`}
                            onClick={() => {
                              setFaqCategory(category);
                              setNewCategoryInput("");
                              setCategoryPopoverOpen(false);
                            }}
                            data-testid={`option-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <span>{category}</span>
                            {faqCategory === category && <Check className="h-4 w-4" />}
                          </div>
                        ))}
                      {/* Option to create new category if input doesn't match existing */}
                      {newCategoryInput.trim() && !allCategories.some((cat: string) => cat.toLowerCase() === newCategoryInput.toLowerCase()) && (
                        <div
                          className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-[#8BC34A]/10 text-[#8BC34A] rounded-md mx-1 border-t border-[#E5E7EB] mt-1"
                          onClick={() => {
                            setFaqCategory(newCategoryInput.trim());
                            setNewCategoryInput("");
                            setCategoryPopoverOpen(false);
                          }}
                          data-testid="option-create-category"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Create "{newCategoryInput.trim()}"</span>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFaqDialogOpen(false)}
              className="border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]"
              data-testid="button-faq-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveFaq}
              disabled={updateMessageFAQMutation.isPending}
              className="bg-[#8BC34A] hover:bg-[#689F38] text-white"
              data-testid="button-faq-save"
            >
              {updateMessageFAQMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Log Dialog */}
      <Dialog open={errorLogDialogOpen} onOpenChange={setErrorLogDialogOpen}>
        <DialogContent className="bg-white border border-[#E5E7EB] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#111827] text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#3B82F6]" />
              Log Query for Review
            </DialogTitle>
            <DialogDescription className="text-[#6B7280] text-sm">
              Log this query for review. Add a comment describing what you expected or any issues.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">
                Question
              </Label>
              <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-sm text-[#374151]">
                {errorLogQuestion}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#374151]">
                Issue Type
              </Label>
              <div className="p-3 bg-[#FEF9E6] border border-[#F59E0B]/30 rounded-lg text-sm text-[#92400E]">
                {errorLogErrorMessage}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="error-comment" className="text-sm font-medium text-[#374151]">
                Your Comment <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="error-comment"
                placeholder="Describe what you expected to happen, or provide additional context..."
                value={errorLogComment}
                onChange={(e) => setErrorLogComment(e.target.value)}
                className="min-h-[100px] border-[#D1D5DB] focus:border-[#DC2626] focus:ring-[#DC2626]"
                data-testid="input-error-comment"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="error-screenshot" className="text-sm font-medium text-[#374151]">
                Screenshot (optional)
              </Label>
              <div className="flex items-center gap-3">
                <label 
                  htmlFor="error-screenshot"
                  className="flex items-center gap-2 px-4 py-2 border border-[#D1D5DB] rounded-lg cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                >
                  <ImagePlus className="h-4 w-4 text-[#6B7280]" />
                  <span className="text-sm text-[#374151]">
                    {errorLogScreenshot ? "Change file" : "Add screenshot"}
                  </span>
                </label>
                <input
                  type="file"
                  id="error-screenshot"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={(e) => setErrorLogScreenshot(e.target.files?.[0] || null)}
                  className="hidden"
                  data-testid="input-error-screenshot"
                />
                {errorLogScreenshot && (
                  <div className="flex items-center gap-2 text-sm text-[#374151]">
                    <span className="truncate max-w-[150px]">{errorLogScreenshot.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-[#6B7280] hover:text-[#DC2626]"
                      onClick={() => setErrorLogScreenshot(null)}
                      data-testid="button-remove-screenshot"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setErrorLogDialogOpen(false)}
              className="border-[#D1D5DB] text-[#374151] hover:bg-[#F3F4F6]"
              data-testid="button-error-log-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitErrorLog}
              disabled={errorLogLoading || !errorLogComment.trim()}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
              data-testid="button-error-log-submit"
            >
              {errorLogLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Analysis Results Modal */}
      <Dialog open={columnAnalysisModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setColumnAnalysisModal(prev => ({ ...prev, isOpen: false }));
        }
      }}>
        <DialogContent className="bg-white border border-[#E5E7EB] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[#111827] text-lg flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#3B82F6]" />
                Filter Selected Columns
              </DialogTitle>
              {columnAnalysisModal.response?.data && columnAnalysisModal.response.data.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const data = columnAnalysisModal.response?.data || [];
                      if (data.length === 0) return;
                      const headers = Object.keys(data[0]);
                      const csvRows = [
                        headers.join(','),
                        ...data.map(row => 
                          headers.map(h => {
                            const val = row[h];
                            const strVal = val === null || val === undefined ? '' : String(val);
                            return strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')
                              ? `"${strVal.replace(/"/g, '""')}"`
                              : strVal;
                          }).join(',')
                        )
                      ];
                      const csvText = csvRows.join('\n');
                      if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(csvText);
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = csvText;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                      }
                      toast({ title: "Copied!", description: `${data.length} rows copied to clipboard as CSV` });
                    }}
                    className="text-[#3B82F6] border-[#3B82F6]"
                    data-testid="button-copy-csv-column-analysis"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMaximizedTable({
                        messageId: 'column-analysis-maximized',
                        data: columnAnalysisModal.response?.data || []
                      });
                    }}
                    className="text-[#3B82F6] border-[#3B82F6]"
                    data-testid="button-maximize-column-analysis"
                  >
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Maximize
                  </Button>
                </div>
              )}
            </div>
            {columnAnalysisModal.messageId && selectedColumnsPerMessage[columnAnalysisModal.messageId] && (
              <DialogDescription className="text-[#6B7280] text-sm">
                Selected: {Array.from(selectedColumnsPerMessage[columnAnalysisModal.messageId] || []).join(', ')}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {/* Filter Input Form - Always show at top */}
          <div className="border-b border-[#E5E7EB] pb-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const msgId = columnAnalysisModal.messageId;
                if (msgId) {
                  // Handle follow-up table data sources
                  let dataSource: any[] | null = null;
                  
                  // Check if this is a follow-up table ID pattern
                  const followupMatch = msgId.match(/^(?:ai-)?followup-(.+?)(?:-samples)?$/);
                  if (followupMatch) {
                    const parentMsgId = followupMatch[1];
                    const isSamples = msgId.endsWith('-samples');
                    // Find the parent message and look for AI analysis messages
                    for (const msg of messages) {
                      if (msg.aiAnalysisMessages) {
                        const followupMsg = msg.aiAnalysisMessages.find((m: any) => m.id === parentMsgId);
                        if (followupMsg?.response?.data) {
                          if (isSamples && followupMsg.response.data[0]?.samples) {
                            dataSource = followupMsg.response.data[0].samples;
                          } else {
                            dataSource = followupMsg.response.data;
                          }
                          break;
                        }
                      }
                    }
                  } else {
                    // Regular message table
                    const msg = messages.find(m => m.id === msgId);
                    if (msg?.response?.data) {
                      dataSource = msg.response.data;
                    }
                  }
                  
                  if (dataSource) {
                    submitColumnQuestion(msgId, dataSource);
                  }
                }
              }}
              className="flex items-center gap-2"
            >
              {(() => {
                const selectedCols = columnAnalysisModal.messageId ? selectedColumnsPerMessage[columnAnalysisModal.messageId] : new Set<string>();
                const colType = getColumnFilterType(selectedCols || new Set());
                const filterHints = getFilterExamples(colType);
                const colorMap: Record<string, string> = {
                  emerald: 'bg-emerald-50 text-emerald-700',
                  purple: 'bg-purple-50 text-purple-700',
                  amber: 'bg-amber-50 text-amber-700',
                  cyan: 'bg-cyan-50 text-cyan-700',
                };
                return (
                  <>
                    <div className="flex-1 relative">
                      <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                      <Input
                        value={askAboutColumnsInput[columnAnalysisModal.messageId || ''] || ''}
                        onChange={(e) => setAskAboutColumnsInput(prev => ({ ...prev, [columnAnalysisModal.messageId || '']: e.target.value }))}
                        placeholder={filterHints.placeholder}
                        className="pl-10 bg-white border-[#E5E7EB]"
                        data-testid="input-column-filter"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!askAboutColumnsInput[columnAnalysisModal.messageId || '']?.trim() || columnAnalysisModal.loading}
                      className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
                      data-testid="button-apply-column-filter"
                    >
                      {columnAnalysisModal.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Filter
                        </>
                      )}
                    </Button>
                  </>
                );
              })()}
            </form>
            {(() => {
              const selectedCols = columnAnalysisModal.messageId ? selectedColumnsPerMessage[columnAnalysisModal.messageId] : new Set<string>();
              const colType = getColumnFilterType(selectedCols || new Set());
              const filterHints = getFilterExamples(colType);
              const realValues = columnAnalysisModal.messageId ? getRealColumnValues(columnAnalysisModal.messageId, selectedCols || new Set(), 4) : [];
              const colorClasses = ['bg-emerald-50 text-emerald-700', 'bg-purple-50 text-purple-700', 'bg-amber-50 text-amber-700', 'bg-cyan-50 text-cyan-700'];
              
              return (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-[#374151]">
                    <span className="text-[#3B82F6]">Supported keywords:</span>{" "}
                    {filterHints.keywords.map((kw, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono mx-0.5">{kw}</span>
                    ))}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-[#6B7280]">Sample values:</span>
                    {realValues.length > 0 ? (
                      realValues.map((val, idx) => (
                        <span 
                          key={idx} 
                          className={`${colorClasses[idx % colorClasses.length]} px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80`}
                          onClick={() => setAskAboutColumnsInput(prev => ({ ...prev, [columnAnalysisModal.messageId || '']: val }))}
                          title="Click to use this value"
                        >{val}</span>
                      ))
                    ) : (
                      filterHints.examples.map((ex, idx) => (
                        <span key={idx} className={`${colorClasses[idx % colorClasses.length]} px-2 py-0.5 rounded-full font-medium`}>{ex.text}</span>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          
          <div className="flex-1 overflow-y-auto py-4">
            {columnAnalysisModal.loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="h-8 w-8 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin" />
                <p className="text-[#6B7280]">Filtering data...</p>
              </div>
            ) : columnAnalysisModal.response ? (
              <div className="space-y-4">
                {/* Filter Summary */}
                {columnAnalysisModal.response.ai_insights && (
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Filter className="h-5 w-5 text-[#3B82F6]" />
                      <span className="font-semibold text-[#111827]">Filter Results</span>
                    </div>
                    <p className="text-[#374151]">
                      {columnAnalysisModal.response.ai_insights}
                    </p>
                  </div>
                )}
                
                {/* Data Table if available */}
                {columnAnalysisModal.response.data && columnAnalysisModal.response.data.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#111827] mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Results ({columnAnalysisModal.response.data.length} records)
                    </h4>
                    <div className="max-h-[350px] overflow-auto border border-[#E5E7EB] rounded-lg">
                      <TableWithExternalScrollbar 
                        data={columnAnalysisModal.response.data}
                        messageId="column-analysis-modal"
                        height="300px"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-[#6B7280]">
                <p>Enter a filter condition above to filter the selected columns.</p>
                {(() => {
                  const selectedCols = columnAnalysisModal.messageId ? selectedColumnsPerMessage[columnAnalysisModal.messageId] : new Set<string>();
                  const realValues = columnAnalysisModal.messageId ? getRealColumnValues(columnAnalysisModal.messageId, selectedCols || new Set(), 4) : [];
                  const colorClasses = ['bg-emerald-50 text-emerald-700', 'bg-purple-50 text-purple-700', 'bg-amber-50 text-amber-700', 'bg-cyan-50 text-cyan-700'];
                  
                  if (realValues.length > 0) {
                    return (
                      <div className="flex flex-wrap justify-center gap-2 mt-3">
                        <span className="text-[#6B7280] text-sm">Click a value to filter:</span>
                        {realValues.map((val, idx) => (
                          <span 
                            key={idx} 
                            className={`${colorClasses[idx % colorClasses.length]} px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:opacity-80`}
                            onClick={() => setAskAboutColumnsInput(prev => ({ ...prev, [columnAnalysisModal.messageId || '']: val }))}
                            title="Click to use this value"
                          >{val}</span>
                        ))}
                      </div>
                    );
                  }
                  
                  const colType = getColumnFilterType(selectedCols || new Set());
                  const filterHints = getFilterExamples(colType);
                  return (
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {filterHints.examples.map((ex, idx) => (
                        <span key={idx} className={`${colorClasses[idx % colorClasses.length]} px-3 py-1 rounded-full text-sm font-medium`}>{ex.text}</span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (columnAnalysisModal.messageId) {
                  clearColumnSelection(columnAnalysisModal.messageId);
                }
              }}
              className="text-[#6B7280] hover:text-[#111827]"
              data-testid="button-clear-selection-popup"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Selection
            </Button>
            <Button
              variant="outline"
              onClick={() => setColumnAnalysisModal(prev => ({ ...prev, isOpen: false }))}
              data-testid="button-close-column-analysis"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
