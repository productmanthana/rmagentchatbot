import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useEmbedContext } from "./embed-with-id";
import { 
  MessageSquare, 
  Filter, 
  ArrowRight, 
  ArrowLeft,
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Lightbulb,
  Table2,
  MousePointerClick,
  Pencil,
  Check,
  X
} from "lucide-react";

// Parse embed context from URL params (for iframe third-party context)
function getEmbedContextFromUrl(): { isEmbed: boolean; embedId: string | null; displayId: string | null; role: 'superadmin' | 'admin' | 'user' | null } {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmbedId = urlParams.get('embed');
    const urlToken = urlParams.get('token');
    
    if (urlEmbedId && urlToken) {
      // Get display ID from localStorage (localStorage usually works even in iframes)
      let storedDisplayId: string | null = null;
      try {
        storedDisplayId = localStorage.getItem(`embed_display_id_${urlEmbedId}`);
      } catch {}
      
      return {
        isEmbed: true,
        embedId: urlEmbedId,
        displayId: storedDisplayId,
        role: 'user', // Default role
      };
    }
  } catch (e) {
    console.error('[HelpPage] Error parsing URL params:', e);
  }
  return { isEmbed: false, embedId: null, displayId: null, role: null };
}

export default function HelpPage() {
  console.log('[HelpPage] Rendering...');
  
  // Try context first, then fall back to URL params
  const contextEmbed = useEmbedContext();
  const urlEmbed = getEmbedContextFromUrl();
  
  // Use context if it has embed data, otherwise use URL params
  const embedContext = contextEmbed.isEmbed ? contextEmbed : {
    ...contextEmbed,
    isEmbed: urlEmbed.isEmbed,
    embedId: urlEmbed.embedId,
    displayId: urlEmbed.displayId,
    role: urlEmbed.role,
  };
  
  console.log('[HelpPage] embedContext:', embedContext, 'urlEmbed:', urlEmbed);

  const [isEditingId, setIsEditingId] = useState(false);
  const [editedId, setEditedId] = useState(embedContext.displayId || "");
  const [currentDisplayId, setCurrentDisplayId] = useState(embedContext.displayId || "");
  const [isLoadingId, setIsLoadingId] = useState(false);

  // Fetch displayId from server if we have embed params but no displayId
  useEffect(() => {
    const fetchDisplayId = async () => {
      if (embedContext.isEmbed && !currentDisplayId && embedContext.embedId) {
        setIsLoadingId(true);
        try {
          // Get token from sessionStorage or URL
          let token = sessionStorage.getItem('embedToken');
          if (!token) {
            const urlParams = new URLSearchParams(window.location.search);
            token = urlParams.get('token');
          }
          
          if (token) {
            // Store token in sessionStorage for later use
            sessionStorage.setItem('embedToken', token);
            
            const response = await fetch('/api/embed/user-id', {
              headers: { 'X-Embed-Token': token }
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.displayId) {
                setCurrentDisplayId(data.displayId);
                setEditedId(data.displayId);
                // Also store in localStorage for future use
                try {
                  localStorage.setItem(`embed_display_id_${embedContext.embedId}`, data.displayId);
                } catch {}
              }
            }
          }
        } catch (error) {
          console.error('[HelpPage] Error fetching displayId:', error);
        } finally {
          setIsLoadingId(false);
        }
      }
    };
    
    fetchDisplayId();
  }, [embedContext.isEmbed, embedContext.embedId, currentDisplayId]);

  const handleSaveId = async () => {
    if (!editedId.trim() || !embedContext.embedId) return;
    
    try {
      // Get token from sessionStorage (where embed page stores it) or URL params as fallback
      let token = sessionStorage.getItem('embedToken');
      if (!token) {
        const urlParams = new URLSearchParams(window.location.search);
        token = urlParams.get('token');
      }
      
      if (!token) {
        console.error('No embed token available');
        return;
      }
      
      const response = await fetch('/api/embed/update-display-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedId: embedContext.embedId,
          token: token,
          currentDisplayId: currentDisplayId,
          newDisplayId: editedId.trim()
        })
      });
      
      if (response.ok) {
        try {
          localStorage.setItem(`embed_display_id_${embedContext.embedId}`, editedId.trim());
        } catch {}
        // Update state for immediate UI update
        setCurrentDisplayId(editedId.trim());
        setIsEditingId(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to update ID:', errorData.error);
      }
    } catch (error) {
      console.error('Failed to update ID:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditedId(currentDisplayId);
    setIsEditingId(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Link href={embedContext.isEmbed && embedContext.embedId ? `/embed/${embedContext.embedId}` : "/"}>
              <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Back to Chat
              </Button>
            </Link>
            
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold" data-testid="text-help-title">Help & Guidelines</h1>
            <p className="text-muted-foreground">
              Learn how to effectively query data using original questions, follow-up questions, and column selection.
            </p>
          </div>
        </div>

        {/* Session identifier for embed users - with edit option */}
        {embedContext.isEmbed && currentDisplayId && (
          <div className="flex items-center gap-2">
            {isEditingId ? (
              <>
                <Input
                  value={editedId}
                  onChange={(e) => setEditedId(e.target.value)}
                  className="h-7 w-40 text-sm"
                  data-testid="input-edit-display-id"
                  autoFocus
                />
                <button
                  onClick={handleSaveId}
                  className="text-green-600 hover:text-green-700 p-1"
                  data-testid="button-save-id"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-muted-foreground hover:text-foreground p-1"
                  data-testid="button-cancel-edit"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground" data-testid="text-embed-display-id">
                  {currentDisplayId}
                </span>
                <button
                  onClick={() => setIsEditingId(true)}
                  className="text-muted-foreground hover:text-foreground p-1"
                  data-testid="button-edit-id"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}

        <Separator />

        {/* Original Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Original Questions
            </CardTitle>
            <CardDescription>
              Start a new conversation with a clear, specific question about your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              An original question is the first query you ask in a conversation. It establishes the 
              context for any follow-up questions you may have.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Example Original Questions:</span>
              </div>
              <ul className="space-y-2 ml-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>"Show projects in West region"</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>"List all Education projects in California"</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>"Show projects with fee above $5 million"</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>"Find healthcare projects for client Client 4885"</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-blue-500" />
              Follow-up Questions
            </CardTitle>
            <CardDescription>
              Refine your results by adding additional filters to your original question
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p>
                Follow-up questions allow you to <strong>refine and narrow down</strong> the results 
                from your original question. Each follow-up is <strong>appended to your original query</strong>, 
                creating a more specific search.
              </p>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Important: How Follow-ups Work
                </div>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                  <li>• You can ask up to <strong>3 follow-up questions</strong> per original query</li>
                  <li>• Each follow-up is <strong>added to your original question</strong>, not replacing it</li>
                  <li>• The 2nd and 3rd follow-ups append to both the original AND previous follow-ups</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Practical Example */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Practical Example: Building on Your Query
              </h4>
              
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default">Original</Badge>
                  </div>
                  <p className="font-mono text-sm">"Show projects in West region"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    → Returns all projects in the West region
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Follow-up 1</Badge>
                  </div>
                  <p className="font-mono text-sm">"with fee above $2 million"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    → System interprets as: "Show projects in West region <strong>with fee above $2 million</strong>"
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Follow-up 2</Badge>
                  </div>
                  <p className="font-mono text-sm">"only Won status"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    → System interprets as: "Show projects in West region with fee above $2 million <strong>only Won status</strong>"
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Follow-up 3</Badge>
                  </div>
                  <p className="font-mono text-sm">"for Education category"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    → System interprets as: "Show projects in West region with fee above $2 million only Won status <strong>for Education category</strong>"
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Good vs Bad Follow-ups */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Good Follow-up Questions
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>"with win rate above 60%"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>"only in California"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>"from 2023 onwards"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>"for Healthcare category"</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  What NOT to Expect
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Follow-ups do NOT replace your original question</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Cannot start a completely new query as a follow-up</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>More than 3 follow-ups are not supported</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>Cannot undo a previous follow-up filter</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column Selection Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-purple-500" />
              Column Selection (Data Extraction)
            </CardTitle>
            <CardDescription>
              Manually extract and filter specific data from your current results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p>
                Column selection allows you to <strong>manually extract specific data</strong> from the 
                results already displayed in your table. This is different from follow-up questions — 
                it works directly on your current dataset without making new AI queries.
              </p>

              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div className="flex items-center gap-2 font-medium text-purple-700 dark:text-purple-300 mb-2">
                  <MousePointerClick className="h-4 w-4" />
                  How to Use Column Selection
                </div>
                <ol className="space-y-1 text-sm text-purple-600 dark:text-purple-400 list-decimal list-inside">
                  <li>Click on column headers in the data table to select them (they turn blue)</li>
                  <li>A floating panel appears showing your selected columns</li>
                  <li>Type your question about those specific columns</li>
                  <li>Results appear in a popup modal with extracted data</li>
                </ol>
              </div>
            </div>

            <Separator />

            {/* Practical Side-by-Side Comparison */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-amber-500" />
                When to Use Column Selection vs Follow-up Questions
              </h4>
              
              <p className="text-muted-foreground">
                The key difference: <strong>Column Selection</strong> works on data you already have. 
                <strong> Follow-up Questions</strong> ask the AI to get new/different data.
              </p>

              {/* Scenario 1: Column Selection */}
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    Use Column Selection
                  </Badge>
                  <span className="text-sm font-medium">When data is already in your table</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="bg-white dark:bg-gray-900 rounded p-3 border">
                    <p className="font-medium mb-1">Example Scenario:</p>
                    <p className="text-muted-foreground">
                      You asked <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">"Show projects in West region"</span> and got 150 results.
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Now you see hospitals, schools, and offices in your results table. You want to see <strong>only the hospitals</strong>.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span><strong>Solution:</strong> Click "Project Type" column → Type "Show hospitals"</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Instantly filters your 150 results to show only hospitals (no AI call needed)</span>
                  </div>
                </div>
              </div>

              {/* Scenario 2: Follow-up Question */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    Use Follow-up Question
                  </Badge>
                  <span className="text-sm font-medium">When you need to add a NEW filter</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="bg-white dark:bg-gray-900 rounded p-3 border">
                    <p className="font-medium mb-1">Example Scenario:</p>
                    <p className="text-muted-foreground">
                      You asked <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">"Show projects in West region"</span> and got 150 results.
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Now you want to see <strong>only projects with fee above $2 million</strong>. This requires AI to run a new query with the fee filter.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-blue-500" />
                    <span><strong>Solution:</strong> Type follow-up: "with fee above $2 million"</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>AI combines with original: "West region + fee above $2M" → Returns filtered results</span>
                  </div>
                </div>
              </div>

              {/* Simple Rule */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">Simple Rule:</p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                      <li>• <strong>Can you see the data in your table?</strong> → Use Column Selection (click the column)</li>
                      <li>• <strong>Need to add a new condition the AI should apply?</strong> → Use Follow-up Question</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Quick Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Original Question
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Starts a new conversation</li>
                  <li>• Sets the base context</li>
                  <li>• Unlimited per session</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  Follow-up Question
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Appends to original</li>
                  <li>• Max 3 per original</li>
                  <li>• Triggers new AI query</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-purple-500" />
                  Column Selection
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Works on current data</li>
                  <li>• No AI call needed</li>
                  <li>• Manual extraction</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Start broad, then narrow down</p>
                  <p className="text-sm text-muted-foreground">
                    Begin with a general query like "Show all projects" then use follow-ups to add filters progressively.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Use natural language</p>
                  <p className="text-sm text-muted-foreground">
                    You can say "customer" instead of "client", "opportunities" instead of "projects", or "cost" instead of "fee".
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Need a fresh start?</p>
                  <p className="text-sm text-muted-foreground">
                    Click "New Chat" to start a completely new query without any previous context.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">PID lookup</p>
                  <p className="text-sm text-muted-foreground">
                    Project IDs are stored in the "Project Name" column as "PID XXXXX". You can search for specific PIDs directly.
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
