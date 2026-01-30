import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Copy, Check, Code, Link as LinkIcon, ArrowLeft, Globe, Shield, Clock } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { useEmbedContext } from "./embed-with-id";

// Parse embed context from URL params (for iframe third-party context)
function getEmbedContextFromUrl(): { isEmbed: boolean; embedId: string | null } {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmbedId = urlParams.get('embed');
    const urlToken = urlParams.get('token');
    
    if (urlEmbedId && urlToken) {
      return { isEmbed: true, embedId: urlEmbedId };
    }
  } catch {}
  return { isEmbed: false, embedId: null };
}

interface EmbedLink {
  id: string;
  embed_id: string;
  role: 'superadmin' | 'admin' | 'user';
  allowed_domain: string;
  name: string;
  created_by_email: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}


export default function IntegrationPage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'url' | 'iframe' | null>(null);

  // Get embed context for navigation
  const contextEmbed = useEmbedContext();
  const urlEmbed = getEmbedContextFromUrl();
  const isEmbed = contextEmbed.isEmbed || urlEmbed.isEmbed;
  const embedId = contextEmbed.embedId || urlEmbed.embedId;
  const backUrl = isEmbed && embedId ? `/embed/${embedId}` : "/";

  const { data: embedLinks = [], isLoading } = useQuery<EmbedLink[]>({
    queryKey: ["/api/embed-links"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; allowed_domain: string }) => {
      const response = await apiRequest("POST", "/api/embed-links", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embed-links"] });
      setName("");
      setDomain("");
      toast({
        title: "Embed Link Created",
        description: "Your new embed link has been generated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create embed link",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/embed-links/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embed-links"] });
      toast({
        title: "Embed Link Deleted",
        description: "The embed link has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete embed link",
      });
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !domain.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all fields",
      });
      return;
    }
    createMutation.mutate({ name, allowed_domain: domain });
  };

  const getEmbedUrl = (embedId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/embed/${embedId}?token=YOUR_JWT_TOKEN`;
  };

  const getIframeCode = (embedId: string) => {
    const url = getEmbedUrl(embedId);
    return `<iframe src="${url}" width="100%" height="100vh" frameborder="0" style="border: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;"></iframe>`;
  };

  const copyToClipboard = async (text: string, id: string, type: 'url' | 'iframe') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopiedType(type);
      toast({
        title: "Copied!",
        description: `${type === 'url' ? 'URL' : 'Iframe code'} copied to clipboard`,
      });
      setTimeout(() => {
        setCopiedId(null);
        setCopiedType(null);
      }, 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <WouterLink href={backUrl}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </WouterLink>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Integration Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Generate embed links for external website integration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-[#8BC34A]" />
                Generate Embed Link
              </CardTitle>
              <CardDescription>
                Create a new embed link with domain restriction. User roles are determined by JWT token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Link Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., RMOne Production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-link-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Allowed Domain</Label>
                <Input
                  id="domain"
                  placeholder="e.g., rmone.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  data-testid="input-domain"
                />
                <p className="text-xs text-gray-500">
                  Only this domain can use the embed link
                </p>
              </div>

              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="w-full bg-[#8BC34A] hover:bg-[#7CB342] text-white"
                data-testid="button-generate"
              >
                {createMutation.isPending ? "Generating..." : "Generate Embed Link"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-[#8BC34A]" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8BC34A]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#8BC34A] font-semibold">1</span>
                </div>
                <div>
                  <p className="font-medium">Generate Link</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter a name and the domain that will use this embed
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8BC34A]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#8BC34A] font-semibold">2</span>
                </div>
                <div>
                  <p className="font-medium">Copy Iframe Code</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Copy the generated iframe code to your website
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8BC34A]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#8BC34A] font-semibold">3</span>
                </div>
                <div>
                  <p className="font-medium">Embed on Your Site</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Paste the iframe code - no login required for users
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Domain Restriction</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Embed links only work from the specified domain. Anyone trying to access from another domain will be blocked.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#8BC34A]" />
              Active Embed Links
            </CardTitle>
            <CardDescription>
              Manage your generated embed links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : embedLinks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No embed links created yet. Create one above to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {embedLinks.map((link) => (
                  <div
                    key={link.id}
                    className="border rounded-lg p-4 bg-white dark:bg-gray-800"
                    data-testid={`embed-link-${link.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {link.name}
                          </h3>
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            JWT Auth
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            {link.allowed_domain}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Created: {formatDate(link.created_at)}
                          </span>
                          {link.last_used_at && (
                            <span className="text-green-600 dark:text-green-400">
                              Last used: {formatDate(link.last_used_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(link.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-${link.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <Label className="text-xs text-gray-500">Embed URL</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={getEmbedUrl(link.embed_id)}
                            readOnly
                            className="font-mono text-sm bg-gray-50 dark:bg-gray-900"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(getEmbedUrl(link.embed_id), link.id, 'url')}
                            data-testid={`button-copy-url-${link.id}`}
                          >
                            {copiedId === link.id && copiedType === 'url' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-gray-500">Iframe Code</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={getIframeCode(link.embed_id)}
                            readOnly
                            className="font-mono text-sm bg-gray-50 dark:bg-gray-900"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(getIframeCode(link.embed_id), link.id, 'iframe')}
                            data-testid={`button-copy-iframe-${link.id}`}
                          >
                            {copiedId === link.id && copiedType === 'iframe' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          ⚠️ Pass the actual JWT token from your authentication system in place of <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">YOUR_JWT_TOKEN</code>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
