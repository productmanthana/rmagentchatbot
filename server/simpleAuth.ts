import session from "express-session";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { ADMIN_EMAIL } from "@shared/schema";
import { isAppMssqlConfigured, getAppPool } from "./mssql-app-db";
import { MssqlSessionStore } from "./mssql-session-store";
import { mssqlStorage } from "./mssql-storage";

// MS SQL is the only database
export function setUsingMssql(value: boolean) {
  // No-op - MS SQL is always used
}

export function getUsingMssql(): boolean {
  return true;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
  }
}

// Fixed user credentials from environment variables with fallback
const FIXED_USER_EMAIL = process.env.FIXED_USER_EMAIL || "porttest@rmone.com";
const FIXED_USER_PASSWORD = process.env.FIXED_USER_PASSWORD || "rmone@8723";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // MS SQL is required
  if (!isAppMssqlConfigured() || !getAppPool()) {
    throw new Error("APP_MSSQL_URL is required. MS SQL is the only supported database.");
  }
  
  console.log('📊 Using MS SQL session store');
  
  const sessionStore = new MssqlSessionStore({
    ttl: sessionTtl / 1000, // Convert to seconds
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "dev-session-secret-change-in-prod",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// Define all user accounts to seed
const USER_ACCOUNTS = [
  {
    id: "fixed-user-001",
    email: FIXED_USER_EMAIL,
    password: FIXED_USER_PASSWORD,
    firstName: "Port",
    lastName: "Test",
    role: "user",
  },
  {
    id: "fixed-user-002",
    email: "smurthy@rmone.com",
    password: "rmone@8723",
    firstName: "S",
    lastName: "Murthy",
    role: "superadmin",
  },
  {
    id: "fixed-user-003",
    email: "test@rmone.com",
    password: "rmone@8723",
    firstName: "Test",
    lastName: "User",
    role: "user",
  },
  {
    id: "fixed-user-004",
    email: "samarth@vyaasai.com",
    password: "interns123",
    firstName: "Samarth",
    lastName: "Vyaas",
    role: "superadmin",
  },
  {
    id: "fixed-user-005",
    email: "shivanimathad@vyaasai.com",
    password: "interns123",
    firstName: "Shivani",
    lastName: "Mathad",
    role: "superadmin",
  },
  {
    id: "admin-user-001",
    email: "drsampathkumarpatil@gmail.com",
    password: "idealabs123",
    firstName: "Dr. Sampath Kumar",
    lastName: "Patil",
    role: "superadmin",
  },
  {
    id: "superadmin-user-001",
    email: "superadmin@rmone.com",
    password: "super@8723",
    firstName: "Super",
    lastName: "Admin",
    role: "superadmin",
  },
  {
    id: "admin-user-002",
    email: "admin@rmone.com",
    password: "admin@159",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
  },
  {
    id: "user-001",
    email: "user@rmone.com",
    password: "user@357",
    firstName: "Regular",
    lastName: "User",
    role: "user",
  },
  {
    id: "superadmin-user-002",
    email: "super@rmone.com",
    password: "rmone@8723",
    firstName: "Super",
    lastName: "Admin",
    role: "superadmin",
  },
];

// Seed the fixed user accounts (MS SQL only)
async function seedFixedUser() {
  try {
    console.log("📊 Seeding users in MS SQL...");
    
    for (const userAccount of USER_ACCOUNTS) {
      const existingUser = await mssqlStorage.getUserByEmail(userAccount.email);
      
      if (existingUser) {
        if (existingUser.role !== userAccount.role) {
          await mssqlStorage.updateUserRole(userAccount.email, userAccount.role);
          console.log(`✅ User account ${userAccount.email} role updated to ${userAccount.role}`);
        } else {
          console.log(`✅ User account ${userAccount.email} already exists`);
        }
        continue;
      }
      
      const passwordHash = await bcrypt.hash(userAccount.password, 10);
      await mssqlStorage.createUser({
        id: userAccount.id,
        email: userAccount.email,
        passwordHash,
        firstName: userAccount.firstName,
        lastName: userAccount.lastName,
        role: userAccount.role,
      });
      
      console.log(`✅ User account ${userAccount.email} (role: ${userAccount.role}) created successfully`);
    }
  } catch (error) {
    console.error("Error seeding user accounts:", error);
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Seed the fixed user on server startup
  await seedFixedUser();

  // Login endpoint only - no registration
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user in MS SQL
      const user = await mssqlStorage.getUserByEmail(email.toLowerCase());

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed. Please try again." });
        }
        
        // Set user ID and email on new session
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Login failed. Please try again." });
          }
          
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        });
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if this is an embed session
      if ((req.session as any).isEmbed) {
        const embedId = (req.session as any).embedId;
        const embedRole = (req.session as any).embedRole || 'user';
        return res.json({
          id: `embed_${embedId}`,
          email: req.session.userEmail || `embed@domain`,
          firstName: 'Embed',
          lastName: 'User',
          role: embedRole,
          isEmbed: true,
        });
      }

      // Find user in MS SQL
      const user = await mssqlStorage.getUserById(req.session.userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Ensure userEmail is set on session for existing sessions
      if (!req.session.userEmail && user.email) {
        req.session.userEmail = user.email;
        req.session.save(() => {});  // Fire and forget
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || 'user',
      });
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Check if current user is admin
  app.get("/api/admin/check", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ isAdmin: false });
      }
      res.json({ isAdmin: isAdmin(req.session.userEmail) });
    } catch (error: any) {
      res.status(500).json({ isAdmin: false });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Helper to get user ID from session
export function getUserId(req: any): string | null {
  return req.session?.userId || null;
}

// Helper to get user email from session
export function getUserEmail(req: any): string | null {
  return req.session?.userEmail || null;
}

// Helper to get user role from database
export async function getUserRole(req: any): Promise<string> {
  const userEmail = req.session?.userEmail;
  if (!userEmail) return 'user';
  
  try {
    const user = await mssqlStorage.getUserByEmail(userEmail);
    return user?.role || 'user';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user';
  }
}

// Check if user is admin or superadmin
export function isAdmin(userEmail?: string): boolean {
  if (!userEmail) return false;
  return isSuperAdmin(userEmail) || isAdminRole(userEmail);
}

// Check if user is superadmin
export function isSuperAdmin(userEmail?: string): boolean {
  if (!userEmail) return false;
  const superAdminEmails = [
    'smurthy@rmone.com',
    'samarth@vyaasai.com',
    'shivanimathad@vyaasai.com',
    'drsampathkumarpatil@gmail.com',
    'superadmin@rmone.com',
    'super@rmone.com',
  ];
  return superAdminEmails.includes(userEmail.toLowerCase());
}

// Check if user has admin role
function isAdminRole(userEmail: string): boolean {
  const adminEmails = ['admin@rmone.com'];
  return adminEmails.includes(userEmail.toLowerCase());
}

// Get user by email
export async function getUserByEmail(email: string): Promise<any | null> {
  return mssqlStorage.getUserByEmail(email.toLowerCase());
}
