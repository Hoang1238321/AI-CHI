var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  chatMessages: () => chatMessages,
  chatMessagesRelations: () => chatMessagesRelations,
  chatSessions: () => chatSessions,
  chatSessionsRelations: () => chatSessionsRelations,
  documentChunks: () => documentChunks,
  documentChunksRelations: () => documentChunksRelations,
  documents: () => documents,
  documentsRelations: () => documentsRelations,
  insertChatMessageSchema: () => insertChatMessageSchema,
  insertChatSessionSchema: () => insertChatSessionSchema,
  insertDocumentChunkSchema: () => insertDocumentChunkSchema,
  insertDocumentSchema: () => insertDocumentSchema,
  insertSubjectSchema: () => insertSubjectSchema,
  insertUserSchema: () => insertUserSchema,
  subjects: () => subjects,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
var users, subjects, chatSessions, chatMessages, documents, documentChunks, insertUserSchema, insertSubjectSchema, insertChatSessionSchema, insertChatMessageSchema, insertDocumentSchema, insertDocumentChunkSchema, usersRelations, chatSessionsRelations, chatMessagesRelations, documentsRelations, documentChunksRelations;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      firebaseUid: text("firebase_uid").notNull().unique(),
      email: text("email").notNull().unique(),
      displayName: text("display_name"),
      photoURL: text("photo_url"),
      createdAt: timestamp("created_at").defaultNow()
    });
    subjects = pgTable("subjects", {
      id: text("id").primaryKey(),
      // e.g., "MATH_001", "LIT_001"
      subjectId: integer("subject_id").notNull().unique(),
      // 1-8 numeric ID
      name: text("name").notNull(),
      nameEn: text("name_en").notNull(),
      description: text("description").notNull(),
      icon: text("icon").notNull(),
      gradientFrom: text("gradient_from").notNull(),
      gradientTo: text("gradient_to").notNull()
    });
    chatSessions = pgTable("chat_sessions", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      subjectId: text("subject_id").notNull(),
      // "MATH_001", etc.
      subjectNumericId: integer("subject_numeric_id").notNull(),
      // 1-8
      title: text("title").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    });
    chatMessages = pgTable("chat_messages", {
      id: serial("id").primaryKey(),
      sessionId: integer("session_id").notNull(),
      subjectId: text("subject_id").notNull(),
      // "MATH_001", etc.
      subjectNumericId: integer("subject_numeric_id").notNull(),
      // 1-8
      content: text("content").notNull(),
      isUser: boolean("is_user").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    });
    documents = pgTable("documents", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      subjectId: text("subject_id"),
      // "MATH_001", etc. (optional)
      subjectNumericId: integer("subject_numeric_id"),
      // 1-8 (optional)
      fileName: text("file_name").notNull(),
      filePath: text("file_path").notNull(),
      fileType: text("file_type").notNull(),
      googleDriveId: text("google_drive_id"),
      ocrText: text("ocr_text"),
      // Full OCR extracted text
      processedAt: timestamp("processed_at"),
      // When OCR processing completed
      uploadedAt: timestamp("uploaded_at").defaultNow()
    });
    documentChunks = pgTable("document_chunks", {
      id: serial("id").primaryKey(),
      documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
      chunkIndex: integer("chunk_index").notNull(),
      // Order of chunk in document
      content: text("content").notNull(),
      // Chunk text content
      wordCount: integer("word_count").notNull(),
      embedding: text("embedding"),
      // JSON string of vector embedding
      embeddingModel: text("embedding_model").default("text-embedding-3-small"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true
    });
    insertSubjectSchema = createInsertSchema(subjects);
    insertChatSessionSchema = createInsertSchema(chatSessions).omit({
      id: true,
      createdAt: true
    });
    insertChatMessageSchema = createInsertSchema(chatMessages).omit({
      id: true,
      createdAt: true
    });
    insertDocumentSchema = createInsertSchema(documents).omit({
      id: true,
      uploadedAt: true,
      processedAt: true
    });
    insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
      id: true,
      createdAt: true
    });
    usersRelations = relations(users, ({ many }) => ({
      chatSessions: many(chatSessions),
      documents: many(documents)
    }));
    chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
      user: one(users, {
        fields: [chatSessions.userId],
        references: [users.id]
      }),
      messages: many(chatMessages)
    }));
    chatMessagesRelations = relations(chatMessages, ({ one }) => ({
      session: one(chatSessions, {
        fields: [chatMessages.sessionId],
        references: [chatSessions.id]
      })
    }));
    documentsRelations = relations(documents, ({ one, many }) => ({
      user: one(users, {
        fields: [documents.userId],
        references: [users.id]
      }),
      chunks: many(documentChunks)
    }));
    documentChunksRelations = relations(documentChunks, ({ one }) => ({
      document: one(documents, {
        fields: [documentChunks.documentId],
        references: [documents.id]
      })
    }));
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db
});
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
var sql, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    sql = neon(process.env.DATABASE_URL);
    db = drizzle(sql, { schema: schema_exports });
  }
});

// server/subjects.ts
var subjects_exports = {};
__export(subjects_exports, {
  getSubjectNumericId: () => getSubjectNumericId,
  getSubjectStringId: () => getSubjectStringId
});
var getSubjectNumericId, getSubjectStringId;
var init_subjects = __esm({
  "server/subjects.ts"() {
    "use strict";
    getSubjectNumericId = (subjectStringId) => {
      const mapping = {
        "MATH_001": 1,
        "LIT_001": 2,
        "ENG_001": 3,
        "HIS_001": 4,
        "GEO_001": 5,
        "BIO_001": 6,
        "PHY_001": 7,
        "CHE_001": 8
      };
      return mapping[subjectStringId] || 1;
    };
    getSubjectStringId = (subjectNumericId) => {
      const mapping = {
        1: "MATH_001",
        2: "LIT_001",
        3: "ENG_001",
        4: "HIS_001",
        5: "GEO_001",
        6: "BIO_001",
        7: "PHY_001",
        8: "CHE_001"
      };
      return mapping[subjectNumericId] || "MATH_001";
    };
  }
});

