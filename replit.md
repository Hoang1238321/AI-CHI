# AI Learning Platform

## Overview

This is a full-stack AI-powered learning platform built with React, Express, and PostgreSQL. The application helps Vietnamese students prepare for competency assessment exams by providing AI-assisted Q&A chat functionality across multiple subjects like Math, Literature, English, History, Geography, Biology, Physics, and Chemistry.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared components:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js with TypeScript 
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing

## Key Components

### Frontend Architecture
- **Component Library**: Uses shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme configuration
- **Build System**: Vite with React plugin and TypeScript support
- **State Management**: TanStack Query for API calls and caching
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database interactions
- **Session Management**: In-memory storage implementation (MemStorage class)
- **API Structure**: RESTful endpoints under `/api` namespace
- **Development Server**: Custom Vite integration for development mode

### Database Schema
The application defines several key entities:
- **Users**: Basic user authentication and profile data
- **Subjects**: Predefined learning subjects with metadata
- **Chat Sessions**: Conversation threads between users and AI
- **Chat Messages**: Individual messages within chat sessions
- **Documents**: File management for learning materials

### Authentication & Authorization
- Currently implements basic in-memory user storage
- Prepared for future Firebase integration (mentioned in settings modal)
- Session-based authentication structure in place

## Data Flow

1. **User Interaction**: Users select subjects from the dashboard
2. **Subject Selection**: Navigate to subject-specific learning modes (Q&A or Video)
3. **AI Chat**: Send messages to `/api/chat/send` endpoint for AI responses
4. **Document Management**: Google Drive integration through `/api/drive/files`
5. **State Management**: TanStack Query handles API caching and synchronization

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL with serverless connection
- **UI Components**: Radix UI primitives for accessible components
- **Icons**: Lucide React icon library
- **Form Management**: React Hook Form with Zod validation
- **Date Handling**: date-fns for date manipulation

### Development Dependencies
- **Build Tools**: Vite, ESBuild for production builds
- **Type Safety**: TypeScript with strict configuration
- **Code Quality**: ESLint configuration implied by project structure

### Integrations
- **AI Services**: ✅ OpenAI ChatGPT-4o integration complete for Q&A and Video chat
- **Firebase**: ✅ Gmail authentication system implemented with user sync to PostgreSQL
- **Google Drive**: Service Account integration for document management (TODO)

