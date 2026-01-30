import { useEffect, useState, createContext, useContext } from "react";
import { useParams } from "wouter";
import ChatPage from "./chat";

interface EmbedValidation {
  valid: boolean;
  role?: 'superadmin' | 'admin' | 'user';
  name?: string;
  error?: string;
}

interface EmbedContextType {
  isEmbed: boolean;
  embedId: string | null;
  role: 'superadmin' | 'admin' | 'user' | null;
  embedName: string | null;
  displayId: string | null;
  sessionId: string | null;
  jwtUsername: string | null;
  jwtTenant: string | null;
  onRecoverSession: (newDisplayId: string) => Promise<boolean>;
}

export const EmbedContext = createContext<EmbedContextType>({
  isEmbed: false,
  embedId: null,
  role: null,
  embedName: null,
  displayId: null,
  sessionId: null,
  jwtUsername: null,
  jwtTenant: null,
  onRecoverSession: async () => false,
});

export function useEmbedContext() {
  return useContext(EmbedContext);
}

export default function EmbedWithIdPage() {
  const params = useParams<{ embedId: string }>();
  const [validation, setValidation] = useState<EmbedValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jwtUsername, setJwtUsername] = useState<string | null>(null);
  const [jwtTenant, setJwtTenant] = useState<string | null>(null);
  // Initialize role from sessionStorage immediately to prevent stale context during navigation
  const [jwtRole, setJwtRole] = useState<'superadmin' | 'admin' | 'user'>(() => {
    const storedRole = sessionStorage.getItem('embedRole') as 'superadmin' | 'admin' | 'user' | null;
    console.log('[EmbedWithId] Initial role from sessionStorage:', storedRole);
    return storedRole || 'user';
  });
  
  // Extract JWT token from URL query parameter or sessionStorage
  const getJwtTokenFromUrl = (): string | null => {
    try {
      // First check URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token') || urlParams.get('jwt') || urlParams.get('auth');
      
      if (urlToken) {
        // Store in sessionStorage for subsequent requests (token is lost on navigation)
        sessionStorage.setItem('jwtToken', urlToken);
        console.log('[JWT] Token found in URL and stored in sessionStorage');
        return urlToken;
      }
      
      // Fallback to sessionStorage (for after navigation)
      const storedToken = sessionStorage.getItem('jwtToken');
      if (storedToken) {
        console.log('[JWT] Token retrieved from sessionStorage');
        return storedToken;
      }
      
      console.log('[JWT] No token found in URL or sessionStorage');
      return null;
    } catch {
      return null;
    }
  };

  // Recovery function to link current session to an old display ID
  const handleRecoverSession = async (newDisplayId: string): Promise<boolean> => {
    if (!params.embedId) return false;
    
    try {
      const token = sessionStorage.getItem('embedToken');
      if (!token) {
        console.error('No embed token available');
        return false;
      }
      
      const response = await fetch('/api/embed/recover', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Embed-Token': token,
        },
        credentials: 'include',
        body: JSON.stringify({
          displayId: newDisplayId.toLowerCase(),
          // Note: currentSessionId and embedId are derived server-side for security
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state with recovered display ID
        setDisplayId(newDisplayId.toLowerCase());
        // Store in localStorage for persistence
        localStorage.setItem(`embed_display_id_${params.embedId}`, newDisplayId.toLowerCase());
        // Reload to refresh chat history
        window.location.reload();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to recover session:', error);
      return false;
    }
  };

  // Hydrate displayId from localStorage on mount
  useEffect(() => {
    if (params.embedId) {
      const storedDisplayId = localStorage.getItem(`embed_display_id_${params.embedId}`);
      if (storedDisplayId) {
        setDisplayId(storedDisplayId);
      }
      // Role is now initialized directly from sessionStorage in useState
    }
  }, [params.embedId]);

  useEffect(() => {
    async function validateAndCreateSession() {
      if (!params.embedId) {
        setValidation({ valid: false, error: "No embed ID provided" });
        setLoading(false);
        return;
      }

      try {
        // Detect if we're in an iframe and get parent origin
        let parentOrigin = '';
        try {
          // Check if we're in an iframe
          if (window.self !== window.top) {
            // We're in an iframe - try to get parent origin via document.referrer
            // document.referrer contains the parent page URL when loaded in iframe
            if (document.referrer) {
              const refUrl = new URL(document.referrer);
              parentOrigin = refUrl.hostname;
            }
          }
        } catch (e) {
          // Cross-origin iframe, can't access parent
          // Use document.referrer as fallback
          if (document.referrer) {
            try {
              const refUrl = new URL(document.referrer);
              parentOrigin = refUrl.hostname;
            } catch {}
          }
        }

        // First validate the embed link - send parent origin for domain check
        const validateResponse = await fetch(`/api/embed/validate/${params.embedId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentOrigin }),
        });
        const validateData = await validateResponse.json();
        
        if (!validateData.valid) {
          setValidation(validateData);
          setLoading(false);
          return;
        }

        // CRITICAL: Detect if this is a NEW JWT token (different from stored one)
        // If so, clear all cached session data to prevent role mixing
        // Must check BEFORE getJwtTokenFromUrl() which stores the token
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token') || urlParams.get('jwt') || urlParams.get('auth');
        const storedJwtToken = sessionStorage.getItem('jwtToken');
        
        if (urlToken && storedJwtToken && urlToken !== storedJwtToken) {
          console.log('[EmbedSession] New JWT token detected - clearing old session data');
          sessionStorage.removeItem('embedToken');
          sessionStorage.removeItem('embedRole');
          sessionStorage.removeItem('currentEmbedId');
          localStorage.removeItem(`embed_display_id_${params.embedId}`);
        } else if (urlToken && !storedJwtToken) {
          // First time with this token - also clear old data
          console.log('[EmbedSession] First JWT token - clearing any old session data');
          sessionStorage.removeItem('embedToken');
          sessionStorage.removeItem('embedRole');
          sessionStorage.removeItem('currentEmbedId');
        }
        
        // Get JWT token from URL if provided by client (this will store it in sessionStorage)
        const jwtToken = getJwtTokenFromUrl();
        
        console.log('[EmbedSession] Creating session with:', {
          embedId: params.embedId,
          parentOrigin,
          hasJwtToken: !!jwtToken,
          jwtTokenLength: jwtToken?.length || 0,
        });
        
        // Create an embed session on the server for authentication
        const sessionResponse = await fetch(`/api/embed/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            embedId: params.embedId, 
            parentOrigin,
            jwtToken, // Send JWT token if available
          }),
        });
        const sessionData = await sessionResponse.json();
        
        console.log('[EmbedSession] Response:', {
          status: sessionResponse.status,
          success: sessionData.success,
          error: sessionData.error,
          clientRole: sessionData.clientRole,  // Original role from JWT
          mappedRole: sessionData.role,  // Mapped role (admin, user, superadmin)
          jwtRoleExtracted: sessionData.jwtRoleExtracted,
          displayId: sessionData.displayId,
        });
        
        // CRITICAL: Handle session creation failure (e.g., JWT expired)
        if (!sessionResponse.ok || sessionData.error) {
          // Clear all cached session data - don't allow access with stale data
          sessionStorage.removeItem('embedToken');
          sessionStorage.removeItem('embedRole');
          sessionStorage.removeItem('jwtToken');
          sessionStorage.removeItem('currentEmbedId');
          localStorage.removeItem(`embed_display_id_${params.embedId}`);
          
          const errorMsg = sessionData.error || sessionData.message || 'Session creation failed';
          console.log('[EmbedSession] Session creation failed, cleared cached data:', errorMsg);
          setValidation({ valid: false, error: errorMsg });
          setLoading(false);
          return; // Don't continue
        }
        
        // Store the embed token and embedId in sessionStorage for API calls (works without cookies)
        if (sessionData.token) {
          sessionStorage.setItem('embedToken', sessionData.token);
          sessionStorage.setItem('currentEmbedId', params.embedId!);
        }
        
        // Store session ID and display ID
        if (sessionData.sessionId) {
          setSessionId(sessionData.sessionId);
        }
        
        if (sessionData.displayId) {
          setDisplayId(sessionData.displayId);
          // Store in localStorage for persistence across refreshes
          localStorage.setItem(`embed_display_id_${params.embedId}`, sessionData.displayId);
        }
        
        // Store JWT-extracted user info if available
        if (sessionData.jwtUsername) {
          setJwtUsername(sessionData.jwtUsername);
        }
        if (sessionData.jwtTenant) {
          setJwtTenant(sessionData.jwtTenant);
        }
        
        // Store role from JWT (critical for admin/superadmin features)
        if (sessionData.role) {
          const role = sessionData.role as 'superadmin' | 'admin' | 'user';
          setJwtRole(role);
          sessionStorage.setItem('embedRole', role);
          console.log('[EmbedSession] Role from JWT:', role);
        }

        setValidation(validateData);
      } catch (error) {
        setValidation({ valid: false, error: "Failed to validate embed link" });
      } finally {
        setLoading(false);
      }
    }

    validateAndCreateSession();
  }, [params.embedId]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50" style={{ minHeight: '100vh', height: '100%' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Validating embed access...</p>
        </div>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50" style={{ minHeight: '100vh', height: '100%' }}>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{validation?.error || "This embed link is not valid or not authorized for this domain."}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const embedContext: EmbedContextType = {
    isEmbed: true,
    embedId: params.embedId || null,
    role: jwtRole,  // Use role from JWT, not from validation
    embedName: validation.name || null,
    displayId: displayId,
    sessionId: sessionId,
    jwtUsername: jwtUsername,
    jwtTenant: jwtTenant,
    onRecoverSession: handleRecoverSession,
  };

  console.log('[EmbedWithId] Context role:', jwtRole, 'validation.role:', validation.role);

  return (
    <EmbedContext.Provider value={embedContext}>
      <div className="h-screen w-full" data-embed-mode="true" data-embed-role={jwtRole} data-embed-id={params.embedId}>
        <ChatPage />
      </div>
    </EmbedContext.Provider>
  );
}