// server/vector-service.ts
var vector_service_exports = {};
__export(vector_service_exports, {
  VectorService: () => VectorService,
  vectorService: () => vectorService
});
import OpenAI from "openai";
import { createRequire } from "module";
import { eq as eq2, and, isNotNull, count, inArray } from "drizzle-orm";
var require2, VectorService, vectorService;
var init_vector_service = __esm({
  "server/vector-service.ts"() {
    "use strict";
    init_db();
    init_schema();
    require2 = createRequire(import.meta.url);
    VectorService = class {
      openai;
      faissIndex = null;
      chunkIds = [];
      // Maps FAISS index positions to chunk IDs
      initialized = false;
      constructor() {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      }
      /**
       * Generate embedding for text using OpenAI
       */
      async generateEmbedding(text2) {
        try {
          console.log(`\u{1F52E} Generating embedding for text (${text2.length} chars)...`);
          const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            input: text2.trim(),
            encoding_format: "float"
          });
          const embedding = response.data[0].embedding;
          console.log(`\u2705 Generated embedding with ${embedding.length} dimensions`);
          return embedding;
        } catch (error) {
          console.error("\u274C Error generating embedding:", error);
          throw new Error(`Failed to generate embedding: ${error.message}`);
        }
      }
      /**
       * Add embedding to document chunk
       */
      async addEmbeddingToChunk(chunkId, content) {
        try {
          console.log(`\u{1F4DD} Adding embedding to chunk ${chunkId}...`);
          const embedding = await this.generateEmbedding(content);
          const embeddingJson = JSON.stringify(embedding);
          await db.update(documentChunks).set({
            embedding: embeddingJson,
            embeddingModel: "text-embedding-3-small"
          }).where(eq2(documentChunks.id, chunkId));
          console.log(`\u2705 Added embedding to chunk ${chunkId}`);
        } catch (error) {
          console.error(`\u274C Error adding embedding to chunk ${chunkId}:`, error);
          throw error;
        }
      }
      /**
       * Process all chunks without embeddings
       */
      async processAllChunks() {
        try {
          console.log("\u{1F504} Processing all chunks without embeddings...");
          const chunks = await db.select().from(documentChunks).where(eq2(documentChunks.embedding, null));
          console.log(`\u{1F4CA} Found ${chunks.length} chunks without embeddings`);
          for (const chunk of chunks) {
            await this.addEmbeddingToChunk(chunk.id, chunk.content);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          console.log(`\u2705 Processed ${chunks.length} chunks`);
        } catch (error) {
          console.error("\u274C Error processing chunks:", error);
          throw error;
        }
      }
      /**
       * Initialize or rebuild FAISS index
       */
      async initializeFAISSIndex() {
        try {
          console.log("\u{1F3D7}\uFE0F Initializing FAISS index...");
          const chunks = await db.select({
            id: documentChunks.id,
            embedding: documentChunks.embedding
          }).from(documentChunks).where(isNotNull(documentChunks.embedding));
          if (chunks.length === 0) {
            console.log("\u26A0\uFE0F No chunks with embeddings found");
            return;
          }
          console.log(`\u{1F4CA} Building index with ${chunks.length} chunks...`);
          const embeddings = [];
          this.chunkIds = [];
          for (const chunk of chunks) {
            try {
              const embedding = JSON.parse(chunk.embedding);
              if (Array.isArray(embedding) && embedding.length > 0) {
                embeddings.push(embedding);
                this.chunkIds.push(chunk.id);
              } else {
                console.error(`\u274C Invalid embedding format for chunk ${chunk.id}`);
              }
            } catch (error) {
              console.error(`\u274C Error parsing embedding for chunk ${chunk.id}:`, error);
            }
          }
          if (embeddings.length === 0) {
            console.log("\u26A0\uFE0F No valid embeddings found");
            return;
          }
          const dimension = embeddings[0].length;
          console.log(`\u{1F4D0} Creating FAISS index with dimension ${dimension}...`);
          const { IndexFlatL2 } = require2("faiss-node");
          this.faissIndex = new IndexFlatL2(dimension);
          const flatEmbeddings = embeddings.flat();
          this.faissIndex.add(flatEmbeddings);
          this.initialized = true;
          console.log(`\u2705 FAISS index initialized with ${embeddings.length} vectors`);
        } catch (error) {
          console.error("\u274C Error initializing FAISS index:", error);
          throw error;
        }
      }
      /**
       * Search for similar chunks using vector similarity
       */
      async searchSimilarChunks(query, topK = 5, subjectId) {
        try {
          console.log(`\u{1F50D} Searching for similar chunks: "${query.substring(0, 50)}..."`);
          if (!this.initialized || !this.faissIndex) {
            console.log("\u{1F3D7}\uFE0F FAISS index not initialized, initializing now...");
            await this.initializeFAISSIndex();
          }
          if (!this.faissIndex || this.chunkIds.length === 0) {
            console.log("\u26A0\uFE0F No FAISS index or chunks available");
            return [];
          }
          const queryEmbedding = await this.generateEmbedding(query);
          const searchK = Math.min(topK, this.chunkIds.length);
          console.log(`\u{1F50D} Searching with topK=${topK}, searchK=${searchK}, totalChunks=${this.chunkIds.length}`);
          const searchResults = this.faissIndex.search(
            queryEmbedding,
            searchK
          );
          const { distances, labels } = searchResults;
          const chunkIds = Array.from(labels).map((label) => this.chunkIds[label]);
          let chunksQuery = db.select({
            id: documentChunks.id,
            documentId: documentChunks.documentId,
            content: documentChunks.content
          }).from(documentChunks);
          if (subjectId) {
            chunksQuery = chunksQuery.innerJoin(
              db.select().from(require2("@shared/schema").documents),
              eq2(documentChunks.documentId, require2("@shared/schema").documents.id)
            ).where(
              and(
                eq2(documentChunks.id, chunkIds[0]),
                // This will be replaced by the IN clause
                eq2(require2("@shared/schema").documents.subjectId, subjectId)
              )
            );
          }
          const chunks = await db.select({
            id: documentChunks.id,
            documentId: documentChunks.documentId,
            content: documentChunks.content
          }).from(documentChunks).where(inArray(documentChunks.id, chunkIds));
          console.log(`\u{1F3AF} Found ${distances.length} similar chunks`);
          console.log("\u{1F50D} Distance results:", distances);
          console.log("\u{1F50D} Label results:", labels);
          console.log("\u{1F50D} ChunkIds mapping:", this.chunkIds);
          const results = [];
          for (let i = 0; i < Math.min(distances.length, topK); i++) {
            const chunkId = this.chunkIds[labels[i]];
            const chunk = chunks.find((c) => c.id === chunkId);
            if (chunk) {
              const similarity = 1 / (1 + distances[i]);
              results.push({
                chunkId: chunk.id,
                documentId: chunk.documentId,
                content: chunk.content,
                similarity
              });
            }
          }
          console.log(`\u{1F3AF} Found ${results.length} similar chunks`);
          return results.slice(0, topK);
        } catch (error) {
          console.error("\u274C Error searching similar chunks:", error);
          throw error;
        }
      }
      /**
       * Get embedding statistics
       */
      async getEmbeddingStats() {
        try {
          const [total] = await db.select({ count: count() }).from(documentChunks);
          const [withEmbeddings] = await db.select({ count: count() }).from(documentChunks).where(isNotNull(documentChunks.embedding));
          return {
            totalChunks: total.count,
            chunksWithEmbeddings: withEmbeddings.count,
            chunksWithoutEmbeddings: total.count - withEmbeddings.count
          };
        } catch (error) {
          console.error("\u274C Error getting embedding stats:", error);
          throw error;
        }
      }
      /**
       * Rebuild index after adding new chunks
       */
      async rebuildIndex() {
        console.log("\u{1F504} Rebuilding FAISS index...");
        this.initialized = false;
        this.faissIndex = null;
        this.chunkIds = [];
        await this.initializeFAISSIndex();
      }
    };
    vectorService = new VectorService();
  }
});