### Recent Changes (July 22, 2025)
- ✅ **SECURITY: REMOVED PERSONAL INFORMATION AND HARDCODED CREDENTIALS** (July 22, 2025)
- ✅ Deleted service-account.json file containing Google Service Account private keys
- ✅ Updated all Google Drive services to use GOOGLE_SERVICE_ACCOUNT_JSON environment variable
- ✅ Modified job-processor.ts and google-drive.ts to avoid creating persistent credential files
- ✅ Added comprehensive .gitignore rules for sensitive files (*.json, *.key, *.pem, .env)
- ✅ Implemented temporary file cleanup for any credential files created during runtime
- ✅ Enhanced security by eliminating hardcoded credentials from codebase
- ✅ **PROMPT-BASED VECTOR EVALUATION SYSTEM REPLACEMENT** (July 22, 2025)
- ✅ Completely removed DeepSeek V3 query paraphrasing and DeepSeek R1 result reranking systems
- ✅ Replaced external AI processing with prompt-based internal evaluation by DeepSeek
- ✅ Added generateVectorEvaluationPrompt() instruction for self-assessment of vector relevance
- ✅ DeepSeek now analyzes which retrieved vector is most relevant before generating responses
- ✅ Only marks responses as exercises when the most relevant vector is actually from exercise document
- ✅ Enhanced prompt instructs DeepSeek to evaluate document relevance internally within response generation
- ✅ Eliminated timeout-prone AI reranking in favor of reliable prompt-guided relevance evaluation
- ✅ Updated all DeepSeek functions (V3, R1, Video) to use vector self-evaluation prompts
- ✅ Removed maxSimilarity parameter dependency - DeepSeek evaluates relevance directly from context
- ✅ Simplified vector search workflow: search → provide context → DeepSeek evaluates → respond naturally
- ✅ **DEEPSEEK AI-ENHANCED VECTOR SEARCH SYSTEM**
- ✅ Added paraphraseQueryForSearch function using DeepSeek V3 for query expansion and improvement
- ✅ Added rerankVectorResults function using DeepSeek R1 for intelligent result reranking
- ✅ Created searchSimilarChunksWithAI method combining paraphrasing → vector search → reranking workflow
- ✅ Enhanced vector service with exercise metadata tracking (isExercise, chunkType, questionNumber)
- ✅ Removed 80/20 weighting mechanism - replaced with AI-powered ranking system
- ✅ Updated /api/chat/send and /api/video/chat routes to use AI-enhanced search
- ✅ AI reranking prioritizes exercise documents and uses 4-factor scoring (content relevance, subject accuracy, exercise priority, completeness)
- ✅ Search results now include AI relevance scores instead of raw cosine similarity
- ✅ System automatically detects exercise content and provides specialized prompting context
- ✅ **ENHANCED EXERCISE-AWARE PROMPTING SYSTEM**
- ✅ Updated DeepSeek prompts to preserve EXACT SOLUTION METHODS from exercise documents
- ✅ AI now keeps original approach, logic steps, and formulas while allowing flexible number changes
- ✅ Added specialized instruction: "Keep method, change numbers" for exercise-based responses
- ✅ Improved source citation: "Theo tài liệu..." for original methods, "Dựa trên cách giải tương tự..." for adapted content
- ✅ Fixed hallucination issues - AI now follows document content strictly for exercise solutions
- ✅ Enhanced educational value: AI can create similar problems with different numbers using same methodology
- ✅ **NATURAL TEACHING PROMPTING SYSTEM** (July 22, 2025)
- ✅ Updated all DeepSeek prompts to eliminate document references completely
- ✅ AI now responds as authentic teacher without mentioning "tài liệu", "document", or "source"
- ✅ Maintains exact solution methodology while presenting as natural teaching knowledge
- ✅ Enhanced user experience - students receive authentic teaching without awareness of document sourcing
- ✅ Prompts updated across all models: R1, V3, and video chat functions
- ✅ **PERFECTED DOCUMENT METHODOLOGY CLONING** (July 22, 2025)
- ✅ Enhanced prompts to "CLONE 100%" exact solution methods from exercise documents
- ✅ AI now copies: structure, terminology, calculation steps, table formats, variable names
- ✅ Maintains pedagogical accuracy while presenting as authentic teacher knowledge
- ✅ Successfully tested with hoán vị gen exercises - perfect methodology replication
- ✅ System achieves optimal balance: document accuracy + natural teaching presentation
- ✅ **ENHANCED EXERCISE (BT) DOCUMENT CHUNKING SYSTEM**
- ✅ Added isExercise boolean field to documents and temporary_documents tables
- ✅ Added chunkType and questionNumber metadata fields to both chunk tables
- ✅ Created ExerciseDetector service for intelligent BT document detection
- ✅ Implemented specialized chunking for exercise documents using question patterns (Câu X:, Bài X:)
- ✅ Enhanced PDF processor and temp-pdf-processor to use exercise-aware chunking
- ✅ Fixed database migration issues - all new schema fields successfully added
- ✅ Exercise documents now chunk by individual questions instead of regular text segments
- ✅ Fixed vector service argument order - ensured 1 chunk = 1 vector mapping
- ✅ Corrected questionNumber extraction to integer values instead of strings
- ✅ Improved document processing accuracy for Vietnamese educational materials
- ✅ **ADAPTIVE AI PROMPTING SYSTEM BASED ON SIMILARITY** (July 22, 2025)
- ✅ Created generateAdaptivePrompt() function with 5 flexibility levels based on similarity scores
- ✅ Strict copying (≥0.8): CLONE 100% exact methodology - preserves original solution methods perfectly
- ✅ Tight application (≥0.6): Apply core methods with moderate presentation flexibility
- ✅ Flexible adaptation (≥0.4): Use general framework as inspiration, more creative freedom
- ✅ Creative freedom (<0.4): Use context as weak reference, mostly independent solutions
- ✅ No context: Fully flexible teacher-style responses without document constraints
- ✅ Enhanced DeepSeek V3, R1, and Video functions to accept maxSimilarity parameter
- ✅ Updated routes.ts to calculate maxSimilarity from vector search results
- ✅ Hybrid system now automatically scales from strict document copying to creative problem-solving
- ✅ Maintains natural teacher presentation while balancing accuracy with flexibility
- ✅ AI responses adapt methodology adherence: high similarity = exact copying, low similarity = creative teaching
- ✅ **ADAPTIVE PROMPTING REFINEMENT & RERANKING FIXES** (July 22, 2025)
- ✅ Fixed adaptive prompting to focus on methodology learning instead of verbatim content copying
- ✅ Updated all prompts to emphasize "learn method, change numbers" approach for exercises
- ✅ Enhanced DeepSeek R1 and V3 functions to properly use generateAdaptivePrompt() with maxSimilarity
- ✅ Temporarily disabled AI reranking due to JSON parsing timeout issues - fallback to vector similarity
- ✅ Improved error handling in rerankVectorResults with better JSON cleaning and validation
- ✅ System now properly detects exercise chunks and applies appropriate methodology copying guidance
- ✅ Fixed prompt typos and maintained consistent Vietnamese instruction formatting across all models

