/**
 * Exercise Detector Service
 * Detects if a document is an exercise (BT) and chunks it by questions
 */

export interface ExerciseChunk {
  content: string;
  questionNumber: string | null;
  chunkType: 'standard' | 'exercise_question';
  wordCount: number;
}

export class ExerciseDetector {
  
  /**
   * Detect if document contains exercises by checking for "BT" in filename or content
   */
  static detectIsExercise(fileName: string, content: string): boolean {
    // Check filename for BT
    const fileNameUpper = fileName.toUpperCase();
    const hasBTInFileName = /\bBT\b/.test(fileNameUpper);
    
    // Check content for BT
    const contentUpper = content.toUpperCase();
    const hasBTInContent = /\bBT\b/.test(contentUpper);
    
    console.log(`📝 Exercise detection: ${fileName}`);
    console.log(`   - BT in filename: ${hasBTInFileName}`);
    console.log(`   - BT in content: ${hasBTInContent}`);
    
    return hasBTInFileName || hasBTInContent;
  }

  /**
   * Chunk exercise document by questions (Câu X:, Bài X:, etc.)
   */
  static chunkExerciseDocument(text: string): ExerciseChunk[] {
    console.log(`📚 Chunking exercise document (${text.length} chars)...`);
    
    // Exercise question patterns
    const questionPatterns = [
      // Câu patterns
      /^Câu\s+(\d+)[\.:]/m,           // Câu 1:, Câu 1.
      /^Câu\s+([^\s:\.]+)[\.:]/m,     // Câu A:, Câu I:
      
      // Bài patterns  
      /^Bài\s+(\d+)[\.:]/m,           // Bài 1:, Bài 1.
      /^Bài\s+([^\s:\.]+)[\.:]/m,     // Bài A:, Bài I:
      
      // Simple number patterns
      /^(\d+)[\.:]\s+/m,              // 1:, 1.
      /^([A-Z])[\.:]\s+/m,            // A:, B.
      
      // Question number alone
      /^(\d+)\s*$/m,                  // Just "1" on a line
      /^([A-Z])\s*$/m,                // Just "A" on a line
    ];

    // Find all question starts
    const questionStarts: Array<{ index: number; questionNumber: string; pattern: string }> = [];
    
    for (const pattern of questionPatterns) {
      let match;
      const regex = new RegExp(pattern.source, 'gm');
      while ((match = regex.exec(text)) !== null) {
        const questionNumber = match[1];
        const patternType = pattern.source.includes('Câu') ? 'Câu' : 
                           pattern.source.includes('Bài') ? 'Bài' : 'Number';
        
        questionStarts.push({
          index: match.index,
          questionNumber: questionNumber,
          pattern: patternType
        });
      }
    }

    // Sort by index
    questionStarts.sort((a, b) => a.index - b.index);
    
    console.log(`🔍 Found ${questionStarts.length} potential questions:`, 
      questionStarts.map(q => `${q.pattern} ${q.questionNumber} @ ${q.index}`));

    // If no questions found, treat as standard document
    if (questionStarts.length === 0) {
      console.log('⚠️ No question patterns found, falling back to standard chunking');
      return this.standardChunk(text);
    }

    const chunks: ExerciseChunk[] = [];
    
    // Create chunks between question markers
    for (let i = 0; i < questionStarts.length; i++) {
      const currentQuestion = questionStarts[i];
      const nextQuestion = questionStarts[i + 1];
      
      const startIndex = currentQuestion.index;
      const endIndex = nextQuestion ? nextQuestion.index : text.length;
      
      const content = text.slice(startIndex, endIndex).trim();
      
      if (content.length > 10) { // Minimum content length
        // Extract numeric part from question number
        const numericMatch = currentQuestion.questionNumber.match(/^\d+$/);
        const questionNum = numericMatch ? parseInt(currentQuestion.questionNumber, 10) : null;
        
        chunks.push({
          content: content,
          questionNumber: questionNum,
          chunkType: 'exercise_question',
          wordCount: content.split(/\s+/).length
        });
        
        console.log(`📝 Created exercise chunk: "${currentQuestion.pattern} ${currentQuestion.questionNumber}" (${content.length} chars)`);
      }
    }

    // If we have content before first question, add it as intro
    if (questionStarts.length > 0 && questionStarts[0].index > 50) {
      const introContent = text.slice(0, questionStarts[0].index).trim();
      if (introContent.length > 20) {
        chunks.unshift({
          content: introContent,
          questionNumber: null,
          chunkType: 'standard',
          wordCount: introContent.split(/\s+/).length
        });
        
        console.log(`📝 Added intro chunk (${introContent.length} chars)`);
      }
    }

    console.log(`✅ Exercise chunking complete: ${chunks.length} chunks created`);
    return chunks;
  }

  /**
   * Standard chunking for non-exercise documents
   */
  static standardChunk(text: string, maxChunkSize: number = 1000): ExerciseChunk[] {
    console.log(`📄 Standard chunking document (${text.length} chars)...`);
    
    const chunks: ExerciseChunk[] = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += maxChunkSize) {
      const chunkWords = words.slice(i, i + maxChunkSize);
      const content = chunkWords.join(' ').trim();
      
      if (content.length > 10) {
        chunks.push({
          content: content,
          questionNumber: null,
          chunkType: 'standard',
          wordCount: chunkWords.length
        });
      }
    }
    
    console.log(`✅ Standard chunking complete: ${chunks.length} chunks created`);
    return chunks;
  }

  /**
   * Main chunking method - detects type and applies appropriate chunking
   */
  static chunkDocument(fileName: string, text: string): { chunks: ExerciseChunk[]; isExercise: boolean } {
    const isExercise = this.detectIsExercise(fileName, text);
    
    let chunks: ExerciseChunk[];
    if (isExercise) {
      chunks = this.chunkExerciseDocument(text);
    } else {
      chunks = this.standardChunk(text);
    }
    
    return { chunks, isExercise };
  }
}