// server/openai.ts
var openai_exports = {};
__export(openai_exports, {
  getChatGPTResponse: () => getChatGPTResponse
});
import OpenAI2 from "openai";
async function getChatGPTResponse(message, subjectId, context, model = "gpt-4o") {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createSystemPrompt(subjectId);
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: context ? `${context}

\u{1F4DD} **C\xE2u h\u1ECFi c\u1EE7a h\u1ECDc sinh:** ${message}

\u{1F4A1} **H\u01B0\u1EDBng d\u1EABn tr\u1EA3 l\u1EDDi:** H\xE3y tr\u1EA3 l\u1EDDi d\u1EF1a tr\xEAn t\xE0i li\u1EC7u \u1EDF tr\xEAn l\xE0m ch\u1EE7 y\u1EBFu. N\u1EBFu t\xE0i li\u1EC7u ch\u01B0a \u0111\u1EE7 th\xF4ng tin, b\u1ED5 sung ki\u1EBFn th\u1EE9c b\xEAn ngo\xE0i nh\u01B0ng ghi r\xF5 ngu\u1ED3n.` : message
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c ph\u1EA3n h\u1ED3i t\u1EEB ChatGPT");
    }
    return {
      content,
      subject: teacher.name,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("C\xF3 l\u1ED7i x\u1EA3y ra khi k\u1EBFt n\u1ED1i v\u1EDBi ChatGPT. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
  }
}
var openai, createSystemPrompt, getSubjectTeacher;
var init_openai = __esm({
  "server/openai.ts"() {
    "use strict";
    openai = new OpenAI2({
      apiKey: process.env.OPENAI_API_KEY
    });
    createSystemPrompt = (subjectId) => {
      const subject = getSubjectTeacher(subjectId);
      return `B\u1EA1n l\xE0 ${subject.name}, m\u1ED9t gi\xE1o vi\xEAn ${subject.expertise} chuy\xEAn nghi\u1EC7p t\u1EA1i Vi\u1EC7t Nam. 

PH\u01AF\u01A0NG PH\xC1P BRAINSTORM V\xC0 TR\u1EA2 L\u1EDCI:
1. BRAINSTORM tr\u01B0\u1EDBc khi tr\u1EA3 l\u1EDDi:
   - Ph\xE2n t\xEDch c\xE2u h\u1ECFi c\xF3 li\xEAn quan \u0111\u1EBFn ${subject.expertise} kh\xF4ng?
   - X\xE1c \u0111\u1ECBnh m\u1EE9c \u0111\u1ED9 kh\xF3, ki\u1EBFn th\u1EE9c c\u1EA7n thi\u1EBFt
   - L\u1EADp k\u1EBF ho\u1EA1ch tr\u1EA3 l\u1EDDi ph\xF9 h\u1EE3p

2. C\u1EA4U TR\xDAC TR\u1EA2 L\u1EDCI CHU\u1EA8N (d\xE0nh cho gi\u1EA3i th\xEDch ki\u1EBFn th\u1EE9c):
   \u{1F4DA} **L\u1EDDi ch\xE0o & Gi\u1EDBi thi\u1EC7u**: Ch\xE0o h\u1ECDc sinh, gi\u1EDBi thi\u1EC7u ch\u1EE7 \u0111\u1EC1 s\u1EBD h\u1ECDc
   \u{1F3AF} **N\u1ED9i dung ch\xEDnh**: Gi\u1EA3i th\xEDch kh\xE1i ni\u1EC7m, \u0111\u1ECBnh l\xFD, quy t\u1EAFc c\u1ED1t l\xF5i
   \u{1F4A1} **V\xED d\u1EE5 minh h\u1ECDa**: \u0110\u01B0a ra v\xED d\u1EE5 c\u1EE5 th\u1EC3, b\xE0i t\u1EADp m\u1EABu
   \u{1F504} **K\u1EBFt lu\u1EADn**: T\xF3m t\u1EAFt \u0111i\u1EC3m quan tr\u1ECDng
   \u{1F680} **M\u1EDF r\u1ED9ng**: \u0110\u1EC1 xu\u1EA5t c\xE2u h\u1ECFi li\xEAn quan \u0111\u1EC3 h\u1ECDc s\xE2u h\u01A1n

3. C\u1EA4U TR\xDAC CH\u1EEEA B\xC0I T\u1EACP (d\xE0nh cho b\xE0i t\u1EADp c\u1EE5 th\u1EC3):
   \u{1F4DD} **Ph\xE2n t\xEDch \u0111\u1EC1**: X\xE1c \u0111\u1ECBnh d\u1EA1ng b\xE0i, y\xEAu c\u1EA7u
   \u{1F4D0} **L\u1EDDi gi\u1EA3i t\u1EEBng b\u01B0\u1EDBc**: H\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt, r\xF5 r\xE0ng
   \u2705 **Ki\u1EC3m tra k\u1EBFt qu\u1EA3**: \u0110\u1ED1i chi\u1EBFu, ki\u1EC3m tra t\xEDnh h\u1EE3p l\xFD
   \u{1F4AD} **L\u01B0u \xFD**: Nh\u1EEFng \u0111i\u1EC3m c\u1EA7n ch\xFA \xFD, sai l\u1EA7m th\u01B0\u1EDDng g\u1EB7p

4. T\u1EA0O B\u1EA2NG BI\u1EC2U (B\u1EAET BU\u1ED8C) khi h\u1ECDc sinh nh\u1EAFc \u0111\u1EBFn:
   - "so s\xE1nh", "\u0111\u1EB7c \u0111i\u1EC3m", "t\xEDnh ch\u1EA5t", "t\u1EA1o b\u1EA3ng", "ph\xE2n lo\u1EA1i", "kh\xE1c nhau", "gi\u1ED1ng nhau"
   - LU\xD4N t\u1EA1o b\u1EA3ng markdown v\u1EDBi format chu\u1EA9n:
   | Ti\xEAu ch\xED | [\u0110\u1ED1i t\u01B0\u1EE3ng 1] | [\u0110\u1ED1i t\u01B0\u1EE3ng 2] |
   |----------|---------------|---------------|
   | [Ti\xEAu ch\xED 1] | [M\xF4 t\u1EA3 1] | [M\xF4 t\u1EA3 2] |
   - T\u1ED1i thi\u1EC3u 3-5 h\xE0ng d\u1EEF li\u1EC7u cho m\u1ED7i b\u1EA3ng

NGUY\xCAN T\u1EAEC \u01AFU TI\xCAN T\xC0I LI\u1EC6U:
- **QUAN TR\u1ECCNG NH\u1EA4T**: Khi c\xF3 t\xE0i li\u1EC7u li\xEAn quan, B\u1EAET BU\u1ED8C d\u1EF1a v\xE0o n\u1ED9i dung t\xE0i li\u1EC7u l\xE0m ngu\u1ED3n ch\xEDnh
- Tr\xEDch d\u1EABn tr\u1EF1c ti\u1EBFp t\u1EEB t\xE0i li\u1EC7u khi c\xF3 th\u1EC3
- Ch\u1EC9 b\u1ED5 sung ki\u1EBFn th\u1EE9c b\xEAn ngo\xE0i khi t\xE0i li\u1EC7u ch\u01B0a \u0111\u1EE7 th\xF4ng tin
- Lu\xF4n ghi r\xF5 ngu\u1ED3n: "Theo t\xE0i li\u1EC7u..." ho\u1EB7c "B\u1ED5 sung th\xEAm..."
- Ch\u1EC9 tr\u1EA3 l\u1EDDi v\u1EC1 ${subject.expertise}, t\u1EEB ch\u1ED1i l\u1ECBch s\u1EF1 n\u1EBFu kh\xF4ng li\xEAn quan
- S\u1EED d\u1EE5ng ti\u1EBFng Vi\u1EC7t t\u1EF1 nhi\xEAn, d\u1EC5 hi\u1EC3u
- K\u1EBFt h\u1EE3p emoji ph\xF9 h\u1EE3p \u0111\u1EC3 t\u1EA1o s\u1EF1 th\xE2n thi\u1EC7n
- Khuy\u1EBFn kh\xEDch h\u1ECDc sinh \u0111\u1EB7t c\xE2u h\u1ECFi ti\u1EBFp theo
- S\u1EED d\u1EE5ng LaTeX cho c\xF4ng th\u1EE9c to\xE1n h\u1ECDc: $x^2 + y^2 = z^2$ ho\u1EB7c $$\\int_a^b f(x)dx$$

PHONG C\xC1CH: ${subject.style}`;
    };
    getSubjectTeacher = (subjectId) => {
      const teachers = {
        "MATH_001": {
          name: "Th\u1EA7y Minh - Gi\xE1o vi\xEAn To\xE1n",
          expertise: "To\xE1n h\u1ECDc (\u0111\u1EA1i s\u1ED1, h\xECnh h\u1ECDc, gi\u1EA3i t\xEDch, x\xE1c su\u1EA5t th\u1ED1ng k\xEA)",
          style: "Gi\u1EA3i th\xEDch t\u1EEBng b\u01B0\u1EDBc m\u1ED9t c\xE1ch logic, r\xF5 r\xE0ng v\u1EDBi nhi\u1EC1u v\xED d\u1EE5 th\u1EF1c t\u1EBF"
        },
        "LIT_001": {
          name: "C\xF4 Lan - Gi\xE1o vi\xEAn Ng\u1EEF v\u0103n",
          expertise: "Ng\u1EEF v\u0103n (v\u0103n h\u1ECDc Vi\u1EC7t Nam, ph\xE2n t\xEDch t\xE1c ph\u1EA9m, k\u1EF9 n\u0103ng vi\u1EBFt, ng\u1EEF ph\xE1p)",
          style: "K\u1EBFt h\u1EE3p c\u1EA3m x\xFAc v\xE0 ph\xE2n t\xEDch, s\u1EED d\u1EE5ng nhi\u1EC1u c\xE2u chuy\u1EC7n minh h\u1ECDa"
        },
        "ENG_001": {
          name: "C\xF4 Linh - Gi\xE1o vi\xEAn Ti\u1EBFng Anh",
          expertise: "Ti\u1EBFng Anh (ng\u1EEF ph\xE1p, t\u1EEB v\u1EF1ng, k\u1EF9 n\u0103ng giao ti\u1EBFp, luy\u1EC7n thi)",
          style: "H\u1ECDc t\u01B0\u01A1ng t\xE1c v\u1EDBi v\xED d\u1EE5 th\u1EF1c t\u1EBF, gi\u1EA3i th\xEDch b\u1EB1ng ti\u1EBFng Vi\u1EC7t d\u1EC5 hi\u1EC3u"
        },
        "HIS_001": {
          name: "Th\u1EA7y Tu\u1EA5n - Gi\xE1o vi\xEAn L\u1ECBch s\u1EED",
          expertise: "L\u1ECBch s\u1EED (l\u1ECBch s\u1EED Vi\u1EC7t Nam, l\u1ECBch s\u1EED th\u1EBF gi\u1EDBi, c\xE1c s\u1EF1 ki\u1EC7n quan tr\u1ECDng)",
          style: "K\u1EC3 l\u1ECBch s\u1EED nh\u01B0 nh\u1EEFng c\xE2u chuy\u1EC7n th\xFA v\u1ECB, li\xEAn h\u1EC7 qu\xE1 kh\u1EE9 v\u1EDBi hi\u1EC7n t\u1EA1i"
        },
        "GEO_001": {
          name: "C\xF4 H\u01B0\u1EDDng - Gi\xE1o vi\xEAn \u0110\u1ECBa l\xFD",
          expertise: "\u0110\u1ECBa l\xFD (\u0111\u1ECBa l\xFD t\u1EF1 nhi\xEAn, \u0111\u1ECBa l\xFD kinh t\u1EBF, kh\xED h\u1EADu, \u0111\u1ECBa h\xECnh)",
          style: "S\u1EED d\u1EE5ng b\u1EA3n \u0111\u1ED3, h\xECnh \u1EA3nh v\xE0 so s\xE1nh \u0111\u1EC3 gi\xFAp h\u1ECDc sinh h\xECnh dung r\xF5 r\xE0ng"
        },
        "BIO_001": {
          name: "Th\u1EA7y Khang - Gi\xE1o vi\xEAn Sinh h\u1ECDc",
          expertise: "Sinh h\u1ECDc (sinh h\u1ECDc t\u1EBF b\xE0o, sinh h\u1ECDc c\u01A1 th\u1EC3, th\u1EF1c v\u1EADt, \u0111\u1ED9ng v\u1EADt)",
          style: "Gi\u1EA3i th\xEDch b\u1EB1ng hi\u1EC7n t\u01B0\u1EE3ng \u0111\u1EDDi s\u1ED1ng, k\u1EBFt h\u1EE3p h\xECnh \u1EA3nh minh h\u1ECDa"
        },
        "PHY_001": {
          name: "Th\u1EA7y H\xF9ng - Gi\xE1o vi\xEAn V\u1EADt l\xFD",
          expertise: "V\u1EADt l\xFD (c\u01A1 h\u1ECDc, \u0111i\u1EC7n h\u1ECDc, quang h\u1ECDc, nhi\u1EC7t h\u1ECDc, v\u1EADt l\xFD hi\u1EC7n \u0111\u1EA1i)",
          style: "B\u1EAFt \u0111\u1EA7u t\u1EEB hi\u1EC7n t\u01B0\u1EE3ng th\u1EF1c t\u1EBF, gi\u1EA3i th\xEDch b\u1EB1ng l\xFD thuy\u1EBFt v\xE0 c\xF4ng th\u1EE9c"
        },
        "CHE_001": {
          name: "C\xF4 Mai - Gi\xE1o vi\xEAn H\xF3a h\u1ECDc",
          expertise: "H\xF3a h\u1ECDc (h\xF3a v\xF4 c\u01A1, h\xF3a h\u1EEFu c\u01A1, h\xF3a ph\xE2n t\xEDch, ph\u1EA3n \u1EE9ng h\xF3a h\u1ECDc)",
          style: "K\u1EBFt h\u1EE3p l\xFD thuy\u1EBFt v\u1EDBi th\xED nghi\u1EC7m v\xE0 \u1EE9ng d\u1EE5ng trong \u0111\u1EDDi s\u1ED1ng"
        }
      };
      return teachers[subjectId] || teachers["MATH_001"];
    };
  }
});