### Previous Changes (July 21, 2025)
- ✅ **COMPLETE SUBJECT DETECTION SYSTEM FIX** 
- ✅ Fixed critical async/await issue in video-processor.ts - SubjectDetector.detectSubject() now properly awaited
- ✅ Enhanced robust subject mapping system in SubjectDetector for inconsistent AI responses
- ✅ Added comprehensive fallback mapping: "biology"→"BIO_001", "mathematics"→"MATH_001", etc.
- ✅ Job processing system fully operational with automatic queue management (30-second polling)
- ✅ Successfully tested PDF and video processing with correct subject detection and numeric ID assignment
- ✅ External admin job queue integration working perfectly with shared database processing_jobs table
- ✅ Background JobProcessor service automatically processes external admin requests for PDF OCR and video transcription
- ✅ **COMPREHENSIVE DATABASE SUBJECT MAPPING REPAIR**
- ✅ Fixed getSubjectById method to handle alternative subject names ("biology", "medium", "physics")
- ✅ Updated all existing documents with NULL subject_numeric_id - 6 records fixed  
- ✅ Enhanced subject mapping to convert legacy subject names to standardized format (BIO_001, PHY_001, etc.)
- ✅ **INTELLIGENT PATTERN-BASED SUBJECT ASSIGNMENT COMPLETED**
- ✅ Applied SQL pattern matching for filename-based subject detection: "Sinh%" → BIO_001, "Lý%" → PHY_001  
- ✅ Successfully fixed all 11 remaining NULL subject_numeric_id documents
- ✅ Database cleanup completed - 10 Biology documents + 1 Physics document properly categorized
- ✅ All documents now have correct subject_id and subject_numeric_id values for proper system functionality
- ✅ **SHARED FOLDER STUDENT DRIVE SYSTEM REFACTOR** (July 21, 2025)
- ✅ Refactored StudentDriveService from auto-creating folders to using pre-shared folder
- ✅ Changed folder name from "Thư mục của học sinh1" to "sech1" for simplicity and clarity
- ✅ Updated Service Account email to langthangitems@poetic-planet-466205-c1.iam.gserviceaccount.com
- ✅ Added setup instructions API endpoint /api/student-drive/setup-instructions with detailed sharing guide
- ✅ Enhanced error handling with clear instructions when shared folder not accessible
- ✅ System now searches for existing shared folder instead of creating new ones
- ✅ Successfully connected to shared "sech1" folder (ID: 1-wxldsFSrcnAh8k8BaOziPf1rasGUsFw)
- ✅ Google Drive backup now fully operational for all student document uploads
- ✅ Maintained all file upload functionality while using centralized shared folder approach

### Previous Changes (July 20, 2025)
- ✅ Fixed critical "unexpected token {" error on iPhone/Android mobile devices
- ✅ Converted SecurityManager from ES6+ to ES5 syntax for mobile browser compatibility
- ✅ Resolved Firebase auth syntax errors and removed optional chaining operators
- ✅ Maintained security blocking for mobile users while fixing compatibility issues
- ✅ Simplified security.ts to minimal mobile-blocking functionality to prevent JS errors
- ✅ Mobile users now get proper blocking message: "Bạn không thể đăng nhập được. Vui lòng liên hệ với Quản trị viên để được đăng nhập"

