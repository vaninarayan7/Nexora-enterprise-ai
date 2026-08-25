import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Cpu, 
  Layers, 
  GitFork, 
  Terminal, 
  Lock, 
  FileCode, 
  Play, 
  BookOpen, 
  Check, 
  Copy, 
  Search, 
  ArrowRight, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Folder,
  File,
  AlertCircle
} from "lucide-react";

// ==========================================
// DB ENTITY DEFINITIONS
// ==========================================
interface DBColumn {
  name: string;
  type: string;
  constraints: string[];
  description: string;
}

interface DBIndex {
  name: string;
  columns: string[];
  type: string;
}

interface DBRelationship {
  column: string;
  references: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
}

interface DBTable {
  id: string;
  name: string;
  category: "auth" | "org" | "chat" | "docs" | "ai" | "meetings" | "system";
  description: string;
  columns: DBColumn[];
  indexes: DBIndex[];
  relationships: DBRelationship[];
}

const DB_TABLES: DBTable[] = [
  // AUTH
  {
    id: "auth_credentials",
    name: "auth_credentials",
    category: "auth",
    description: "Stores encrypted user passwords, authentication tokens, and federated login credentials.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"], description: "Unique credential identifier." },
      { name: "user_id", type: "UUID", constraints: ["UNIQUE", "NOT NULL"], description: "Foreign key linking to the primary users table." },
      { name: "password_hash", type: "VARCHAR(255)", constraints: ["NULLABLE"], description: "Bcrypt or Argon2 salted hash of the user password." },
      { name: "provider", type: "VARCHAR(50)", constraints: ["NOT NULL", "DEFAULT 'local'"], description: "Provider of auth (e.g. 'local', 'google', 'github')." },
      { name: "active", type: "BOOLEAN", constraints: ["NOT NULL", "DEFAULT TRUE"], description: "Indicates whether the account credential is active." },
      { name: "created_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Record insertion timestamp." }
    ],
    indexes: [
      { name: "idx_auth_user_id", columns: ["user_id"], type: "B-Tree" }
    ],
    relationships: [
      { column: "user_id", references: "users(id)", onDelete: "CASCADE" }
    ]
  },
  {
    id: "users",
    name: "users",
    category: "auth",
    description: "Core table containing system-wide user profile meta-records.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"], description: "Unique profile identifier." },
      { name: "email", type: "VARCHAR(120)", constraints: ["UNIQUE", "NOT NULL"], description: "Primary email address." },
      { name: "display_name", type: "VARCHAR(80)", constraints: ["NOT NULL"], description: "User's public display name." },
      { name: "photo_url", type: "VARCHAR(255)", constraints: ["NULLABLE"], description: "Optional avatar URL address." },
      { name: "role_id", type: "UUID", constraints: ["NOT NULL"], description: "Reference to the User Role ID." },
      { name: "department_id", type: "UUID", constraints: ["NULLABLE"], description: "Reference to the Department ID." },
      { name: "created_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Profile registration date." }
    ],
    indexes: [
      { name: "idx_users_email", columns: ["email"], type: "Hash" }
    ],
    relationships: [
      { column: "role_id", references: "roles(id)", onDelete: "RESTRICT" },
      { column: "department_id", references: "departments(id)", onDelete: "SET NULL" }
    ]
  },
  {
    id: "roles",
    name: "roles",
    category: "auth",
    description: "Contains Role definitions (e.g., Admin, HR, Employee, Guest) for granular authorization.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"], description: "Unique Role identifier." },
      { name: "name", type: "VARCHAR(50)", constraints: ["UNIQUE", "NOT NULL"], description: "Role identifier (e.g., 'Admin', 'HR', 'Employee')." },
      { name: "description", type: "VARCHAR(255)", constraints: ["NOT NULL"], description: "Explanatory scope of permissions." }
    ],
    indexes: [],
    relationships: []
  },
  {
    id: "permissions",
    name: "permissions",
    category: "auth",
    description: "Fleshes out granular permission keys to map permissions to API resources.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"], description: "Unique Permission ID." },
      { name: "name", type: "VARCHAR(80)", constraints: ["UNIQUE", "NOT NULL"], description: "Permission string (e.g. 'documents:upload')." },
      { name: "resource", type: "VARCHAR(50)", constraints: ["NOT NULL"], description: "Target resource context (e.g. 'documents')." },
      { name: "action", type: "VARCHAR(20)", constraints: ["NOT NULL"], description: "Action type (e.g., 'read', 'write', 'delete')." }
    ],
    indexes: [],
    relationships: []
  },

  // ORG / WORKSPACE
  {
    id: "departments",
    name: "departments",
    category: "org",
    description: "Company organizational departments containing users and teams.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique Department identifier." },
      { name: "name", type: "VARCHAR(100)", constraints: ["UNIQUE", "NOT NULL"], description: "Department name." },
      { name: "code", type: "VARCHAR(10)", constraints: ["UNIQUE", "NOT NULL"], description: "Operational shortcode (e.g. 'HR', 'ENG')." },
      { name: "lead_user_id", type: "UUID", constraints: ["NULLABLE"], description: "Reference to user managing the department." }
    ],
    indexes: [],
    relationships: [
      { column: "lead_user_id", references: "users(id)", onDelete: "SET NULL" }
    ]
  },
  {
    id: "workspaces",
    name: "workspaces",
    category: "org",
    description: "Core collaborative workspace container hosting projects, files, and chats.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY", "DEFAULT gen_random_uuid()"], description: "Unique workspace container ID." },
      { name: "name", type: "VARCHAR(100)", constraints: ["NOT NULL"], description: "Display name of the workspace." },
      { name: "description", type: "TEXT", constraints: ["NULLABLE"], description: "Context and objectives for the workspace." },
      { name: "owner_user_id", type: "UUID", constraints: ["NOT NULL"], description: "Fkey to the owner of this workspace." },
      { name: "max_capacity", type: "INTEGER", constraints: ["NOT NULL", "DEFAULT 100"], description: "Maximum workspace document capacity limit." }
    ],
    indexes: [],
    relationships: [
      { column: "owner_user_id", references: "users(id)", onDelete: "RESTRICT" }
    ]
  },
  {
    id: "workspace_members",
    name: "workspace_members",
    category: "org",
    description: "Many-to-many relationship mapping user roles within workspaces.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique record key." },
      { name: "workspace_id", type: "UUID", constraints: ["NOT NULL"], description: "Workspace container reference." },
      { name: "user_id", type: "UUID", constraints: ["NOT NULL"], description: "User record reference." },
      { name: "role", type: "VARCHAR(30)", constraints: ["NOT NULL", "DEFAULT 'Member'"], description: "Member-specific workspace role override." },
      { name: "joined_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Time of workspace entry." }
    ],
    indexes: [
      { name: "idx_ws_member_composite", columns: ["workspace_id", "user_id"], type: "B-Tree Unique" }
    ],
    relationships: [
      { column: "workspace_id", references: "workspaces(id)", onDelete: "CASCADE" },
      { column: "user_id", references: "users(id)", onDelete: "CASCADE" }
    ]
  },

  // CHAT & MESSAGES
  {
    id: "chats",
    name: "chats",
    category: "chat",
    description: "Represents active conversation sessions inside Nexora.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique conversation identifier." },
      { name: "workspace_id", type: "UUID", constraints: ["NOT NULL"], description: "Workspace boundary reference." },
      { name: "title", type: "VARCHAR(150)", constraints: ["NOT NULL", "DEFAULT 'New Session'"], description: "User-defined or AI-summarized session title." },
      { name: "user_id", type: "UUID", constraints: ["NOT NULL"], description: "Fkey identifying conversation creator." },
      { name: "memory_summary", type: "TEXT", constraints: ["NULLABLE"], description: "Rolling recursive text summary used as prompt context." },
      { name: "created_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Creation date." }
    ],
    indexes: [
      { name: "idx_chats_workspace", columns: ["workspace_id"], type: "B-Tree" }
    ],
    relationships: [
      { column: "workspace_id", references: "workspaces(id)", onDelete: "CASCADE" },
      { column: "user_id", references: "users(id)", onDelete: "CASCADE" }
    ]
  },
  {
    id: "chat_messages",
    name: "chat_messages",
    category: "chat",
    description: "Stores individual messages from users or AI systems, with metrics for logging and billing audit checks.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique message identifier." },
      { name: "chat_id", type: "UUID", constraints: ["NOT NULL"], description: "Foreign key back to primary chat session." },
      { name: "sender_id", type: "UUID", constraints: ["NULLABLE"], description: "Reference to users(id). Null if system/assistant generated." },
      { name: "content", type: "TEXT", constraints: ["NOT NULL"], description: "Active raw message body or prompt payload." },
      { name: "role", type: "VARCHAR(20)", constraints: ["NOT NULL"], description: "Role enum ('user', 'assistant', 'system')." },
      { name: "token_count", type: "INTEGER", constraints: ["NULLABLE"], description: "Calculated token count metrics for API analytics." },
      { name: "timestamp", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Exact date of message delivery." }
    ],
    indexes: [
      { name: "idx_msg_chat_time", columns: ["chat_id", "timestamp"], type: "B-Tree" }
    ],
    relationships: [
      { column: "chat_id", references: "chats(id)", onDelete: "CASCADE" },
      { column: "sender_id", references: "users(id)", onDelete: "SET NULL" }
    ]
  },
  {
    id: "chat_attachments",
    name: "chat_attachments",
    category: "chat",
    description: "Tracks physical files attached during live chat streams (PDFs, CSVs, logs).",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique attachment record key." },
      { name: "message_id", type: "UUID", constraints: ["NOT NULL"], description: "Parent message linking key." },
      { name: "file_name", type: "VARCHAR(255)", constraints: ["NOT NULL"], description: "Original string name of user upload." },
      { name: "s3_path", type: "VARCHAR(512)", constraints: ["NOT NULL"], description: "Secure object store directory locator path." },
      { name: "file_size", type: "BIGINT", constraints: ["NOT NULL"], description: "Physical size of document payload in bytes." },
      { name: "content_type", type: "VARCHAR(80)", constraints: ["NOT NULL"], description: "Mime-type schema (e.g. 'application/pdf')." }
    ],
    indexes: [],
    relationships: [
      { column: "message_id", references: "chat_messages(id)", onDelete: "CASCADE" }
    ]
  },

  // DOCUMENTS & EMBEDDINGS (RAG)
  {
    id: "documents",
    name: "documents",
    category: "docs",
    description: "Holds file metadata records submitted for Knowledge Base indexing.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique document record key." },
      { name: "name", type: "VARCHAR(255)", constraints: ["NOT NULL"], description: "Name of document source." },
      { name: "type", type: "VARCHAR(15)", constraints: ["NOT NULL"], description: "Shortcode filetype classification (PDF, MD, CSV, TXT)." },
      { name: "aws_path", type: "VARCHAR(512)", constraints: ["NOT NULL"], description: "Cloud Object Storage path location." },
      { name: "chunks_count", type: "INTEGER", constraints: ["NOT NULL", "DEFAULT 0"], description: "Number of token boundary slices processed." },
      { name: "status", type: "VARCHAR(20)", constraints: ["NOT NULL", "DEFAULT 'processing'"], description: "Current RAG pipeline state ('processing', 'indexed', 'error')." },
      { name: "workspace_id", type: "UUID", constraints: ["NOT NULL"], description: "Workspace bounding reference." },
      { name: "created_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Upload timestamp." }
    ],
    indexes: [
      { name: "idx_docs_workspace", columns: ["workspace_id"], type: "B-Tree" }
    ],
    relationships: [
      { column: "workspace_id", references: "workspaces(id)", onDelete: "CASCADE" }
    ]
  },
  {
    id: "embeddings",
    name: "embeddings",
    category: "docs",
    description: "Main vector table storing segmented raw text chunk strings alongside high-dimensional numeric embeddings.",
    columns: [
      { name: "id", type: "BIGSERIAL", constraints: ["PRIMARY KEY"], description: "High performance big-integer sequential key." },
      { name: "document_id", type: "UUID", constraints: ["NOT NULL"], description: "Parent document record reference." },
      { name: "chunk_index", type: "INTEGER", constraints: ["NOT NULL"], description: "Zero-based position of the chunk in original text flow." },
      { name: "content_text", type: "TEXT", constraints: ["NOT NULL"], description: "Actual text slice characters (chunk)." },
      { name: "vector_values", type: "VECTOR(768)", constraints: ["NOT NULL"], description: "Vector coordinates mapping to Gemini text-embedding-004 space." }
    ],
    indexes: [
      { name: "idx_embeddings_hnsw", columns: ["vector_values vector_cosine_ops"], type: "HNSW" },
      { name: "idx_embeddings_doc_id", columns: ["document_id"], type: "B-Tree" }
    ],
    relationships: [
      { column: "document_id", references: "documents(id)", onDelete: "CASCADE" }
    ]
  },
  {
    id: "vector_metadata",
    name: "vector_metadata",
    category: "docs",
    description: "Stores extra token metadata and overlap context indexes to support precise RAG prompt construction.",
    columns: [
      { name: "id", type: "BIGINT", constraints: ["PRIMARY KEY"], description: "Links 1-to-1 with primary embedding record." },
      { name: "chunk_latency_ms", type: "INTEGER", constraints: ["NULLABLE"], description: "Latency of extraction processor in ms." },
      { name: "tokens_count", type: "INTEGER", constraints: ["NOT NULL"], description: "Total token representation count in chunk." },
      { name: "overlap_context", type: "TEXT", constraints: ["NULLABLE"], description: "Text block of preceding and succeeding sentence strings." }
    ],
    indexes: [],
    relationships: [
      { column: "id", references: "embeddings(id)", onDelete: "CASCADE" }
    ]
  },

  // AI & PROMPT LIBRARY
  {
    id: "prompt_templates",
    name: "prompt_templates",
    category: "ai",
    description: "Enterprise catalog of tested system instruction templates and reusable chat frameworks.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique template UUID." },
      { name: "title", type: "VARCHAR(120)", constraints: ["NOT NULL"], description: "Marketing name of prompt." },
      { name: "prompt_schema", type: "TEXT", constraints: ["NOT NULL"], description: "Raw template text body with variables (e.g. {input})." },
      { name: "category", type: "VARCHAR(50)", constraints: ["NOT NULL"], description: "Functional classification (e.g. 'legal', 'finance')." },
      { name: "user_id", type: "UUID", constraints: ["NULLABLE"], description: "Author user identification. Null if system baseline." },
      { name: "created_at", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Creation date." }
    ],
    indexes: [],
    relationships: [
      { column: "user_id", references: "users(id)", onDelete: "SET NULL" }
    ]
  },
  {
    id: "ai_agents",
    name: "ai_agents",
    category: "ai",
    description: "Configured multi-agent team nodes that can be summoned into chats or tasks.",
    columns: [
      { name: "id", type: "UUID", constraints: ["PRIMARY KEY"], description: "Unique Agent identifier." },
      { name: "name", type: "VARCHAR(80)", constraints: ["UNIQUE", "NOT NULL"], description: "Name of the agent (e.g. 'RAG Expert')." },
      { name: "description", type: "VARCHAR(255)", constraints: ["NOT NULL"], description: "Target core capabilities description." },
      { name: "system_prompt", type: "TEXT", constraints: ["NOT NULL"], description: "Grounding behavioral persona prompt." },
      { name: "model_name", type: "VARCHAR(80)", constraints: ["NOT NULL", "DEFAULT 'gemini-3.6-flash'"], description: "Gemini architecture target." },
      { name: "temperature", type: "DECIMAL(3,2)", constraints: ["NOT NULL", "DEFAULT 0.20"], description: "Creativity coefficient configuration." }
    ],
    indexes: [],
    relationships: []
  },

  // SYSTEM LOGS & AUDIT
  {
    id: "activity_logs",
    name: "activity_logs",
    category: "system",
    description: "Detailed system records tracking general API mutations and logins for compliance reviews.",
    columns: [
      { name: "id", type: "BIGSERIAL", constraints: ["PRIMARY KEY"], description: "Sequential log primary key." },
      { name: "user_id", type: "UUID", constraints: ["NULLABLE"], description: "Action user ID. Null if anonymous or API Key system action." },
      { name: "action", type: "VARCHAR(100)", constraints: ["NOT NULL"], description: "Action description key (e.g. 'document:delete')." },
      { name: "target_id", type: "VARCHAR(64)", constraints: ["NULLABLE"], description: "Identifier of modified resource record." },
      { name: "ip_address", type: "VARCHAR(45)", constraints: ["NULLABLE"], description: "Requestor IP address (IPv4 or IPv6)." },
      { name: "timestamp", type: "TIMESTAMP", constraints: ["NOT NULL", "DEFAULT NOW()"], description: "Exact date of event occurrence." }
    ],
    indexes: [
      { name: "idx_activity_time", columns: ["timestamp"], type: "B-Tree" }
    ],
    relationships: [
      { column: "user_id", references: "users(id)", onDelete: "SET NULL" }
    ]
  },
  {
    id: "audit_logs",
    name: "audit_logs",
    category: "system",
    description: "Strict security-hardened state journal keeping historical snapshots of table mutations with verification check sums.",
    columns: [
      { name: "id", type: "BIGINT", constraints: ["PRIMARY KEY"], description: "Tied directly to the sibling activity_logs entry." },
      { name: "previous_state_json", type: "JSONB", constraints: ["NULLABLE"], description: "JSON state snapshot of data before query execution." },
      { name: "current_state_json", type: "JSONB", constraints: ["NULLABLE"], description: "JSON state snapshot of data after query execution." },
      { name: "hash_checksum", type: "VARCHAR(64)", constraints: ["NOT NULL"], description: "SHA256 checksum string for blockchain-like integrity validation." }
    ],
    indexes: [],
    relationships: [
      { column: "id", references: "activity_logs(id)", onDelete: "CASCADE" }
    ]
  }
];