// server/google-drive.ts
var google_drive_exports = {};
__export(google_drive_exports, {
  googleDriveService: () => googleDriveService
});
import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
var GoogleDriveService, googleDriveService;
var init_google_drive = __esm({
  "server/google-drive.ts"() {
    "use strict";
    GoogleDriveService = class {
      drive;
      auth;
      rcloneConfigPath;
      webdavPort = 8080;
      constructor() {
        this.rcloneConfigPath = path.join(process.cwd(), "rclone.conf");
        this.initializeAuth();
      }
      async initializeAuth() {
        try {
          if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            console.log("\u26A0\uFE0F Google Service Account credentials not found in environment");
            return;
          }
          const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
          this.auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ["https://www.googleapis.com/auth/drive"]
          });
          this.drive = google.drive({ version: "v3", auth: this.auth });
          await this.setupRcloneConfig(serviceAccount);
          console.log("\u2705 Google Drive Service Account initialized successfully");
        } catch (error) {
          console.error("\u274C Failed to initialize Google Drive Service:", error);
        }
      }
      async setupRcloneConfig(serviceAccount) {
        const rcloneConfig = `
[gdrive]
type = drive
service_account_file = ${path.join(process.cwd(), "service-account.json")}
scope = drive
root_folder_id = 

[webdav]
type = webdav
url = http://localhost:${this.webdavPort}
vendor = other
`;
        try {
          await fs.writeFile(
            path.join(process.cwd(), "service-account.json"),
            JSON.stringify(serviceAccount, null, 2)
          );
          await fs.writeFile(this.rcloneConfigPath, rcloneConfig.trim());
          console.log("\u2705 Rclone configuration setup complete");
        } catch (error) {
          console.error("\u274C Failed to setup rclone config:", error);
        }
      }
      async startWebDAVServer() {
        return new Promise((resolve, reject) => {
          console.log(`\u{1F680} Starting WebDAV server on port ${this.webdavPort}...`);
          const rcloneProcess = spawn("rclone", [
            "serve",
            "webdav",
            "gdrive:/",
            "--addr",
            `0.0.0.0:${this.webdavPort}`,
            "--config",
            this.rcloneConfigPath,
            "--log-level",
            "INFO"
          ]);
          rcloneProcess.stdout.on("data", (data) => {
            console.log(`\u{1F4E1} WebDAV: ${data}`);
          });
          rcloneProcess.stderr.on("data", (data) => {
            console.error(`\u274C WebDAV Error: ${data}`);
          });
          rcloneProcess.on("close", (code) => {
            console.log(`\u{1F6D1} WebDAV server exited with code ${code}`);
          });
          setTimeout(() => {
            console.log(`\u2705 WebDAV server should be running on http://localhost:${this.webdavPort}`);
            resolve();
          }, 3e3);
        });
      }
      async listFiles(folderId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const response = await this.drive.files.list({
            q: folderId ? `'${folderId}' in parents` : void 0,
            fields: "files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
            pageSize: 50
          });
          return response.data.files || [];
        } catch (error) {
          console.error("\u274C Error listing files:", error);
          throw error;
        }
      }
      async uploadFile(fileName, fileBuffer, parentFolderId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const response = await this.drive.files.create({
            requestBody: {
              name: fileName,
              parents: parentFolderId ? [parentFolderId] : void 0
            },
            media: {
              body: fileBuffer
            },
            fields: "id, name, webViewLink"
          });
          console.log(`\u2705 File uploaded: ${fileName} (ID: ${response.data.id})`);
          return response.data;
        } catch (error) {
          console.error("\u274C Error uploading file:", error);
          throw error;
        }
      }
      async createFolder(folderName, parentFolderId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const response = await this.drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: "application/vnd.google-apps.folder",
              parents: parentFolderId ? [parentFolderId] : void 0
            },
            fields: "id, name"
          });
          console.log(`\u2705 Folder created: ${folderName} (ID: ${response.data.id})`);
          return response.data;
        } catch (error) {
          console.error("\u274C Error creating folder:", error);
          throw error;
        }
      }
      async deleteFile(fileId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          await this.drive.files.delete({
            fileId
          });
          console.log(`\u2705 File deleted: ${fileId}`);
        } catch (error) {
          console.error("\u274C Error deleting file:", error);
          throw error;
        }
      }
      async getFileInfo(fileId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const response = await this.drive.files.get({
            fileId,
            fields: "id, name, mimeType, size, createdTime, modifiedTime"
          });
          return response.data;
        } catch (error) {
          console.error("\u274C Error getting file info:", error);
          throw error;
        }
      }
      async downloadFile(fileId, destinationPath) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const fs5 = await import("fs");
          const response = await this.drive.files.get({
            fileId,
            alt: "media"
          }, { responseType: "stream" });
          const dest = fs5.createWriteStream(destinationPath);
          response.data.pipe(dest);
          return new Promise((resolve, reject) => {
            dest.on("finish", resolve);
            dest.on("error", reject);
          });
        } catch (error) {
          console.error("\u274C Error downloading file:", error);
          throw error;
        }
      }
      async getFileContent(fileId) {
        try {
          if (!this.drive) {
            throw new Error("Google Drive not initialized");
          }
          const response = await this.drive.files.get({
            fileId,
            alt: "media"
          }, { responseType: "stream" });
          return new Promise((resolve, reject) => {
            const chunks = [];
            response.data.on("data", (chunk) => chunks.push(chunk));
            response.data.on("end", () => resolve(Buffer.concat(chunks)));
            response.data.on("error", reject);
          });
        } catch (error) {
          console.error("\u274C Error getting file content:", error);
          throw error;
        }
      }
      getWebDAVUrl() {
        return `http://localhost:${this.webdavPort}`;
      }
      isInitialized() {
        return !!this.drive;
      }
    };
    googleDriveService = new GoogleDriveService();
  }
});