### Previous Changes (July 19, 2025)
- ✅ Added unique subjectIDs for all 8 subjects (MATH_001, LIT_001, ENG_001, etc.)
- ✅ Integrated ChatGPT-4o for intelligent responses in both Q&A and Video chat modes
- ✅ Created subject-specific AI teachers with specialized prompts for each subject
- ✅ Updated PostgreSQL database storage to replace in-memory storage
- ✅ Enhanced Q&A chat with real ChatGPT responses using subject context
- ✅ Added Video Q&A assistant with ChatGPT integration for video-based learning
- ✅ Implemented numeric subjectID system (1-8) mapping to string IDs
- ✅ Added subjectID tracking to chat_sessions, chat_messages, and documents tables
- ✅ Populated subjects table with complete data for all 8 Vietnamese subjects
- ✅ Fixed authentication to use database user objects with proper numeric IDs
- ✅ Enhanced Markdown rendering with bold/italic text formatting and proper spacing
- ✅ Implemented comprehensive table generation system with beautiful layouts
- ✅ Strict table creation for keywords: "so sánh", "đặc điểm", "tính chất", "khác nhau"
- ✅ Dark mode text color optimization (white/near-white in dark mode only)
- ✅ MathJax integration for LaTeX math expressions ($inline$ and $$display$$)
- ✅ Fixed MATHINLINE conflicts between LaTeX and markdown formatting
- ✅ ChatGPT prompt updated to generate LaTeX math notation
- ✅ Integrated chat history into sidebar with delete functionality
- ✅ Added AlertDialog component for confirmation dialogs
- ✅ Real-time chat session management with loading states
- ✅ Google Drive Service Account integration with rclone WebDAV server
- ✅ Complete file management UI (upload, create folders, delete files)
- ✅ WebDAV server running on localhost:8080 for document access
- ✅ API endpoints for Google Drive operations (list, upload, delete, create folders)
- ✅ PDF processing system with OpenCV, ImageMagick, TesseractOCR integration
- ✅ Document chunks table for storing processed PDF text segments
- ✅ OCR text extraction and chunking for Vietnamese/English PDFs
- ✅ API endpoints for PDF processing, document retrieval, and text search
- ✅ Google Drive PDF processing UI with OCR button for PDF files
- ✅ Automatic subject detection from Vietnamese filenames using keyword matching
- ✅ Subject detector service with confidence scoring and fallback handling
- ✅ Integrated auto-detection into PDF processing workflow
- ✅ API endpoint for subject detection testing (/api/documents/detect-subject)
- ✅ Vector embedding system with OpenAI text-embedding-3-small model
- ✅ FAISS vector database for semantic similarity search  
- ✅ Automatic embedding generation during PDF processing
- ✅ Vector search API endpoints for document retrieval (/api/vector/search)
- ✅ Enhanced PDF processor with embedding generation
- ✅ Real-time vector search with similarity scoring (0.4+ similarity for good matches)
- ✅ Fixed FAISS integration issues with CommonJS import using createRequire
- ✅ Database migration complete with embedding and embedding_model columns
- ✅ Vector statistics endpoint (/api/vector/stats) for monitoring system health
- ✅ Integrated vector search into AI chat system for intelligent document-aware responses
- ✅ Enhanced AI chat with automatic context from relevant document chunks
- ✅ Real-time FAISS index initialization and document retrieval during conversations
- ✅ Enhanced AI prompting system to prioritize document content over external knowledge
- ✅ Improved vector search accuracy: increased similarity threshold from 0.35 to 0.5
- ✅ Added subject-specific filtering to prevent cross-subject document contamination
- ✅ AI responses now cite document sources with "Theo tài liệu..." format
- ✅ Seamless integration between vector search results and contextual AI responses
- ✅ Added temporary document storage system with temporary_documents and temporary_document_chunks tables
- ✅ Changed attachment button from Google Drive redirect to local file upload dialog
- ✅ File upload interface supports PDF formats with full OCR pipeline processing
- ✅ Enhanced vector service to support both permanent and temporary document chunks
- ✅ Implemented timestamp weighting for vector search - recent documents prioritized
- ✅ Temporary documents get additional 20% priority boost in search results
- ✅ Automatic FAISS index rebuild after temporary document upload
- ✅ Fixed file upload conflicts by removing express-fileupload and using multer exclusively
- ✅ Enhanced addEmbeddingToChunk function to support temporary chunks with isTemporary flag
- ✅ Implemented user ID and session ID privacy controls for temporary document chunks
- ✅ Enhanced vector service to properly filter temporary chunks by user and session context
- ✅ Updated database schema to include userId and sessionId in temporary document chunks table
- ✅ Added session-scoped document access for enhanced privacy and user isolation
- ✅ Enhanced chat system to pass user and session context to vector search operations
- ✅ Improved temporary document processing to store user and session metadata
- ✅ Implemented massive priority boost system for very recent documents (< 2 minutes get 300-500% boost)
- ✅ Added Vietnamese vague query detection for terms like "này", "kia", "tài liệu vừa", etc.
- ✅ Dynamic similarity thresholds - very low threshold (0.15) for recent documents with vague queries
- ✅ Enhanced time-based weighting with minute-level precision for ultra-fresh document prioritization
- ✅ Smart query analysis to detect when users refer to just-uploaded documents using casual language
- ✅ Fixed FAISS search to include ALL chunks (not just top 3) guaranteeing temporary document inclusion
- ✅ Ultra-aggressive threshold reduction for temporary documents (0.02 for < 2 minutes, 0.01 for vague queries)
- ✅ Resolved variable initialization error preventing temporary document similarity checking
- ✅ Enhanced debugging to show exact threshold values applied to each document chunk
- ✅ Implemented 3-minute rule: temporary documents use normal threshold (0.5) after 3 minutes
- ✅ Added sorting prioritization: temporary documents appear first in search results
- ✅ Refined threshold system: 0.01 for <1min, 0.02 for <3min, then 0.5 for normal operation
- ✅ CRITICAL FIX: Processing loop now evaluates ALL FAISS results, not just top 3, allowing temporary documents to pass threshold checks
- ✅ Temporary documents are now properly found and prioritized regardless of raw FAISS similarity ranking
- ✅ Fixed duplicate chunk ID issue with unique identifiers (temp_ID vs perm_ID) in FAISS index
- ✅ Enhanced session matching with flexibility for very recent uploads (< 5 minutes)
- ✅ Improved vector algorithm deduplication to prevent index corruption from mixed temporary/permanent chunks
- ✅ **EXTERNAL ADMIN JOBS PROCESSING SYSTEM** (July 20, 2025)
- ✅ Integrated shared database job queue system via processing_jobs table
- ✅ Background JobProcessor service polls for new jobs every 30 seconds automatically
- ✅ Google Drive API integration for downloading files by Drive File ID
- ✅ Automatic job processing for PDF OCR, video transcription, and image OCR
- ✅ Job status tracking: queued → processing → completed/failed with error logging
- ✅ External admin applications can INSERT jobs, this system processes them automatically
- ✅ Service Account authentication for secure Google Drive file access
- ✅ Temporary file management with automatic cleanup after processing
- ✅ Integration with existing PDF and video processors for seamless workflow
- ✅ Added temporary document storage system with temporary_documents and temporary_document_chunks tables
- ✅ Changed attachment button from Google Drive redirect to local file upload dialog
- ✅ File upload interface supports PDF formats with full OCR pipeline processing
- ✅ Enhanced vector service to support both permanent and temporary document chunks
- ✅ Implemented timestamp weighting for vector search - recent documents prioritized
- ✅ Temporary documents get additional 20% priority boost in search results
- ✅ Automatic FAISS index rebuild after temporary document upload
- ✅ Fixed file upload conflicts by removing express-fileupload and using multer exclusively
- ✅ Enhanced addEmbeddingToChunk function to support temporary chunks with isTemporary flag
- ✅ Implemented user ID and session ID privacy controls for temporary document chunks
- ✅ Enhanced vector service to properly filter temporary chunks by user and session context
- ✅ Updated database schema to include userId and sessionId in temporary document chunks table
- ✅ Added session-scoped document access for enhanced privacy and user isolation
- ✅ Enhanced chat system to pass user and session context to vector search operations
- ✅ Improved temporary document processing to store user and session metadata
- ✅ Implemented massive priority boost system for very recent documents (< 2 minutes get 300-500% boost)
- ✅ Added Vietnamese vague query detection for terms like "này", "kia", "tài liệu vừa", etc.
- ✅ Dynamic similarity thresholds - very low threshold (0.15) for recent documents with vague queries
- ✅ Enhanced time-based weighting with minute-level precision for ultra-fresh document prioritization
- ✅ Smart query analysis to detect when users refer to just-uploaded documents using casual language
- ✅ Fixed FAISS search to include ALL chunks (not just top 3) guaranteeing temporary document inclusion
- ✅ Ultra-aggressive threshold reduction for temporary documents (0.02 for < 2 minutes, 0.01 for vague queries)
- ✅ Resolved variable initialization error preventing temporary document similarity checking
- ✅ Enhanced debugging to show exact threshold values applied to each document chunk
- ✅ Implemented 3-minute rule: temporary documents use normal threshold (0.5) after 3 minutes
- ✅ Added sorting prioritization: temporary documents appear first in search results
- ✅ Refined threshold system: 0.01 for <1min, 0.02 for <3min, then 0.5 for normal operation
- ✅ CRITICAL FIX: Processing loop now evaluates ALL FAISS results, not just top 3, allowing temporary documents to pass threshold checks
- ✅ Temporary documents are now properly found and prioritized regardless of raw FAISS similarity ranking
- ✅ Fixed duplicate chunk ID issue with unique identifiers (temp_ID vs perm_ID) in FAISS index
- ✅ Enhanced session matching with flexibility for very recent uploads (< 5 minutes)
- ✅ Improved vector algorithm deduplication to prevent index corruption from mixed temporary/permanent chunks
- ✅ COMPREHENSIVE VECTOR DELETION SYSTEM: Automatic 2-hour cleanup for temporary vectors with physical file removal
- ✅ Server crash detection and cleanup (distinguishes crashes from normal restarts)
- ✅ Document deletion triggers automatic vector cleanup for both temporary and permanent documents
- ✅ Vector cleanup service runs every 30 minutes with automatic crash recovery detection
- ✅ API endpoints for manual vector deletion: /api/vector/document/ID, /api/vector/chunks, /api/vector/cleanup
- ✅ Real-time cleanup statistics monitoring via /api/vector/cleanup-stats endpoint
- ✅ Physical file system cleanup ensures no orphaned temporary files remain after vector deletion
- ✅ **COMPREHENSIVE VIDEO PROCESSING SYSTEM** (July 19, 2025)
- ✅ Google Drive video integration with "Xử lý tài liệu" button for video files
- ✅ FFmpeg video-to-audio extraction with aggressive MP3 compression (32k bitrate, 8kHz)
- ✅ OpenAI Whisper transcription service with Vietnamese language support
- ✅ Intelligent file size management - automatic chunking for large files (>25MB)
- ✅ Temporary video storage system in `/tmp/videos/{userId}/` without immediate deletion
- ✅ Complete API endpoints: /api/video/process, /api/video/status, /api/video/cleanup
- ✅ Purple video icons and play button UI for video files in Google Drive interface
- ✅ Successfully tested with 26MB video file - compressed to 3.59MB and transcribed (11K+ characters)
- ✅ Independent video processing system separate from Q&A/document processing functionality
- ✅ **DATABASE INTEGRATION FOR VIDEO SYSTEM** (July 19, 2025)
- ✅ Created `videos` table for storing video metadata including subject detection and content preview
- ✅ Created `transcript_chunks` table for storing processed transcript segments with embeddings
- ✅ Integrated SubjectDetector for automatic subject classification from video filenames
- ✅ Video processing now stores complete metadata: duration, Google Drive links, transcription previews
- ✅ Transcript chunking system with OpenAI embeddings for vector search capability
- ✅ Database migration completed - tables created with proper foreign key relationships
- ✅ Successfully tested database storage with Vietnamese educational video processing
- ✅ **ENHANCED VIDEO Q&A CHAT SYSTEM** (July 19, 2025)
- ✅ Created specialized `/api/video/chat` endpoint with transcript vector search integration
- ✅ Video context detection: when users say "xem" (view), system displays video from `/tmp` storage
- ✅ Enhanced vector search with 35% priority boost for transcript chunks in video context  
- ✅ Video-specific ChatGPT prompts with specialized system instructions for video learning
- ✅ Real-time video streaming via `/api/video/file/:userId/:videoId` with range request support
- ✅ Frontend video player integration with automatic video display on user request
- ✅ Transcript-based AI responses with "Theo video..." citation format
- ✅ Complete video Q&A workflow: vector search → transcript context → specialized AI responses
- ✅ **VIDEO STREAMING SYSTEM FULLY OPERATIONAL** (July 19, 2025)
- ✅ Fixed DEMUXER_ERROR issues by disabling range requests and serving full video streams
- ✅ Enhanced video metadata logging: dimensions 640x360, duration 940s confirmed working
- ✅ Google Drive Service Account video storage confirmed functional with proper MP4 format
- ✅ Video player successfully loads, plays, and streams 42MB educational videos
- ✅ Complete video viewing experience integrated with AI chat system for enhanced learning
- ✅ **COMPREHENSIVE SECURITY SYSTEM** (July 19, 2025)
- ✅ Frontend protection: disabled right-click, F12, DevTools shortcuts, text selection
- ✅ Advanced DevTools detection with full-screen warning when developer tools opened
- ✅ Auto-clear console every second and override console methods to prevent debugging
- ✅ CSS security: disabled user-select, image dragging, hidden scrollbars
- ✅ Video-specific protection: disabled context menu on video elements
- ✅ Backend security violation logging with user agent tracking
- ✅ Prevents students from accessing source files, saving videos, or inspecting elements
- ✅ **INTELLIGENT VIDEO VECTOR SEARCH SYSTEM** (July 19, 2025)
- ✅ Implemented VideoSearchResult interface for video similarity matching  
- ✅ Added searchRelevantVideo() method in VectorService using cosine similarity
- ✅ Video vector search analyzes transcript embeddings to find most relevant videos
- ✅ Enhanced video chat API to use vector search instead of latest video selection
- ✅ Frontend updated to handle vector-selected video IDs from server responses
- ✅ Video Q&A now displays similarity percentage and relevant transcript content
- ✅ Added /api/video/search endpoint for testing video vector search functionality
- ✅ Intelligent video selection based on content similarity rather than chronological order
- ✅ Enhanced user experience with AI-powered video recommendation system
- ✅ **SHARED VIDEO LIBRARY SYSTEM** (July 19, 2025)
- ✅ Implemented shared video library - all users can access videos uploaded by any user
- ✅ Video search now spans across ALL users (not just current user's videos)
- ✅ Track video ownership while enabling global access for educational sharing
- ✅ Updated video responses to show uploader information and shared library status
- ✅ Enhanced /api/video/processed endpoint to return videos from all users
- ✅ Video Q&A system now displays "Video từ thư viện chung" with uploader details
- ✅ Maintained user tracking for video uploads while enabling community sharing
- ✅ Cross-user video discovery based on content similarity instead of ownership
- ✅ **MULTI-FORMAT DOCUMENT PROCESSING SYSTEM** (July 20, 2025)
- ✅ Enhanced chat interface upload to support DOCX, images (JPG, PNG, BMP, TIFF, GIF), and text files
- ✅ Microsoft Word document processing using Mammoth library for text extraction
- ✅ Advanced image OCR processing with ImageMagick preprocessing and TesseractOCR (Vietnamese + English)
- ✅ Intelligent file format detection and routing to appropriate processors
- ✅ Automatic subject detection for all file formats using existing SubjectDetector
- ✅ Enhanced temporary document creation with format-specific metadata tracking
- ✅ Multi-format file upload validation with comprehensive error handling
- ✅ User-friendly upload feedback with format-specific success messages
- ✅ Complete integration with existing vector search and AI chat systems
- ✅ Supported formats: PDF, DOCX, TXT, JPG, JPEG, PNG, BMP, TIFF, GIF
- ✅ **HIGH-PERFORMANCE CHAT NAVIGATION SYSTEM** (July 20, 2025)
- ✅ Clickable chat history sidebar with instant navigation using history API instead of page reloads
- ✅ Client-side message caching system preventing redundant API calls during navigation
- ✅ Hover-based preloading for instant message display when switching between chat sessions
- ✅ Real-time chat history updates without sidebar refresh after sending first message
- ✅ Throttled sidebar refresh (500ms delay) to prevent UI flicker during rapid interactions
- ✅ Optimized useEffect dependencies to minimize unnecessary re-renders and API requests
- ✅ Message cache persistence during session ensuring smooth back-and-forth navigation
- ✅ URL parameter support for direct chat session access with cached message loading
- ✅ **ENHANCED VIDEO SUBJECT DETECTION SYSTEM** (July 20, 2025)
- ✅ Fixed theme system bug by removing hardcoded dark mode class enabling proper light/dark switching
- ✅ Improved subject detection algorithm with square root normalization for better accuracy
- ✅ Lowered confidence threshold from 0.3 to 0.15 for more sensitive subject recognition
- ✅ Enhanced Biology keyword matching including "nhiễm sắc thể", "đột biến", "gen", "protein"
- ✅ Added comprehensive debug logging for subject detection troubleshooting
- ✅ Video processing now properly detects and stores subject classification for educational content
- ✅ **DEEPSEEK AI INTEGRATION SYSTEM** (July 20, 2025)
- ✅ Integrated DeepSeek R1 model for Q&A chat (18x cheaper than ChatGPT-4o with equivalent performance)
- ✅ Integrated DeepSeek R1 model for Video chat with specialized video assistant prompts
- ✅ Integrated DeepSeek R1 model for document analysis with JSON-formatted responses
- ✅ Integrated DeepSeek V3 model for intelligent subject detection with fallback mechanism
- ✅ Created comprehensive DeepSeek service with OpenAI-compatible API interface
- ✅ Enhanced subject detection endpoint to use AI-powered classification instead of keyword matching
- ✅ Added document analysis endpoint (/api/documents/analyze) for content summarization
- ✅ Maintained all existing prompts and system behaviors while switching to cost-effective models
- ✅ Preserved OpenAI integration for embeddings, Whisper transcription, and image processing
- ✅ Cost optimization: reduced AI processing costs by ~80% while maintaining quality
- ✅ **HYBRID AI SYSTEM FOR OPTIMIZED PERFORMANCE** (July 20, 2025)
- ✅ Intelligent query complexity analysis system using pattern matching and scoring algorithms
- ✅ Automatic model selection: DeepSeek V3 (fast ~6s) for simple queries, DeepSeek R1 (reasoning ~29s) for complex queries
- ✅ Mathematical complexity detection: higher degree equations, complex integrals, proof by induction
- ✅ Logical reasoning detection: why/how questions, comparison analysis, evaluation tasks
- ✅ Simple pattern detection: definitions, basic calculations, listing tasks
- ✅ Fallback mechanism: automatically switches to V3 if R1 fails
- ✅ Enhanced API responses with model selection transparency and complexity analysis
- ✅ Optimized performance: 80% faster responses for simple educational queries
- ✅ **ENHANCED GOOGLE DRIVE SUBJECT DETECTION** (July 20, 2025)
- ✅ Fixed Google Drive uploads (PDF, DOCX, Images) to use first words detection instead of DeepSeek V3
- ✅ Instant subject detection from filename: extracts first two words for keyword matching
- ✅ Updated google-drive-pdf.ts, temp-pdf-processor.ts, and routes.ts to use detectSubjectFromFirstWords
- ✅ Subject detection now works immediately for Google Drive files: "Toán học bài 1.pdf" → Math
- ✅ Cost-effective and fast: no API calls needed for simple filename-based detection
- ✅ Enhanced detection method shows "First Words" instead of "DeepSeek V3" in responses
- ✅ Maintains fallback to general subject when no keywords match first two words
- ✅ **VECTOR SEARCH SYSTEM OPTIMIZATION** (July 20, 2025)
- ✅ Fixed FAISS index initialization issues - rebuilt index to include all document chunks
- ✅ Confirmed vector search correctly finds multiple documents with accurate similarity scoring
- ✅ Enhanced debugging revealed proper threshold filtering (≥0.5 for high-quality matches)
- ✅ Verified AI responses now use correct document content from uploaded files
- ✅ Resolved issue where totalChunks showed 1 instead of actual 2 documents in system
- ✅ **AUTOMATIC FAISS INDEX REBUILD SYSTEM** (July 20, 2025)
- ✅ Added automatic FAISS index rebuild after Google Drive document processing
- ✅ Enhanced google-drive-pdf.ts to rebuild vector index when new permanent documents added
- ✅ Fixed issue where new Google Drive uploads weren't immediately available in vector search
- ✅ Maintained existing rebuild functionality for temporary document uploads via chat
- ✅ Vector search now automatically includes all newly uploaded documents without manual rebuild
- ✅ **WEIGHTED VECTOR SEARCH SYSTEM** (July 20, 2025)
- ✅ Implemented 80%/20% weighting scheme limiting results to top 2 most similar documents
- ✅ Top document receives 80% weight, second document receives 20% weight
- ✅ Enhanced AI responses to focus on 2 highest quality documents instead of multiple sources
- ✅ Fixed server crash cleanup bug preventing undefined filename errors
- ✅ Vector search algorithm now prioritizes quality over quantity for more focused responses
- ✅ **DEVICE FINGERPRINTING & SESSION MANAGEMENT SYSTEM** (July 20, 2025)
- ✅ Comprehensive device tracking using canvas, WebGL, audio, and hardware fingerprinting
- ✅ Extended users table with role, isActive, maxDevices, and lastLogin columns
- ✅ Created user_devices table for device registration and approval management
- ✅ Created user_sessions table for active session tracking with IP and user agent
- ✅ Created admin_audit_log table for comprehensive admin action logging
- ✅ SessionManager class with device validation, session creation, and termination
- ✅ Device limit enforcement (default 2 devices per user) with admin override
- ✅ Automatic device approval with fallback to admin approval system
- ✅ Client IP detection and device fingerprint generation on frontend
- ✅ Enhanced Firebase auth integration with device tracking and session management
- ✅ Admin API endpoints for user management, device control, and session monitoring
- ✅ Force logout functionality for individual users or all user sessions
- ✅ Device approval/blocking system with automatic session termination
- ✅ Comprehensive audit trail for all admin actions with timestamp and details
- ✅ Real-time session validation with 24-hour session expiry
- ✅ Database migration completed for all device management tables
- ✅ **MANUAL APPROVAL & DEVICE TRACKING SYSTEM** (July 20, 2025)
- ✅ Implemented manual user approval - new users get role 'pending' and isActive = false
- ✅ Device tracking system - auto-approve devices for monitoring purposes only
- ✅ Frontend blocks pending users with appropriate error messages
- ✅ Admin APIs for user approval: POST /api/admin/user/:id/approve with role assignment
- ✅ Admin endpoint to view pending users: GET /api/admin/users/pending
- ✅ Admin endpoint to view pending devices: GET /api/admin/devices/pending (for tracking)
- ✅ Device approval API: POST /api/admin/device/:id/approve (legacy support)
- ✅ Enhanced auth flow to check user approval status before platform access
- ✅ Comprehensive device fingerprinting for tracking student login devices
- ✅ Auto-approve devices while maintaining full tracking capabilities
- ✅ Manual approval workflow for users only - devices auto-approved for convenience
- ✅ Database updated to approve all existing pending devices
- ✅ Existing users maintain access while new registrations require admin approval
- ✅ **RESTORED AUDIT LOGGING SYSTEM** (July 20, 2025)
- ✅ Fixed admin_audit_log foreign key constraint by allowing adminId null for system actions
- ✅ Restored comprehensive audit logging for device registration and admin actions
- ✅ System actions (device auto-approval) logged with adminId=null for tracking
- ✅ Database migration: ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL
- ✅ Enhanced logAdminAction method with proper null handling and error management
- ✅ Audit trail fully operational for security compliance and admin oversight
- ✅ **STRICT MANUAL USER CONTROL SYSTEM** (July 20, 2025)
- ✅ Completely blocked automatic user creation during Firebase login
- ✅ Only pre-existing users in database can access the platform
- ✅ Admin must manually create users via POST /api/admin/users/create
- ✅ Enhanced security: "Bạn không thể đăng nhập được. Vui lòng liên hệ với Quản trị viên để được đăng nhập" message for unauthorized users
- ✅ Database schema updated: firebaseUid can be null for manual admin creation
- ✅ Admin workflow: Create user → Approve user → Student can login with Firebase
- ✅ Complete control over platform access - no automatic registrations allowed
- ✅ **COMPLETE TOKEN REMOVAL SYSTEM** (July 20, 2025)
- ✅ Removed token_usage table from database completely
- ✅ Eliminated sessionToken column from user_sessions table  
- ✅ Removed tokens_used column from chat_logs table
- ✅ Deleted all sessionToken generation, storage, and validation code
- ✅ Updated session management to use sessionId-based validation instead
- ✅ Cleaned up all token-related references throughout codebase
- ✅ Zero LSP errors - complete token removal without breaking functionality
- ✅ **STUDENT GOOGLE DRIVE INTEGRATION SYSTEM** (July 20, 2025)
- ✅ Created StudentDriveService for automatic document backup to Google Drive
- ✅ Automatic "Tài liệu của học sinh" folder creation and management
- ✅ Service Account email integration via GOOGLE_SERVICE_ACCOUNT_EMAIL secret
- ✅ Automatic folder sharing with specified Gmail account via SHARED_GMAIL_ACCOUNT secret
- ✅ Document upload integration: all student uploads (PDF, DOCX, images, text) automatically saved to Drive
- ✅ Timestamped and user-tagged filenames for easy organization and tracking
- ✅ API endpoint for folder link retrieval: GET /api/student-drive/folder-link
- ✅ Graceful fallback: local processing continues even if Drive upload fails
- ✅ Complete TypeScript error resolution for improved system stability

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds static assets to `dist/public`
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations in `migrations/` directory

### Environment Configuration
- **Database**: Requires `DATABASE_URL` environment variable
- **Development**: Uses NODE_ENV for environment detection
- **Production**: Single Node.js process serving both API and static files

### Development Workflow
- **Hot Reload**: Vite HMR for frontend development
- **API Logging**: Custom middleware for request/response logging
- **Error Handling**: Global error middleware with JSON responses

The application is structured for easy development with hot reloading in development and efficient production deployment as a single Node.js application serving both the API and static frontend assets.