// ==========================================
// BACKEND FILE TREE CONFIG
// ==========================================
interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
  codeKey?: string;
}

const BACKEND_TREE: FileNode[] = [
  {
    name: "nexora-backend",
    type: "directory",
    children: [
      {
        name: "app",
        type: "directory",
        children: [
          {
            name: "config",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "settings.py", type: "file", codeKey: "config_settings" }
            ]
          },
          {
            name: "routes",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "auth.py", type: "file", codeKey: "routes_auth" },
              { name: "chat.py", type: "file", codeKey: "routes_chat" },
              { name: "documents.py", type: "file" }
            ]
          },
          {
            name: "controllers",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "auth_controller.py", type: "file" },
              { name: "ai_controller.py", type: "file" }
            ]
          },
          {
            name: "services",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "rag_service.py", type: "file", codeKey: "services_rag" },
              { name: "gemini_client.py", type: "file", codeKey: "services_gemini" }
            ]
          },
          {
            name: "repositories",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "user_repository.py", type: "file" }
            ]
          },
          {
            name: "models",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "db_models.py", type: "file", codeKey: "models_db" }
            ]
          },
          {
            name: "schemas",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "pydantic_schemas.py", type: "file" }
            ]
          },
          {
            name: "middleware",
            type: "directory",
            children: [
              { name: "__init__.py", type: "file" },
              { name: "security.py", type: "file" }
            ]
          }
        ]
      },
      { name: "main.py", type: "file", codeKey: "main_py" },
      { name: "requirements.txt", type: "file", codeKey: "requirements" },
      { name: "Dockerfile", type: "file", codeKey: "dockerfile" }
    ]
  }
];