// server/pdf-processor.ts
var pdf_processor_exports = {};
__export(pdf_processor_exports, {
  PDFProcessor: () => PDFProcessor,
  pdfProcessor: () => pdfProcessor
});
import { createWorker } from "tesseract.js";
import pdf2pic from "pdf2pic";
import sharp from "sharp";
import fs2 from "fs/promises";
import { eq as eq3 } from "drizzle-orm";
var PDFProcessor, pdfProcessor;
var init_pdf_processor = __esm({
  "server/pdf-processor.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_vector_service();
    PDFProcessor = class _PDFProcessor {
      static instance;
      tesseractWorker;
      constructor() {
      }
      static getInstance() {
        if (!_PDFProcessor.instance) {
          _PDFProcessor.instance = new _PDFProcessor();
        }
        return _PDFProcessor.instance;
      }
      async initialize() {
        if (!this.tesseractWorker) {
          console.log("\u{1F527} Initializing Tesseract OCR worker...");
          this.tesseractWorker = await createWorker("vie+eng");
          console.log("\u2705 Tesseract OCR worker initialized");
        }
      }
      async processPDF(options) {
        const { pdfPath, userId, fileName, googleDriveId, subjectId, subjectNumericId } = options;
        console.log(`\u{1F4C4} Processing PDF: ${fileName}`);
        const images = await this.convertPDFToImages(pdfPath);
        console.log(`\u{1F4F8} Converted PDF to ${images.length} images`);
        let fullText = "";
        for (let i = 0; i < images.length; i++) {
          console.log(`\u{1F50D} OCR processing page ${i + 1}/${images.length}`);
          const pageText = await this.performOCR(images[i]);
          fullText += pageText + "\n\n";
          await fs2.unlink(images[i]).catch(() => {
          });
        }
        console.log(`\u{1F4DD} Extracted ${fullText.length} characters from PDF`);
        const documentData = {
          userId,
          fileName,
          filePath: pdfPath,
          fileType: "pdf",
          googleDriveId,
          subjectId,
          subjectNumericId,
          ocrText: fullText
        };
        const [document] = await db.insert(documents).values(documentData).returning();
        await db.update(documents).set({ processedAt: /* @__PURE__ */ new Date() }).where(eq3(documents.id, document.id));
        console.log(`\u{1F4BE} Document saved with ID: ${document.id}`);
        const chunksCount = await this.createDocumentChunks(document.id, fullText);
        console.log(`\u{1F4CA} Created ${chunksCount} chunks for document`);
        return { documentId: document.id, chunksCount };
      }
      async convertPDFToImages(pdfPath) {
        const tempDir = "/tmp/pdf-processing";
        await fs2.mkdir(tempDir, { recursive: true });
        const convert = pdf2pic.fromPath(pdfPath, {
          density: 200,
          // DPI
          saveFilename: "page",
          savePath: tempDir,
          format: "png",
          width: 2e3,
          height: 2800,
          graphicsMagick: true
          // Use GraphicsMagick instead of ImageMagick
        });
        const results = await convert.bulk(-1);
        return results.map((result) => result.path);
      }
      async performOCR(imagePath) {
        await this.initialize();
        try {
          const optimizedPath = imagePath.replace(".png", "_optimized.png");
          await sharp(imagePath).greyscale().normalize().sharpen().png({ quality: 95 }).toFile(optimizedPath);
          const { data: { text: text2 } } = await this.tesseractWorker.recognize(optimizedPath);
          await fs2.unlink(optimizedPath).catch(() => {
          });
          return this.cleanOCRText(text2);
        } catch (error) {
          console.error("OCR Error:", error);
          return "";
        }
      }
      cleanOCRText(text2) {
        return text2.replace(/\s+/g, " ").replace(/\n\s*\n/g, "\n").trim();
      }
      async createDocumentChunks(documentId, fullText, options = { maxWordsPerChunk: 500, overlapWords: 50 }) {
        const { maxWordsPerChunk, overlapWords } = options;
        const words = fullText.split(/\s+/).filter((word) => word.trim().length > 0);
        if (words.length === 0) {
          return 0;
        }
        const chunks = [];
        let chunkIndex = 0;
        for (let i = 0; i < words.length; i += maxWordsPerChunk - overlapWords) {
          const chunkWords = words.slice(i, i + maxWordsPerChunk);
          const content = chunkWords.join(" ");
          if (content.trim().length > 0) {
            chunks.push({
              documentId,
              chunkIndex,
              content: content.trim(),
              wordCount: chunkWords.length
            });
            chunkIndex++;
          }
        }
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const savedChunks = await db.insert(documentChunks).values(batch).returning();
          for (const savedChunk of savedChunks) {
            try {
              console.log(`\u{1F52E} Generating embedding for chunk ${savedChunk.chunkIndex + 1}/${chunks.length}...`);
              await vectorService.addEmbeddingToChunk(savedChunk.id, savedChunk.content);
            } catch (embeddingError) {
              console.error(`\u26A0\uFE0F Failed to generate embedding for chunk ${savedChunk.id}:`, embeddingError);
            }
          }
        }
        return chunks.length;
      }
      async getDocumentWithChunks(documentId) {
        const document = await db.query.documents.findFirst({
          where: eq3(documents.id, documentId),
          with: {
            chunks: {
              orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)]
            }
          }
        });
        return document;
      }
      async searchInDocuments(query, userId, subjectId) {
        const searchPattern = `%${query.toLowerCase()}%`;
        const results = await db.query.documentChunks.findMany({
          where: (chunks, { like, and: and2, eq: eqOp }) => and2(
            like(chunks.content, searchPattern),
            // Filter by user's documents
            eqOp(chunks.documentId, documents.id)
          ),
          with: {
            document: true
          },
          limit: 10
        });
        return results;
      }
      async cleanup() {
        if (this.tesseractWorker) {
          await this.tesseractWorker.terminate();
          this.tesseractWorker = null;
        }
      }
    };
    pdfProcessor = PDFProcessor.getInstance();
  }
});

