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
}

export const EmbedContext = createContext<EmbedContextType>({
  isEmbed: false,
  embedId: null,
  role: null,
  embedName: null,
});

export function useEmbedContext() {
  return useContext(EmbedContext);
}

export default function EmbedWithIdPage() {
  const params = useParams<{ embedId: string }>();
  const [validation, setValidation] = useState<EmbedValidation | null>(null);
  const [loading, setLoading] = useState(true);

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

        // Create an embed session on the server for authentication
        const sessionResponse = await fetch(`/api/embed/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ embedId: params.embedId, parentOrigin }),
        });
        const sessionData = await sessionResponse.json();
        
        // Store the embed token in sessionStorage for API calls (works without cookies)
        if (sessionData.token) {
          sessionStorage.setItem('embedToken', sessionData.token);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Validating embed access...</p>
        </div>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
    role: validation.role || null,
    embedName: validation.name || null,
  };

  return (
    <EmbedContext.Provider value={embedContext}>
      <div className="h-screen w-full" data-embed-mode="true" data-embed-role={validation.role} data-embed-id={params.embedId}>
        <ChatPage />
      </div>
    </EmbedContext.Provider>
  );
}