// Complete Backend Production Source Code Map
const BACKEND_CODE_MAP: Record<string, string> = {
  main_py: `"""
Nexora AI Workspace - Production FastAPI Entrypoint
Clean Architecture framework with CORS, Rate Limiters, Swagger docs, and router hooks.
"""
import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config.settings import settings
from app.routes import auth, chat, documents

app = FastAPI(
    title="Nexora Enterprise AI Core API",
    description="Backend microservices platform powered by Gemini, PgVector, and Redis.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Enable CORS boundaries
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_and_audit(request: Request, call_next):
    """Provides high performance telemetry logs for auditing process latency."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Latency-Sec"] = f"{process_time:.4f}"
    return response

# Register API Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["AI Chat Workspace"])
app.include_router(documents.router, prefix="/api/v1/docs", tags=["RAG Document System"])

@app.get("/api/v1/health", tags=["System Utility"])
async def system_health_status():
    """Liveness check metric dispatched to Cloud Run ingress layers."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "database": "connected",
        "redis_cache": "online",
        "gemini_api": "authenticated"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=settings.DEBUG)`,

  config_settings: `"""
Nexora Configuration Settings - Pydantic BaseSettings Node
"""
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexora AI Workspace"
    DEBUG: bool = False
    
    # Database Configurations
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/nexora_db"
    
    # Redis Cache Configurations
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security Configurations
    JWT_SECRET_KEY: str = "super_secret_crypto_hash_key_needs_override"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 Hours
    
    # Google GenAI Secret Core
    GEMINI_API_KEY: str
    
    # CORS Boundaries
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://ais-pre-c6rtre2egk3vgz3bqhpsfv-457822218151.asia-east1.run.app"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()`,

  services_rag: `"""
RAG Service Core - Document Parsing, Custom Slicing, and Vector Processing
"""
from typing import List, Dict, Any
import numpy as np
from app.services.gemini_client import gemini_client
from app.config.settings import settings

class RAGService:
    def __init__(self, db_session):
        self.db = db_session

    def chunk_document_markdown(self, text: str, max_tokens: int = 512, overlap: int = 64) -> List[str]:
        """Slices incoming document strings precisely along clean token boundaries."""
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + max_tokens])
            chunks.append(chunk)
            i += (max_tokens - overlap)
        return chunks

    async def generate_vector_index(self, doc_id: str, file_content: str) -> int:
        """Processes documents, slice content, extracts embeddings and persists to pgvector database."""
        chunks = self.chunk_document_markdown(file_content)
        
        for idx, text_block in enumerate(chunks):
            # API embedding extraction
            vector = await gemini_client.get_embedding(text_block)
            
            # Persist raw context alongside pgvector indices
            query = """
                INSERT INTO embeddings (document_id, chunk_index, content_text, vector_values)
                VALUES (:doc_id, :idx, :text, :vector)
            """
            self.db.execute(query, {
                "doc_id": doc_id,
                "idx": idx,
                "text": text_block,
                "vector": vector
            })
            
        self.db.commit()
        return len(chunks)

    async def semantic_search(self, query: str, workspace_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Executes a high-efficiency cosine distance vector search inside the active pgvector bounds."""
        query_vector = await gemini_client.get_embedding(query)
        
        # pgvector SQL executing cosine distance ordering <=>
        sql = """
            SELECT e.content_text, d.name as doc_name, e.chunk_index,
                   (e.vector_values <=> :q_vec) as distance
            FROM embeddings e
            JOIN documents d ON e.document_id = d.id
            WHERE d.workspace_id = :ws_id AND d.status = 'indexed'
            ORDER BY distance ASC
            LIMIT :lim
        """
        result = self.db.execute(sql, {
            "q_vec": str(query_vector),
            "ws_id": workspace_id,
            "lim": limit
        }).fetchall()
        
        return [
            {
                "text": row["content_text"],
                "source": row["doc_name"],
                "index": row["chunk_index"],
                "confidence": round(1 - float(row["distance"]), 4)
            }
            for row in result
        ]`,

  services_gemini: `"""
Google GenAI Service Client - Wrapper supporting Text generation and Embedding indexing
"""
from google import genai
from google.genai import types
from app.config.settings import settings

class GeminiClient:
    def __init__(self):
        # Initializing clean production Client following official developer SDK instructions
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.chat_model = "gemini-3.6-flash"
        self.embedding_model = "text-embedding-004"

    async def get_embedding(self, text: str) -> list[float]:
        """Fetches a highly precise 768-dimensional float embedding array representing context."""
        response = self.client.models.embed_content(
            model=self.embedding_model,
            contents=text
        )
        return response.embeddings[0].values

    async def generate_rag_response(self, user_prompt: str, retrieved_context: str) -> str:
        """Fuses retrieved vectors into Gemini system prompt for grounded responses with citations."""
        system_instruction = (
            "You are an expert AI core assistant for Nexora Enterprise Workspace. "
            "Formulate a precise, factual response strictly leveraging the Grounding Context provided below. "
            "If the grounding context is insufficient, state that clearly rather than hallucinating or speculating.\\n\\n"
            f"--- GROUNDING CONTEXT ---\\n{retrieved_context}"
        )
        
        response = self.client.models.generate_content(
            model=self.chat_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.15,
                max_output_tokens=1024
            )
        )
        return response.text

gemini_client = GeminiClient()`,

  models_db: `"""
SQLAlchemy ORM Data Model Schemas
Provides complete column, data type, primary keys, and cascade boundaries mapping exactly to ERD.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Numeric, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(120), unique=True, nullable=False, index=True)
    display_name = Column(String(80), nullable=False)
    photo_url = Column(String(255), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey('roles.id', ondelete='RESTRICT'), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey('departments.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Active Relationships
    role = relationship("Role", back_populates="users")
    credentials = relationship("AuthCredential", back_populates="user", uselist=False, cascade="all, delete-orphan")

class AuthCredential(Base):
    __tablename__ = 'auth_credentials'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    provider = Column(String(50), nullable=False, default='local')
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="credentials")

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(String(15), nullable=False)
    aws_path = Column(String(512), nullable=False)
    chunks_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default='processing')
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")`,

  routes_auth: `"""
FastAPI Authentication Routers - Endpoints mapping security workflows, JWT validation, and RBAC checks
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from app.controllers import auth_controller

router = APIRouter()

class UserRegisterSchema(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role_id: str

class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_role: str

@router.post("/register", response_model=TokenResponseSchema, status_code=status.HTTP_201_CREATED)
async def register_new_account(payload: UserRegisterSchema):
    """Sign up and formulate a secure default workspace container."""
    token = await auth_controller.register_user_and_seed_defaults(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
        role_id=payload.role_id
    )
    return token

@router.post("/login", response_model=TokenResponseSchema)
async def login_obtain_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate email and password to return an encrypted JWT access token."""
    token = await auth_controller.authenticate_and_sign_jwt(
        email=form_data.username,
        password=form_data.password
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username email or password credentials supplied.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token`,

  routes_chat: `"""
FastAPI Chat Router - Manages vector searches, rolling summaries, and Gemini generation
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.services.rag_service import RAGService
from app.services.gemini_client import gemini_client

router = APIRouter()

class PromptRequest(BaseModel):
    chat_id: str
    workspace_id: str
    prompt: str

class ChatResponse(BaseModel):
    response: str
    citations: list

@router.post("/query", response_model=ChatResponse)
async def dispatch_grounded_rag_query(payload: PromptRequest, rag_service: RAGService = Depends()):
    """Executes semantic cosine searches in pgvector, feeds results to Gemini, logs and returns text."""
    try:
        # 1. Pull relevant citations vector matching
        citations = await rag_service.semantic_search(
            query=payload.prompt,
            workspace_id=payload.workspace_id,
            limit=3
        )
        
        # 2. Fuse findings into clean text
        context_block = "\\n\\n".join([f"Source: {c['source']}\\n{c['text']}" for c in citations])
        
        # 3. Call Gemini Generation
        reply = await gemini_client.generate_rag_response(
            user_prompt=payload.prompt,
            retrieved_context=context_block
        )
        
        return ChatResponse(response=reply, citations=citations)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile AI RAG response: {str(e)}"
        )`,

  requirements: `fastapi>=0.110.0
uvicorn>=0.28.0
sqlalchemy[asyncio]>=2.0.28
asyncpg>=0.29.0
pydantic-settings>=2.2.1
google-genai>=0.1.1
numpy>=1.26.4
redis>=5.0.3
passlib[bcrypt]>=1.7.4
python-jose[cryptography]>=3.3.0
python-multipart>=0.0.9`,

  dockerfile: `# Base Production Layer
FROM python:3.11-slim as base

WORKDIR /app

# Install system utilities & pg_config headers
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ingress bindings
EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]`
};