// server/subject-detector.ts
var subject_detector_exports = {};
__export(subject_detector_exports, {
  SubjectDetector: () => SubjectDetector,
  testSubjectDetection: () => testSubjectDetection
});
function testSubjectDetection() {
  const testFiles = [
    "L\xFD.pdf",
    "Bai tap - H\u1EC7 th\u1EA7n kinh.pdf",
    "Sinh l\u1EDBp 12 - Ch\u1EE7 \u0111\u1EC1 3.mp4",
    "To\xE1n h\u1ECDc l\u1EDBp 12.pdf",
    "V\u0103n h\u1ECDc Vi\u1EC7t Nam.pdf",
    "English Grammar.pdf",
    "L\u1ECBch s\u1EED Vi\u1EC7t Nam.pdf",
    "\u0110\u1ECBa l\xFD t\u1EF1 nhi\xEAn.pdf",
    "H\xF3a h\u1ECDc h\u1EEFu c\u01A1.pdf"
  ];
  console.log("\u{1F9EA} Testing Subject Detection:");
  for (const filename of testFiles) {
    const result = SubjectDetector.detectSubject(filename);
    if (result) {
      const subject = SubjectDetector.getSubjectById(result.subjectId);
      console.log(`\u{1F4C4} "${filename}" -> ${subject?.name} (${(result.confidence * 100).toFixed(1)}%)`);
    } else {
      console.log(`\u{1F4C4} "${filename}" -> Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c m\xF4n h\u1ECDc`);
    }
  }
}
var SubjectDetector;
var init_subject_detector = __esm({
  "server/subject-detector.ts"() {
    "use strict";
    SubjectDetector = class {
      static SUBJECT_MAPPINGS = [
        {
          id: "MATH_001",
          numericId: 1,
          name: "To\xE1n h\u1ECDc",
          keywords: ["to\xE1n", "math", "mathematics", "h\xECnh h\u1ECDc", "\u0111\u1EA1i s\u1ED1", "gi\u1EA3i t\xEDch", "l\u01B0\u1EE3ng gi\xE1c"]
        },
        {
          id: "LIT_001",
          numericId: 2,
          name: "Ng\u1EEF v\u0103n",
          keywords: ["v\u0103n", "literature", "ng\u1EEF v\u0103n", "ti\u1EBFng vi\u1EC7t", "v\u0103n h\u1ECDc", "ph\xE2n t\xEDch", "t\xE1c ph\u1EA9m"]
        },
        {
          id: "ENG_001",
          numericId: 3,
          name: "Ti\u1EBFng Anh",
          keywords: ["anh", "english", "ti\u1EBFng anh", "grammar", "vocabulary", "speaking", "listening"]
        },
        {
          id: "HIS_001",
          numericId: 4,
          name: "L\u1ECBch s\u1EED",
          keywords: ["s\u1EED", "history", "l\u1ECBch s\u1EED", "historical", "c\xE1ch m\u1EA1ng", "th\u1EBF chi\u1EBFn"]
        },
        {
          id: "GEO_001",
          numericId: 5,
          name: "\u0110\u1ECBa l\xFD",
          keywords: ["\u0111\u1ECBa", "geography", "\u0111\u1ECBa l\xFD", "b\u1EA3n \u0111\u1ED3", "kh\xED h\u1EADu", "d\xE2n s\u1ED1", "kinh t\u1EBF"]
        },
        {
          id: "BIO_001",
          numericId: 6,
          name: "Sinh h\u1ECDc",
          keywords: ["sinh", "biology", "sinh h\u1ECDc", "t\u1EBF b\xE0o", "di truy\u1EC1n", "ti\u1EBFn h\xF3a", "enzyme", "atp"]
        },
        {
          id: "PHY_001",
          numericId: 7,
          name: "V\u1EADt l\xFD",
          keywords: ["l\xFD", "physics", "v\u1EADt l\xFD", "c\u01A1 h\u1ECDc", "\u0111i\u1EC7n h\u1ECDc", "quang h\u1ECDc", "nhi\u1EC7t h\u1ECDc", "dao \u0111\u1ED9ng"]
        },
        {
          id: "CHE_001",
          numericId: 8,
          name: "H\xF3a h\u1ECDc",
          keywords: ["h\xF3a", "chemistry", "h\xF3a h\u1ECDc", "ph\u1EA3n \u1EE9ng", "nguy\xEAn t\u1ED1", "ph\xE2n t\u1EED", "ion", "axit"]
        }
      ];
      /**
       * Detect subject from filename
       */
      static detectSubject(filename) {
        const cleanFilename = this.normalizeText(filename);
        let bestMatch = null;
        let highestScore = 0;
        for (const subject of this.SUBJECT_MAPPINGS) {
          const score = this.calculateMatchScore(cleanFilename, subject);
          if (score > highestScore && score > 0.3) {
            highestScore = score;
            bestMatch = subject;
          }
        }
        if (bestMatch) {
          return {
            subjectId: bestMatch.id,
            subjectNumericId: bestMatch.numericId,
            confidence: highestScore
          };
        }
        return null;
      }
      /**
       * Normalize Vietnamese text by removing diacritics and converting to lowercase
       */
      static normalizeText(text2) {
        return text2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
      }
      /**
       * Calculate match score between filename and subject keywords
       */
      static calculateMatchScore(filename, subject) {
        let score = 0;
        const filenameWords = filename.split(" ");
        for (const keyword of subject.keywords) {
          const normalizedKeyword = this.normalizeText(keyword);
          if (filename.includes(normalizedKeyword)) {
            if (normalizedKeyword.length > 2) {
              score += 1;
            } else {
              score += 0.8;
            }
          }
          for (const word of filenameWords) {
            if (word.includes(normalizedKeyword) || normalizedKeyword.includes(word)) {
              if (word.length > 1 && normalizedKeyword.length > 1) {
                score += 0.5;
              }
            }
          }
        }
        return Math.min(score / subject.keywords.length, 1);
      }
      /**
       * Get all available subjects
       */
      static getAllSubjects() {
        return [...this.SUBJECT_MAPPINGS];
      }
      /**
       * Get subject by ID
       */
      static getSubjectById(id) {
        return this.SUBJECT_MAPPINGS.find((s) => s.id === id) || null;
      }
      /**
       * Get subject by numeric ID
       */
      static getSubjectByNumericId(numericId) {
        return this.SUBJECT_MAPPINGS.find((s) => s.numericId === numericId) || null;
      }
    };
  }
});

// server/google-drive-pdf.ts
var google_drive_pdf_exports = {};
__export(google_drive_pdf_exports, {
  GoogleDrivePDFService: () => GoogleDrivePDFService,
  googleDrivePDFService: () => googleDrivePDFService
});
import fs3 from "fs/promises";
import path2 from "path";
var GoogleDrivePDFService, googleDrivePDFService;
var init_google_drive_pdf = __esm({
  "server/google-drive-pdf.ts"() {
    "use strict";
    init_google_drive();
    init_pdf_processor();
    init_subject_detector();
    GoogleDrivePDFService = class _GoogleDrivePDFService {
      static instance;
      constructor() {
      }
      static getInstance() {
        if (!_GoogleDrivePDFService.instance) {
          _GoogleDrivePDFService.instance = new _GoogleDrivePDFService();
        }
        return _GoogleDrivePDFService.instance;
      }
      async processPDFFromDrive(fileId, userId, subjectId, subjectNumericId) {
        console.log(`\u{1F4E5} Processing PDF from Google Drive: ${fileId}`);
        try {
          const fileInfo = await googleDriveService.getFileInfo(fileId);
          if (!fileInfo || fileInfo.mimeType !== "application/pdf") {
            throw new Error("File is not a PDF or does not exist");
          }
          console.log(`\u{1F4C4} File info: ${fileInfo.name} (${fileInfo.size} bytes)`);
          if (!subjectId || !subjectNumericId) {
            const detectedSubject = SubjectDetector.detectSubject(fileInfo.name);
            if (detectedSubject) {
              console.log(`\u{1F50D} Auto-detected subject: ${SubjectDetector.getSubjectById(detectedSubject.subjectId)?.name} (${(detectedSubject.confidence * 100).toFixed(1)}% confidence)`);
              subjectId = subjectId || detectedSubject.subjectId;
              subjectNumericId = subjectNumericId || detectedSubject.subjectNumericId;
            } else {
              console.log(`\u26A0\uFE0F Could not auto-detect subject from filename: ${fileInfo.name}`);
              subjectId = subjectId || "GENERAL_001";
              subjectNumericId = subjectNumericId || 9;
            }
          }
          const tempDir = "/tmp/pdf-downloads";
          await fs3.mkdir(tempDir, { recursive: true });
          const tempPath = path2.join(tempDir, `${fileId}.pdf`);
          await googleDriveService.downloadFile(fileId, tempPath);
          console.log(`\u2B07\uFE0F Downloaded PDF to: ${tempPath}`);
          const result = await pdfProcessor.processPDF({
            pdfPath: tempPath,
            userId,
            fileName: fileInfo.name,
            googleDriveId: fileId,
            subjectId,
            subjectNumericId
          });
          await fs3.unlink(tempPath).catch((error) => {
            console.warn(`Failed to clean up temp file: ${error.message}`);
          });
          console.log(`\u2705 PDF processing completed: Document ID ${result.documentId}, ${result.chunksCount} chunks`);
          return result;
        } catch (error) {
          console.error(`\u274C PDF processing failed:`, error);
          throw error;
        }
      }
      async batchProcessPDFs(fileIds, userId, subjectId, subjectNumericId) {
        const results = [];
        for (const fileId of fileIds) {
          try {
            const result = await this.processPDFFromDrive(fileId, userId, subjectId, subjectNumericId);
            results.push({
              fileId,
              success: true,
              documentId: result.documentId,
              chunksCount: result.chunksCount
            });
          } catch (error) {
            results.push({
              fileId,
              success: false,
              error: error.message
            });
          }
        }
        return results;
      }
    };
    googleDrivePDFService = GoogleDrivePDFService.getInstance();
  }
});

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/db-storage.ts
init_db();
init_schema();
import { eq, desc } from "drizzle-orm";
var DatabaseStorage = class {
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  async getUserByFirebaseUid(firebaseUid) {
    const result = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    return result[0];
  }
  async createUser(insertUser) {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }
  async createChatSession(insertSession) {
    const result = await db.insert(chatSessions).values(insertSession).returning();
    return result[0];
  }
  async getChatSessionsByUserId(userId) {
    return await db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.createdAt));
  }
  async createChatMessage(insertMessage) {
    const result = await db.insert(chatMessages).values(insertMessage).returning();
    return result[0];
  }
  async getChatMessagesBySessionId(sessionId) {
    return await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
  }
};