// ==========================================
// SQL SCHEMA GENERATOR
// ==========================================
const SQL_DDL_SCHEMA = `-- ==========================================
-- Nexora Enterprise AI Workspace - Production SQL Schema
-- Target DB: PostgreSQL (>= 15.0) with pgvector extension enabled.
-- All Primary Keys use robust non-predictable UUID algorithms.
-- Foreign keys enforce strict referential constraints and cascade deletions.
-- ==========================================

-- Enable Vector and Cryptography extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Crucial for text embedding matches

-- 1. AUTHENTICATION & ACCESS CONTROL

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    lead_user_id UUID
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(120) UNIQUE NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    photo_url VARCHAR(255),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Complete Departments referencing back to Lead User securely
ALTER TABLE departments ADD CONSTRAINT fk_departments_lead_user FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE auth_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255),
    provider VARCHAR(50) NOT NULL DEFAULT 'local',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(80) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);


-- 2. COLLABORATION CONTAINERS & PROJECTS

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    max_capacity INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'Member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    budget NUMERIC(15, 2),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'planning' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- 3. CHAT ENGINE, COMPRESSION & CITATIONS

CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL DEFAULT 'New Session',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    token_count INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE chat_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    s3_path VARCHAR(512) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(80) NOT NULL
);

CREATE TABLE conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID UNIQUE NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    summary_chunk TEXT NOT NULL,
    last_message_token INTEGER,
    active_node VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- 4. DOCUMENTS & KNOWLEDGE VECTOR STORES

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(15) NOT NULL, -- PDF, MD, CSV, etc.
    aws_path VARCHAR(512) NOT NULL,
    chunks_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    edited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE document_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL
);

-- Main pgvector multi-dimensional embedding persistence
CREATE TABLE embeddings (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content_text TEXT NOT NULL,
    vector_values VECTOR(768) NOT NULL -- standard Gemini output sizing
);

CREATE TABLE vector_metadata (
    id BIGINT PRIMARY KEY REFERENCES embeddings(id) ON DELETE CASCADE,
    chunk_latency_ms INTEGER,
    tokens_count INTEGER NOT NULL,
    overlap_context TEXT
);


-- 5. AGENTS, MEETINGS & TASKS WORKSPACE

CREATE TABLE prompt_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(120) NOT NULL,
    prompt_schema TEXT NOT NULL,
    category_id UUID REFERENCES prompt_categories(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(80) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE ai_agent_configurations (
    id UUID PRIMARY KEY REFERENCES ai_agents(id) ON DELETE CASCADE,
    temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.20,
    model_name VARCHAR(80) NOT NULL DEFAULT 'gemini-3.6-flash',
    system_prompt TEXT NOT NULL,
    max_tokens INTEGER DEFAULT 2048 NOT NULL
);

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    meeting_date DATE NOT NULL,
    duration_mins INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE meeting_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID UNIQUE NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    transcript_text TEXT,
    summary_text TEXT,
    agenda TEXT
);

CREATE TABLE meeting_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(25) NOT NULL DEFAULT 'todo', -- 'todo', 'progress', 'review', 'completed'
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    due_date DATE
);

CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- 6. SYSTEM COMPLIANCE, NOTIFICATIONS & AUDIT

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'info' NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(64),
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY REFERENCES activity_logs(id) ON DELETE CASCADE,
    previous_state_json JSONB,
    current_state_json JSONB,
    hash_checksum VARCHAR(64) NOT NULL -- Cryptographic SHA256 checks
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    expiry TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' NOT NULL
);


-- ==========================================
-- EFFICIENT QUERY OPTIMIZATION INDEXES
-- ==========================================

CREATE INDEX idx_users_email_hash ON users USING hash (email);
CREATE INDEX idx_workspace_members_ws ON workspace_members(workspace_id);
CREATE INDEX idx_chat_messages_composite ON chat_messages(chat_id, timestamp);
CREATE INDEX idx_activity_logs_time ON activity_logs(timestamp);
CREATE INDEX idx_tasks_ws_status ON tasks(workspace_id, status);

-- HNSW Vector Distance match acceleration
CREATE INDEX idx_embeddings_vector_cosine ON embeddings USING hnsw (vector_values vector_cosine_ops);
`;