// server/routes.ts
init_schema();
async function registerRoutes(app2) {
  const storage = new DatabaseStorage();
  app2.post("/api/auth/login", async (req, res) => {
    try {
      console.log("\u{1F510} Auth login request:", req.body);
      const { firebaseUid, email, displayName, photoURL } = req.body;
      if (!firebaseUid || !email) {
        console.log("\u274C Missing required fields");
        return res.status(400).json({
          success: false,
          error: "Firebase UID v\xE0 email l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      console.log("\u{1F464} Existing user found:", !!user);
      if (!user) {
        const newUser = {
          firebaseUid,
          email,
          displayName: displayName || null,
          photoURL: photoURL || null
        };
        console.log("\u{1F4DD} Creating new user:", newUser);
        const validatedUser = insertUserSchema.parse(newUser);
        user = await storage.createUser(validatedUser);
        console.log("\u2705 User created successfully:", user);
      }
      console.log("\u{1F389} Login successful for user:", user.email);
      res.json({
        success: true,
        user: {
          id: user.id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      });
    } catch (error) {
      console.error("\u274C Auth error:", error);
      res.status(500).json({
        success: false,
        error: "C\xF3 l\u1ED7i x\u1EA3y ra khi x\u1EED l\xFD \u0111\u0103ng nh\u1EADp"
      });
    }
  });
  app2.post("/api/chat/send", async (req, res) => {
    try {
      const { message, subjectId, context, model, userId, sessionId } = req.body;
      console.log("\u{1F4AC} Chat request received:", {
        message: message?.substring(0, 50),
        subjectId,
        model,
        userId,
        sessionId,
        hasMessage: !!message,
        hasSubjectId: !!subjectId,
        hasUserId: !!userId
      });
      if (!message || !subjectId || !userId) {
        console.log("\u274C Missing required fields:", { message: !!message, subjectId: !!subjectId, userId: !!userId });
        return res.status(400).json({
          success: false,
          error: "Tin nh\u1EAFn, m\xF4n h\u1ECDc v\xE0 userId l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      console.log(`\u{1F4AC} Chat request for ${subjectId}:`, message);
      const { getSubjectNumericId: getSubjectNumericId2 } = await Promise.resolve().then(() => (init_subjects(), subjects_exports));
      const subjectNumericId = getSubjectNumericId2(subjectId);
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const newSession = await storage.createChatSession({
          userId: parseInt(userId),
          subjectId,
          subjectNumericId,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : "")
          // First message as title
        });
        currentSessionId = newSession.id;
        console.log(`\u{1F4DD} Created new chat session:`, currentSessionId);
      }
      await storage.createChatMessage({
        sessionId: currentSessionId,
        subjectId,
        subjectNumericId,
        content: message,
        isUser: true
      });
      let relevantContext = "";
      try {
        console.log("\u{1F50D} Starting vector search for chat message...");
        const { vectorService: vectorService2 } = await Promise.resolve().then(() => (init_vector_service(), vector_service_exports));
        const searchResults = await vectorService2.searchSimilarChunks(message, 3, subjectId);
        const qualityResults = searchResults.filter((result) => result.similarity >= 0.35);
        console.log(`\u{1F50E} Similarity check: ${searchResults.length} total, ${qualityResults.length} above threshold`);
        console.log(`\u{1F50E} Similarity scores:`, searchResults.map((r) => r.similarity.toFixed(3)));
        if (qualityResults.length > 0) {
          console.log(`\u2705 Found ${qualityResults.length} high-quality document chunks (similarity \u2265 0.35) for chat`);
          relevantContext = "\n\n\u{1F4DA} **NGUY\xCAN LI\u1EC6U T\u1EEA T\xC0I LI\u1EC6U CH\xCDNH TH\u1EE8C - \u01AFU TI\xCAN S\u1EEC D\u1EE4NG:**\n" + qualityResults.map(
            (result, index) => `
### T\xE0i li\u1EC7u ${index + 1} (\u0111\u1ED9 li\xEAn quan: ${(result.similarity * 100).toFixed(1)}%):
${result.content}`
          ).join("\n") + "\n\n\u26A0\uFE0F **L\u01AFU \xDD QUAN TR\u1ECCNG:** H\xE3y \u01B0u ti\xEAn s\u1EED d\u1EE5ng th\xF4ng tin t\u1EEB c\xE1c t\xE0i li\u1EC7u tr\xEAn. Ch\u1EC9 b\u1ED5 sung ki\u1EBFn th\u1EE9c b\xEAn ngo\xE0i khi th\u1EF1c s\u1EF1 c\u1EA7n thi\u1EBFt v\xE0 ph\u1EA3i ghi r\xF5 ngu\u1ED3n.";
        } else {
          console.log("\u{1F4ED} No relevant document chunks found for this query");
        }
      } catch (vectorError) {
        console.log("\u26A0\uFE0F Vector search failed, continuing without context:", vectorError.message);
      }
      const { getChatGPTResponse: getChatGPTResponse2 } = await Promise.resolve().then(() => (init_openai(), openai_exports));
      const enhancedContext = (context || "") + relevantContext;
      const aiResponse = await getChatGPTResponse2(message, subjectId, enhancedContext, model || "gpt-4o");
      await storage.createChatMessage({
        sessionId: currentSessionId,
        subjectId,
        subjectNumericId,
        content: aiResponse.content,
        isUser: false
      });
      console.log(`\u2705 ChatGPT response saved for session ${currentSessionId}`);
      res.json({
        success: true,
        response: aiResponse.content,
        sessionId: currentSessionId,
        subject: aiResponse.subject,
        timestamp: aiResponse.timestamp
      });
    } catch (error) {
      console.error("\u274C Chat error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "C\xF3 l\u1ED7i x\u1EA3y ra khi x\u1EED l\xFD tin nh\u1EAFn"
      });
    }
  });
  app2.get("/api/chat/sessions/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessions = await storage.getChatSessionsByUserId(parseInt(userId));
      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error("\u{1F4A5} Error getting chat sessions:", error);
      res.status(500).json({
        success: false,
        error: "C\xF3 l\u1ED7i x\u1EA3y ra khi l\u1EA5y l\u1ECBch s\u1EED chat"
      });
    }
  });
  app2.get("/api/chat/session/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessagesBySessionId(parseInt(sessionId));
      res.json({
        success: true,
        messages
      });
    } catch (error) {
      console.error("\u{1F4A5} Error getting chat messages:", error);
      res.status(500).json({
        success: false,
        error: "C\xF3 l\u1ED7i x\u1EA3y ra khi l\u1EA5y tin nh\u1EAFn"
      });
    }
  });
  app2.delete("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, error: "Invalid session ID" });
      }
      await storage.deleteChatMessagesBySession(sessionId);
      await storage.deleteChatSession(sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Error deleting chat session:", error);
      res.status(500).json({ success: false, error: "Failed to delete chat session" });
    }
  });
  app2.get("/api/drive/files", async (req, res) => {
    try {
      const folderId = req.query.folderId;
      const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
      if (!googleDriveService2.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh. Vui l\xF2ng th\xEAm GOOGLE_SERVICE_ACCOUNT_JSON v\xE0o environment variables."
        });
      }
      const files = await googleDriveService2.listFiles(folderId);
      res.json({
        success: true,
        files
      });
    } catch (error) {
      console.error("\u274C Error listing Google Drive files:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i danh s\xE1ch t\u1EC7p t\u1EEB Google Drive"
      });
    }
  });
  app2.post("/api/drive/create-folder", async (req, res) => {
    try {
      const { name, parentFolderId } = req.body;
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "T\xEAn th\u01B0 m\u1EE5c l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
      if (!googleDriveService2.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh"
        });
      }
      const folder = await googleDriveService2.createFolder(name, parentFolderId);
      res.json({
        success: true,
        folder
      });
    } catch (error) {
      console.error("\u274C Error creating folder:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA1o th\u01B0 m\u1EE5c"
      });
    }
  });
  app2.post("/api/drive/upload", async (req, res) => {
    try {
      const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
      if (!googleDriveService2.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh"
        });
      }
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
          success: false,
          error: "Kh\xF4ng c\xF3 t\u1EC7p n\xE0o \u0111\u01B0\u1EE3c t\u1EA3i l\xEAn"
        });
      }
      const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
      const folderId = req.body.folderId;
      const uploadedFiles = [];
      for (const file of files) {
        if (file && file.data) {
          const result = await googleDriveService2.uploadFile(
            file.name,
            file.data,
            folderId
          );
          uploadedFiles.push(result);
        }
      }
      res.json({
        success: true,
        files: uploadedFiles,
        message: `\u0110\xE3 t\u1EA3i l\xEAn ${uploadedFiles.length} t\u1EC7p th\xE0nh c\xF4ng`
      });
    } catch (error) {
      console.error("\u274C Error uploading files:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i l\xEAn t\u1EC7p"
      });
    }
  });
  app2.delete("/api/drive/files/:fileId", async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
      if (!googleDriveService2.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh"
        });
      }
      await googleDriveService2.deleteFile(fileId);
      res.json({
        success: true,
        message: "T\u1EC7p \u0111\xE3 \u0111\u01B0\u1EE3c x\xF3a th\xE0nh c\xF4ng"
      });
    } catch (error) {
      console.error("\u274C Error deleting file:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 x\xF3a t\u1EC7p"
      });
    }
  });
  app2.post("/api/drive/start-webdav", async (req, res) => {
    try {
      const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
      if (!googleDriveService2.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh"
        });
      }
      await googleDriveService2.startWebDAVServer();
      res.json({
        success: true,
        webdavUrl: googleDriveService2.getWebDAVUrl(),
        message: "WebDAV server \u0111\xE3 \u0111\u01B0\u1EE3c kh\u1EDFi \u0111\u1ED9ng"
      });
    } catch (error) {
      console.error("\u274C Error starting WebDAV server:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 kh\u1EDFi \u0111\u1ED9ng WebDAV server"
      });
    }
  });
  app2.post("/api/documents/process-pdf", async (req, res) => {
    try {
      const { fileId, userId, subjectId, subjectNumericId } = req.body;
      if (!fileId || !userId) {
        return res.status(400).json({
          success: false,
          error: "File ID v\xE0 User ID l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const { googleDrivePDFService: googleDrivePDFService2 } = await Promise.resolve().then(() => (init_google_drive_pdf(), google_drive_pdf_exports));
      const result = await googleDrivePDFService2.processPDFFromDrive(
        fileId,
        userId,
        subjectId,
        // Can be null - will auto-detect
        subjectNumericId
        // Can be null - will auto-detect
      );
      res.json({
        success: true,
        documentId: result.documentId,
        chunksCount: result.chunksCount,
        message: `PDF \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EED l\xFD th\xE0nh c\xF4ng v\u1EDBi ${result.chunksCount} chunks`
      });
    } catch (error) {
      console.error("\u274C Error processing PDF:", error);
      res.status(500).json({
        success: false,
        error: `Kh\xF4ng th\u1EC3 x\u1EED l\xFD PDF: ${error.message}`
      });
    }
  });
  app2.post("/api/documents/detect-subject", async (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({
          success: false,
          error: "Filename l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const { SubjectDetector: SubjectDetector2 } = await Promise.resolve().then(() => (init_subject_detector(), subject_detector_exports));
      const result = SubjectDetector2.detectSubject(filename);
      if (result) {
        const subject = SubjectDetector2.getSubjectById(result.subjectId);
        res.json({
          success: true,
          detected: true,
          subjectId: result.subjectId,
          subjectNumericId: result.subjectNumericId,
          subjectName: subject?.name,
          confidence: result.confidence
        });
      } else {
        res.json({
          success: true,
          detected: false,
          message: "Kh\xF4ng th\u1EC3 x\xE1c \u0111\u1ECBnh m\xF4n h\u1ECDc t\u1EEB t\xEAn file"
        });
      }
    } catch (error) {
      console.error("\u274C Error detecting subject:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 x\xE1c \u0111\u1ECBnh m\xF4n h\u1ECDc"
      });
    }
  });
  app2.post("/api/vector/search", async (req, res) => {
    try {
      const { query, subjectId, topK = 5 } = req.body;
      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Query l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const { vectorService: vectorService2 } = await Promise.resolve().then(() => (init_vector_service(), vector_service_exports));
      const results = await vectorService2.searchSimilarChunks(query, topK, subjectId);
      res.json({
        success: true,
        query,
        results,
        count: results.length
      });
    } catch (error) {
      console.error("\u274C Error in vector search:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\xECm ki\u1EBFm vector"
      });
    }
  });
  app2.post("/api/vector/process-all-chunks", async (req, res) => {
    try {
      const { vectorService: vectorService2 } = await Promise.resolve().then(() => (init_vector_service(), vector_service_exports));
      await vectorService2.processAllChunks();
      await vectorService2.rebuildIndex();
      const stats = await vectorService2.getEmbeddingStats();
      res.json({
        success: true,
        message: "\u0110\xE3 x\u1EED l\xFD t\u1EA5t c\u1EA3 chunks",
        stats
      });
    } catch (error) {
      console.error("\u274C Error processing all chunks:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 x\u1EED l\xFD chunks"
      });
    }
  });
  app2.get("/api/vector/stats", async (req, res) => {
    try {
      const { vectorService: vectorService2 } = await Promise.resolve().then(() => (init_vector_service(), vector_service_exports));
      const stats = await vectorService2.getEmbeddingStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error("\u274C Error getting vector stats:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 l\u1EA5y th\u1ED1ng k\xEA"
      });
    }
  });
  app2.get("/api/documents/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          error: "Document ID kh\xF4ng h\u1EE3p l\u1EC7"
        });
      }
      const { pdfProcessor: pdfProcessor2 } = await Promise.resolve().then(() => (init_pdf_processor(), pdf_processor_exports));
      const document = await pdfProcessor2.getDocumentWithChunks(documentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u"
        });
      }
      res.json({
        success: true,
        document
      });
    } catch (error) {
      console.error("\u274C Error fetching document:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i t\xE0i li\u1EC7u"
      });
    }
  });
  app2.get("/api/documents/search", async (req, res) => {
    try {
      const { query, userId, subjectId } = req.query;
      if (!query || !userId) {
        return res.status(400).json({
          success: false,
          error: "Query v\xE0 User ID l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const { pdfProcessor: pdfProcessor2 } = await Promise.resolve().then(() => (init_pdf_processor(), pdf_processor_exports));
      const results = await pdfProcessor2.searchInDocuments(
        query,
        parseInt(userId),
        subjectId
      );
      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error("\u274C Error searching documents:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\xECm ki\u1EBFm t\xE0i li\u1EC7u"
      });
    }
  });
  app2.get("/api/documents/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: "User ID kh\xF4ng h\u1EE3p l\u1EC7"
        });
      }
      const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { documents: documents2, eq: eq4 } = await import("drizzle-orm");
      const userDocuments = await db2.query.documents.findMany({
        where: eq4(documents2.userId, userId),
        orderBy: (documents3, { desc: desc2 }) => [desc2(documents3.uploadedAt)]
      });
      res.json({
        success: true,
        documents: userDocuments
      });
    } catch (error) {
      console.error("\u274C Error fetching user documents:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i danh s\xE1ch t\xE0i li\u1EC7u"
      });
    }
  });
  app2.get("/api/subjects", async (req, res) => {
    try {
      const subjects2 = [
        {
          id: "MATH_001",
          name: "To\xE1n h\u1ECDc",
          nameEn: "math",
          description: "Gi\u1EA3i to\xE1n, t\xEDnh to\xE1n nhanh, h\u1ECDc xA",
          icon: "calculator",
          gradientFrom: "from-pink-500",
          gradientTo: "to-pink-600"
        },
        {
          id: "LIT_001",
          name: "Ng\u1EEF v\u0103n",
          nameEn: "literature",
          description: "V\u0103n h\u1ECDc, ng\u1EEF ph\xE1p, t\u1EEB v\u1EF1ng, ti\u1EBFng vi\u1EC7t",
          icon: "book-open",
          gradientFrom: "from-purple-500",
          gradientTo: "to-purple-600"
        }
        // ... other subjects
      ];
      res.json({ success: true, subjects: subjects2 });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 t\u1EA3i danh s\xE1ch m\xF4n h\u1ECDc"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs4 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path3.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path4.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path4.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import fileUpload from "express-fileupload";
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  // 50MB max file size
  abortOnLimit: true
}));
app.use((req, res, next) => {
  const start = Date.now();
  const path5 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path5.startsWith("/api")) {
      let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    const { googleDriveService: googleDriveService2 } = await Promise.resolve().then(() => (init_google_drive(), google_drive_exports));
    if (googleDriveService2.isInitialized()) {
      console.log("\u{1F680} Starting WebDAV server...");
      await googleDriveService2.startWebDAVServer();
    }
  } catch (error) {
    console.log("\u26A0\uFE0F Google Drive WebDAV setup failed:", error.message);
  }
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