export default function ArchitectureCenter() {
  const [activeTab, setActiveTab] = useState<"erd" | "backend" | "rag" | "api" | "security">("erd");

  // State for ERD Table details
  const [selectedTable, setSelectedTable] = useState<string>("embeddings");
  const [dbSearch, setDbSearch] = useState("");
  const [dbCategory, setDbCategory] = useState<string>("all");

  // State for Backend Folder tree
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({
    "nexora-backend": true,
    "app": true,
    "config": true,
    "routes": true,
    "services": true,
    "models": true
  });
  const [selectedFileCode, setSelectedFileCode] = useState<string>("services_rag");
  const [copiedCode, setCopiedCode] = useState(false);

  // State for RAG pipeline simulation stage
  const [ragStage, setRagStage] = useState<number>(0);
  const [simulatedQuery, setSimulatedQuery] = useState("Show me Sophia's SaaS retention vectors stats.");
  const [isRAGSimulating, setIsRAGSimulating] = useState(false);

  // State for API Playground testing
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("POST /chat/query");
  const [apiRequestBody, setApiRequestBody] = useState<string>(
    JSON.stringify({
      chat_id: "c-101",
      workspace_id: "w-202",
      prompt: "Extract key deadlines from the indexed HIPAA document"
    }, null, 2)
  );
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Filter tables
  const filteredTables = DB_TABLES.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(dbSearch.toLowerCase()) || 
                          t.description.toLowerCase().includes(dbSearch.toLowerCase());
    const matchesCategory = dbCategory === "all" || t.category === dbCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleDirectory = (dirName: string) => {
    setOpenDirs(prev => ({ ...prev, [dirName]: !prev[dirName] }));
  };

  // Backend Node Tree Render Helper
  const renderTree = (nodes: FileNode[], pathPrefix: string = "") => {
    return (
      <div className="space-y-1.5 pl-3.5 border-l border-slate-200/50 dark:border-slate-800/40">
        {nodes.map((node) => {
          const currentPath = `${pathPrefix}/${node.name}`;
          const isDir = node.type === "directory";
          const isOpen = openDirs[node.name];
          const isSelected = selectedFileCode === node.codeKey;

          return (
            <div key={node.name} className="text-left">
              {isDir ? (
                <div>
                  <button
                    onClick={() => toggleDirectory(node.name)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-500 py-0.5 cursor-pointer"
                  >
                    <span className="text-slate-400">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <Folder className={`w-4 h-4 ${isOpen ? "text-indigo-500" : "text-slate-400"}`} />
                    <span>{node.name}/</span>
                  </button>
                  {isOpen && node.children && (
                    <div className="mt-1">
                      {renderTree(node.children, currentPath)}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => node.codeKey && setSelectedFileCode(node.codeKey)}
                  className={`flex items-center gap-1.5 text-xs py-0.5 w-full hover:text-indigo-500 cursor-pointer ${
                    isSelected 
                      ? "text-indigo-500 font-extrabold" 
                      : "text-slate-500 dark:text-slate-400 font-medium"
                  }`}
                >
                  <File className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-500" : "text-slate-400"}`} />
                  <span>{node.name}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Run RAG pipeline step simulation
  const simulateRAGFlow = () => {
    setIsRAGSimulating(true);
    setRagStage(0);
    const intervals = [1000, 2200, 3400, 4600, 5800, 7000];
    
    intervals.forEach((delay, idx) => {
      setTimeout(() => {
        setRagStage(idx);
        if (idx === intervals.length - 1) {
          setIsRAGSimulating(false);
        }
      }, delay);
    });
  };

  // Run API Playground requests
  const runApiTest = () => {
    setApiLoading(true);
    setApiResponse(null);

    setTimeout(() => {
      let responseMock: any = {};
      try {
        const parsed = JSON.parse(apiRequestBody);
        if (selectedEndpoint === "POST /auth/login") {
          responseMock = {
            access_token: "jwt_eyE3NjIuOTg1LjkzNiwiYWNjdXMta2V5I...",
            token_type: "bearer",
            user_role: "Admin",
            expires_in_sec: 86400,
            workspace_id: "w-202"
          };
        } else if (selectedEndpoint === "POST /docs/upload") {
          responseMock = {
            document_id: "doc-" + Math.floor(Math.random() * 90000 + 10000),
            name: parsed.name || "indexed_saas_metrics.pdf",
            status: "indexed",
            total_chunks: 14,
            embedding_latency_ms: 182,
            indexed_vectors_dim: 768
          };
        } else if (selectedEndpoint === "POST /ai/summarize") {
          responseMock = {
            summary_id: "sum-" + Math.floor(Math.random() * 10000),
            source_document: "saas_retention_v2.md",
            executive_summary: "SaaS index retention vectors are aligned inside standard token buckets. Development tests report exceptional 1.2ms latency boundaries on cloud runs.",
            extracted_keywords: ["saas", "retention", "vector distance", "pgvector"]
          };
        } else {
          // POST /chat/query
          responseMock = {
            response: "According to indexed document records for SaaS Retention v2, Sophia Carter chunked SaaS vectors to 512-token boundaries, achieving an average recall confidence threshold of 98.7% and extremely reliable response timings under 1.2ms.",
            grounding_score: "99.12%",
            token_overhead: {
              prompt_tokens: 310,
              completion_tokens: 84,
              context_chunks_used: 3
            },
            citations: [
              {
                doc_name: "saas_retention_v2.md",
                chunk_index: 3,
                text: "Sophia Carter confirmed SaaS retention vectors are fully indexed at 512-token chunk boundaries with 1.2ms match latency.",
                score: 0.9875
              }
            ]
          };
        }
        setApiResponse(responseMock);
      } catch (err) {
        setApiResponse({ error: "Invalid JSON Schema body payload. Please verify.", details: String(err) });
      }
      setApiLoading(false);
    }, 1200);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "auth": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "org": return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "chat": return "bg-teal-500/10 text-teal-500 border border-teal-500/20";
      case "docs": return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
      case "ai": return "bg-pink-500/10 text-pink-500 border border-pink-500/20";
      case "system": return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
    }
  };

  const activeTableData = DB_TABLES.find(t => t.id === selectedTable) || DB_TABLES[0];

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#F8FAFC] dark:bg-[#0B0D13] p-4 md:p-6 lg:overflow-hidden overflow-y-auto text-left">
      
      {/* Tab Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0 border-b border-slate-200/50 dark:border-slate-800/40 pb-4">
        <div>
          <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest font-mono">Senior Developer Console</span>
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider -mt-1">System Architecture Workspace</h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          {[
            { id: "erd", label: "ERD & Database Schema", icon: Database },
            { id: "backend", label: "Clean Backend (FastAPI)", icon: Cpu },
            { id: "rag", label: "RAG Pipeline Engine", icon: GitFork },
            { id: "api", label: "Interactive API Swagger", icon: Terminal },
            { id: "security", label: "Security & Best Practices", icon: Lock }
          ].map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isTabActive
                    ? "bg-white dark:bg-[#111318] text-indigo-500 shadow-sm border border-slate-200/30 dark:border-slate-800/50"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 lg:min-h-0 lg:overflow-hidden relative">
        <AnimatePresence>
          
          {/* =======================================================
              1. DATABASE SCHEMA & ERD EXPLORER
              ======================================================= */}
          {activeTab === "erd" && (
            <motion.div
              key="erd"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-auto lg:h-full flex flex-col lg:flex-row gap-6 min-h-0"
            >
              {/* Left Column: Table Navigation & Filter */}
              <div className="w-full lg:w-76 flex flex-col shrink-0 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4.5 min-h-0">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Relational Tables ({filteredTables.length})</span>
                
                {/* Search table */}
                <div className="relative mb-3 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    placeholder="Search entities schema..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500 text-slate-850 dark:text-slate-100"
                  />
                </div>

                {/* Category select */}
                <div className="grid grid-cols-2 gap-1.5 mb-4 shrink-0">
                  {[
                    { id: "all", label: "All Layers" },
                    { id: "auth", label: "Auth Keys" },
                    { id: "org", label: "Workspace" },
                    { id: "chat", label: "Chats" },
                    { id: "docs", label: "pgvector" },
                    { id: "ai", label: "Agents" },
                    { id: "system", label: "Audit Logs" }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setDbCategory(cat.id)}
                      className={`py-1 px-1.5 rounded-lg text-[9px] font-bold uppercase border text-center cursor-pointer transition-colors ${
                        dbCategory === cat.id
                          ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                          : "border-slate-200/60 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Tables List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
                  {filteredTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTable(t.id)}
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-colors ${
                        selectedTable === t.id
                          ? "border-indigo-500 bg-indigo-500/[0.02] text-slate-800 dark:text-white"
                          : "border-slate-100 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-100/50 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-black uppercase tracking-tight block truncate">{t.name}</span>
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-mono mt-0.5 block truncate">
                          Cols: {t.columns.length} | Rel: {t.relationships.length}
                        </span>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0 ${getCategoryColor(t.category)}`}>
                        {t.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Schema Explorer & Details */}
              <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                {/* Active Table Details */}
                <div className="flex-1 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4.5 flex flex-col min-h-0 overflow-y-auto">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-tight">{activeTableData.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${getCategoryColor(activeTableData.category)}`}>
                          {activeTableData.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-1">
                        {activeTableData.description}
                      </p>
                    </div>
                  </div>

                  {/* Schema column table */}
                  <div className="mb-6">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2.5">Normalized Entity Schema</span>
                    <div className="border border-slate-100 dark:border-slate-850 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-850">
                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Column Name</th>
                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Data Type</th>
                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Attributes & Constraints</th>
                            <th className="p-2 text-[9px] font-black uppercase text-slate-400">Logical Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {activeTableData.columns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="p-2 text-[10px] font-bold text-slate-800 dark:text-slate-100 font-mono">{col.name}</td>
                              <td className="p-2 text-[9px] font-black text-indigo-500 font-mono uppercase">{col.type}</td>
                              <td className="p-2">
                                <div className="flex flex-wrap gap-1">
                                  {col.constraints.map((c, i) => (
                                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-md font-mono font-bold uppercase bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2 text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">{col.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Indexes & Foreign Keys row split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Foreign Keys */}
                    <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-950/10">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Foreign Keys & Cascades</span>
                      {activeTableData.relationships.length > 0 ? (
                        <div className="space-y-2">
                          {activeTableData.relationships.map((rel, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white dark:bg-[#111318] border border-slate-100 dark:border-slate-850 text-[10px] font-medium flex items-center justify-between">
                              <div>
                                <span className="font-mono text-slate-850 dark:text-slate-100 font-bold">{rel.column}</span>
                                <span className="text-slate-400 mx-1.5">references</span>
                                <span className="font-mono text-indigo-500 font-black uppercase">{rel.references}</span>
                              </div>
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                ON DELETE {rel.onDelete}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-slate-400 uppercase mt-2 block">No Foreign Keys defined.</span>
                      )}
                    </div>

                    {/* Indexes */}
                    <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-950/10">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Database Index Structures</span>
                      {activeTableData.indexes.length > 0 ? (
                        <div className="space-y-2">
                          {activeTableData.indexes.map((idxVal, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white dark:bg-[#111318] border border-slate-100 dark:border-slate-850 text-[10px] font-medium flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{idxVal.name}</span>
                                <span className="text-slate-400 block text-[8px] font-mono mt-0.5">Cols: {idxVal.columns.join(", ")}</span>
                              </div>
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold bg-teal-500/10 text-teal-500 border border-teal-500/20 uppercase">
                                {idxVal.type} index
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-slate-400 uppercase mt-2 block">No Custom Indexes required (PK Index Default).</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Database DDL Raw SQL Output */}
                <div className="w-full md:w-80 rounded-2xl bg-slate-950 text-slate-200 border border-slate-850 p-4.5 flex flex-col min-h-0">
                  <div className="flex items-center justify-between shrink-0 mb-3 border-b border-slate-850 pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PostgreSQL DDL Dumps</span>
                    <button
                      onClick={() => handleCopyCode(SQL_DDL_SCHEMA)}
                      className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? "Copied!" : "Copy SQL"}</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-3 font-mono text-[9px] leading-relaxed text-slate-300">
                    <pre className="whitespace-pre">{SQL_DDL_SCHEMA}</pre>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* =======================================================
              2. BACKEND CLEAN ARCHITECTURE FILE EXPLORER
              ======================================================= */}
          {activeTab === "backend" && (
            <motion.div
              key="backend"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-auto lg:h-full flex flex-col lg:flex-row gap-6 min-h-0"
            >
              {/* Left Column: Clean Architecture Directory Tree */}
              <div className="w-full lg:w-76 flex flex-col shrink-0 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4.5 min-h-0 overflow-y-auto">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">FastAPI Project Folder Tree</span>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-4 leading-normal">
                  Click on key highlighted files to render actual production backend modules
                </p>

                {/* Core Tree Node Root */}
                <div className="space-y-1">
                  {renderTree(BACKEND_TREE)}
                </div>
              </div>

              {/* Right Column: Code Viewer */}
              <div className="flex-1 rounded-2xl bg-slate-950 text-slate-100 border border-slate-850 flex flex-col min-h-0">
                <div className="flex items-center justify-between p-4 border-b border-slate-850 shrink-0 bg-slate-950">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-mono font-bold text-slate-300">
                      nexora-backend/{selectedFileCode.replace("_", "/").replace("config/", "app/config/").replace("services/", "app/services/").replace("routes/", "app/routes/").replace("models/", "app/models/")}.py
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(BACKEND_CODE_MAP[selectedFileCode])}
                    className="py-1 px-3.5 rounded-xl border border-slate-850 hover:bg-slate-900 text-[10px] font-black uppercase text-slate-400 hover:text-white cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-indigo-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? "Copied Code" : "Copy Class File"}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-slate-900 p-5 font-mono text-[10px] leading-relaxed text-slate-300 text-left select-text">
                  <pre className="whitespace-pre">{BACKEND_CODE_MAP[selectedFileCode] || "# File placeholder"}</pre>
                </div>
              </div>
            </motion.div>
          )}

          {/* =======================================================
              3. INTERACTIVE RAG PIPELINE VISUALIZER
              ======================================================= */}
          {activeTab === "rag" && (
            <motion.div
              key="rag"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-auto lg:h-full flex flex-col lg:flex-row gap-6 min-h-0 text-left"
            >
              {/* Left Column: Interactive Stages */}
              <div className="w-full md:w-96 flex flex-col rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4.5 min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest block font-mono">Dynamic AI Sandbox</span>
                    <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider -mt-1">RAG Context Fetcher</h3>
                  </div>
                  <button
                    onClick={simulateRAGFlow}
                    disabled={isRAGSimulating}
                    className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black hover:opacity-90 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    {isRAGSimulating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Simulator text query input */}
                <div className="mb-6">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">User Prompt Query</label>
                  <input
                    type="text"
                    value={simulatedQuery}
                    onChange={(e) => setSimulatedQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-850 dark:text-slate-100 font-medium"
                    placeholder="Ask vector database queries..."
                  />
                </div>

                {/* Pipeline Timeline Stages */}
                <div className="flex-1 space-y-4">
                  {[
                    { id: 0, title: "1. Document Upload & Parse", desc: "User triggers PDF upload. Content is ingested, scanned via OCR node, and raw text is extracted.", codeSnippet: "file_text = parser.extract(file)" },
                    { id: 1, title: "2. Document Slicing / Chunking", desc: "Markdown text blocks split precisely along 512-token boundaries with 64-token sliding overlap context buffers.", codeSnippet: "chunks = rag_service.chunk_document_markdown(file_text)" },
                    { id: 2, title: "3. Vector Embedding Generation", desc: "Every unique chunk is sent to Gemini's text-embedding-004 endpoint, returning high-dimensional 768 float values.", codeSnippet: "vector = await gemini_client.get_embedding(chunk_text)" },
                    { id: 3, title: "4. Store pgvector Index", desc: "Embeddings, content chunks, and metadata (latency, word count) are committed to Postgres with active HNSW indexes.", codeSnippet: "INSERT INTO embeddings (vector_values, content) VALUES (...)" },
                    { id: 4, title: "5. Semantic Search Distance Query", desc: "User prompt query is vector mapped. SQL cosine distance (<=>) executes within workspace database boundaries.", codeSnippet: "SELECT content FROM embeddings ORDER BY vector_values <=> :q_vec" },
                    { id: 5, title: "6. Gemini Generation with Grounded Context", desc: "Retrieved citation text is fused into system instructions. Gemini structures responses with exact grounded source citations.", codeSnippet: "response = client.generate(prompt, system_instruction=context)" }
                  ].map((stage) => {
                    const isActive = ragStage === stage.id;
                    const isCompleted = ragStage > stage.id;

                    return (
                      <div 
                        key={stage.id} 
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isActive 
                            ? "border-indigo-500 bg-indigo-500/[0.02]" 
                            : isCompleted 
                              ? "border-emerald-500/10 bg-emerald-500/[0.01]" 
                              : "border-slate-100 dark:border-slate-850"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black font-mono ${
                            isActive 
                              ? "bg-indigo-500 text-white" 
                              : isCompleted 
                                ? "bg-emerald-500 text-white" 
                                : "bg-slate-100 dark:bg-slate-850 text-slate-400"
                          }`}>
                            {isCompleted ? "✓" : stage.id + 1}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-tight ${
                            isActive ? "text-indigo-500" : isCompleted ? "text-emerald-500" : "text-slate-800 dark:text-slate-200"
                          }`}>
                            {stage.title}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-normal mb-2 pl-6">
                          {stage.desc}
                        </p>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-1.5 border border-slate-200/30 dark:border-slate-850 text-[8px] font-mono pl-6 text-slate-500 dark:text-indigo-400">
                          {stage.codeSnippet}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Console Outputs */}
              <div className="flex-1 rounded-2xl bg-slate-950 text-slate-100 border border-slate-850 p-4.5 flex flex-col min-h-0 justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">RAG Pipeline Live Sandbox Output</span>
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-4 leading-normal">
                    Observe active backend logs as user prompt resolves semantic boundaries
                  </p>

                  <div className="space-y-4 font-mono text-[10px] leading-relaxed text-slate-300">
                    <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-1.5 select-text">
                      <p className="text-slate-500">// Simulated Query Received</p>
                      <p className="text-white">Query: "{simulatedQuery}"</p>
                      <p className="text-slate-400">Timestamp: {new Date().toISOString()}</p>
                    </div>

                    <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-2 select-text">
                      <p className="text-slate-500">// Backend Pipeline Event Logs</p>
                      <div className="space-y-1">
                        {ragStage >= 0 && <p className="text-indigo-400">[INFO] Request payload parsing complete. Request boundaries: valid.</p>}
                        {ragStage >= 1 && <p className="text-indigo-400">[INFO] Query text mapped to embedding space vector coordinates: text-embedding-004.</p>}
                        {ragStage >= 2 && <p className="text-indigo-400">[INFO] Vector coordinates fetched in 45ms: 768 dimensions retrieved.</p>}
                        {ragStage >= 3 && <p className="text-teal-400">[INFO] SQL query cosine search ORDER BY e.vector_values &lt;=&gt; q_vector initiated.</p>}
                        {ragStage >= 4 && (
                          <>
                            <p className="text-emerald-400">[MATCH] Top vector citation matched: "saas_retention_v2.md" (Confidence: 98.75%)</p>
                            <p className="text-slate-300 pl-4">Chunk Context: "...Sophia Carter chunked SaaS vectors to 512-token boundaries with 1.2ms match latency..."</p>
                          </>
                        )}
                        {ragStage >= 5 && (
                          <>
                            <p className="text-emerald-400">[INFO] system_instruction formulated with grounded context blocks successfully.</p>
                            <p className="text-yellow-400 font-bold">[RESPONSE] Gemini output generated successfully: "Sophia Carter fully mapped SaaS vectors using 512-token chunks, logging average recall timings under 1.2ms with zero hallucinations."</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.01] flex items-start gap-2.5 mt-4">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest block font-mono">Telemetry Metrics</span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Sovereign vector search runs under <b>1.2ms</b> within local pgvector bounds. Response latency maps at <b>78ms</b> utilizing Gemini 2.5 flash nodes.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* =======================================================
              4. INTERACTIVE SWAGGER API PLAYGROUND
              ======================================================= */}
          {activeTab === "api" && (
            <motion.div
              key="api"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-auto lg:h-full flex flex-col lg:flex-row gap-6 min-h-0 text-left"
            >
              {/* Left Column: Endpoints selector & Parameter schema */}
              <div className="w-full md:w-96 flex flex-col rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4.5 min-h-0 overflow-y-auto shrink-0">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-4">REST API Sandbox Nodes</span>

                {/* List of endpoints */}
                <div className="space-y-2 mb-6">
                  {[
                    { id: "POST /auth/login", method: "POST", path: "/api/v1/auth/login", desc: "User JWT authentication dispatcher", requestExample: { username: "vanivalmiki694@gmail.com", password: "••••••••" } },
                    { id: "POST /chat/query", method: "POST", path: "/api/v1/chat/query", desc: "Semantic vector search with RAG generation", requestExample: { chat_id: "c-101", workspace_id: "w-202", prompt: "Extract HIPAA compliance milestones" } },
                    { id: "POST /docs/upload", method: "POST", path: "/api/v1/docs/upload", desc: "Ingest and auto-chunk document", requestExample: { name: "saas_retention_audit.pdf", workspace_id: "w-202", mime_type: "application/pdf" } },
                    { id: "POST /ai/summarize", method: "POST", path: "/api/v1/ai/summarize", desc: "Generate document Executive Summary", requestExample: { doc_id: "doc-92857", workspace_id: "w-202" } }
                  ].map((endpoint) => {
                    const isSelected = selectedEndpoint === endpoint.id;
                    const methodColor = endpoint.method === "POST" ? "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" : "text-teal-500 bg-teal-500/10 border-teal-500/20";
                    
                    return (
                      <button
                        key={endpoint.id}
                        onClick={() => {
                          setSelectedEndpoint(endpoint.id);
                          setApiRequestBody(JSON.stringify(endpoint.requestExample, null, 2));
                          setApiResponse(null);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? "border-indigo-500 bg-indigo-500/[0.01]" 
                            : "border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider border ${methodColor}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-150">{endpoint.path}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block truncate pl-1">
                          {endpoint.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* JSON Body Parameter Schema Editor */}
                <div className="flex-1 flex flex-col min-h-0">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Request JSON Body Payload</span>
                  <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[10px] text-slate-800 dark:text-slate-200 focus-within:ring-1 focus-within:ring-indigo-500 relative min-h-[150px]">
                    <textarea
                      value={apiRequestBody}
                      onChange={(e) => setApiRequestBody(e.target.value)}
                      className="w-full h-full bg-transparent border-none outline-none resize-none font-mono text-[10px]"
                    />
                  </div>
                  <button
                    onClick={runApiTest}
                    disabled={apiLoading}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-3 shrink-0 shadow-sm"
                  >
                    {apiLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Simulating API run...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Execute Playground request</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: API response console */}
              <div className="flex-1 rounded-2xl bg-slate-950 text-slate-100 border border-slate-850 p-4.5 flex flex-col min-h-0 text-left select-text">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">API Response Payload</span>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-4 leading-normal">
                  Inspect the structured JSON payloads formulated securely by Nexora API
                </p>

                <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-4 font-mono text-[10px] leading-relaxed text-slate-300">
                  {apiResponse ? (
                    <pre className="whitespace-pre">{JSON.stringify(apiResponse, null, 2)}</pre>
                  ) : apiLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Querying API Endpoint Node...</span>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                      <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Awaiting execution trigger</span>
                      <p className="text-[8px] uppercase font-bold mt-1 max-w-[180px] text-center leading-normal text-slate-400">
                        Click 'Execute Playground request' to fire a simulated high-fidelity request.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* =======================================================
              5. SECURITY & COMPLIANCE BLUEPRINT AUDIT
              ======================================================= */}
          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-auto lg:h-full flex flex-col lg:flex-row gap-6 min-h-0 text-left lg:overflow-y-auto overflow-y-auto pr-1"
            >
              {/* Left Column: Strategic Overview */}
              <div className="flex-1 space-y-5">
                
                {/* Intro card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 shadow-sm">
                  <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest block font-mono">Security compliance</span>
                  <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider -mt-1 mb-2">Zero-Trust Workspace</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                    Nexora Enterprise incorporates a bank-grade layered security matrix, checking credentials, hashes, and authorization scopes at every single operational layer. All private documents reside under cryptographically sealed indices.
                  </p>
                </div>

                {/* Audit Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: "1. HMAC & JWT Auth Token", desc: "All user requests must seal a signed JSON Web Token (JWT) utilizing HMAC SHA256 inside standard Authorization header boundaries.", solution: "FastAPI Dependency: oauth2_scheme = OAuth2PasswordBearer(tokenUrl='token')" },
                    { title: "2. Row Level Security & RBAC", desc: "Database models enforce strict multi-tenant Row Level Security (RLS). Every workspace resource checks user role_id scopes.", solution: "SQL query constraint: WHERE workspace_id = :ws_id AND user_id = :user_id" },
                    { title: "3. Cryptographic State Verification", desc: "Audit logs write previous and current row snapshots, sealing transactions with SHA256 hashes to construct immutable ledgers.", solution: "hash_checksum = sha256(previous_json + current_json).hexdigest()" },
                    { title: "4. Rate Limiting Middleware", desc: "In-memory Redis counters limit standard API nodes to 60 requests per minute to safeguard backend containers against heavy scraping.", solution: "FastAPI Middleware: Limiter(key_func=get_remote_address, default_limits=['60/minute'])" }
                  ].map((audit, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 shadow-sm text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
                          {i + 1}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-white">{audit.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-3">
                        {audit.desc}
                      </p>
                      <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/30 dark:border-slate-850 text-[9px] font-mono text-slate-600 dark:text-indigo-400 pl-4">
                        {audit.solution}
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Right Column: Code Snippets & Checksums */}
              <div className="w-full md:w-96 rounded-2xl bg-slate-950 text-slate-200 border border-slate-850 p-4.5 flex flex-col min-h-0">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Production Security Logic</span>
                <p className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-4 leading-normal">
                  Examine authentic cryptographic password hashing verification code
                </p>

                <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-3 font-mono text-[9px] leading-relaxed text-slate-300">
                  <p className="text-slate-500">// app/middleware/security.py</p>
                  <pre className="whitespace-pre text-slate-300 mt-2">{`import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import HTTPException, status

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "super_secure_sha_key"
ALGORITHM = "HS256"

def verify_password(plain_password, hashed_password):
    """Bcrypt verification algorithm verification check."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Bcrypt salting algorithm generation."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Constructs encrypted secure JWT access keys."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_jwt_payload(token: str):
    """Validates incoming client request JWT headers."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials header.",
            headers={"WWW-Authenticate": "Bearer"},
        )`}</pre>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
