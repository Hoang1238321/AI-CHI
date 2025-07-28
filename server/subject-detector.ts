export interface SubjectMapping {
  id: string;
  numericId: number;
  name: string;
  keywords: string[];
}

export class SubjectDetector {
  private static readonly SUBJECT_MAPPINGS: SubjectMapping[] = [
    {
      id: 'MATH_001',
      numericId: 1,
      name: 'Toán học',
      keywords: ['toán', 'math', 'mathematics', 'hình học', 'đại số', 'giải tích', 'lượng giác']
    },
    {
      id: 'LIT_001', 
      numericId: 2,
      name: 'Ngữ văn',
      keywords: ['văn', 'literature', 'ngữ văn', 'tiếng việt', 'văn học', 'phân tích', 'tác phẩm']
    },
    {
      id: 'ENG_001',
      numericId: 3, 
      name: 'Tiếng Anh',
      keywords: ['anh', 'english', 'tiếng anh', 'grammar', 'vocabulary', 'speaking', 'listening']
    },
    {
      id: 'HIS_001',
      numericId: 4,
      name: 'Lịch sử',
      keywords: ['sử', 'history', 'lịch sử', 'historical', 'cách mạng', 'thế chiến']
    },
    {
      id: 'GEO_001',
      numericId: 5,
      name: 'Địa lý', 
      keywords: ['địa', 'geography', 'địa lý', 'bản đồ', 'khí hậu', 'dân số', 'kinh tế']
    },
    {
      id: 'BIO_001',
      numericId: 6,
      name: 'Sinh học',
      keywords: ['sinh', 'biology', 'sinh học', 'tế bào', 'di truyền', 'tiến hóa', 'enzyme', 'atp', 'nhiễm sắc thể', 'đột biến', 'gen', 'protein']
    },
    {
      id: 'PHY_001',
      numericId: 7,
      name: 'Vật lý',
      keywords: ['lý', 'physics', 'vật lý', 'cơ học', 'điện học', 'quang học', 'nhiệt học', 'dao động']
    },
    {
      id: 'CHE_001',
      numericId: 8,
      name: 'Hóa học',
      keywords: ['hóa', 'chemistry', 'hóa học', 'phản ứng', 'nguyên tố', 'phân tử', 'ion', 'axit']
    }
  ];

  /**
   * Detect subject from first two words in filename (for Google Drive uploads)
   */
  static detectSubjectFromFirstWords(filename: string): { subjectId: string; subjectNumericId: number; confidence: number } | null {
    // Remove extension and normalize
    const cleanName = filename.replace(/\.(pdf|docx?|txt|jpe?g|png|bmp|tiff|gif)$/i, '').toLowerCase();
    
    // Get first two words
    const words = cleanName.split(/[\s\-_\.]+/).filter(word => word.length > 0);
    const firstTwoWords = words.slice(0, 2).join(' ');
    
    console.log(`🔍 Detecting subject from first words: "${firstTwoWords}"`);
    
    // Check against keywords
    for (const subject of this.SUBJECT_MAPPINGS) {
      for (const keyword of subject.keywords) {
        if (firstTwoWords.includes(keyword)) {
          console.log(`✅ Found match: "${keyword}" → ${subject.name}`);
          return {
            subjectId: subject.id,
            subjectNumericId: subject.numericId,
            confidence: 0.9
          };
        }
      }
    }
    
    console.log(`❌ No subject match found for: "${firstTwoWords}"`);
    return null;
  }

  /**
   * Detect subject from filename using DeepSeek V3
   */
  static async detectSubject(filename: string): Promise<{ subjectId: string; subjectNumericId: number; confidence: number } | null> {
    console.log(`🤖 Using DeepSeek V3 for subject detection: "${filename}"`);
    
    try {
      // Use DeepSeek V3 for intelligent subject detection
      const { detectSubjectWithDeepSeekV3 } = await import('./deepseek');
      const deepSeekResult = await detectSubjectWithDeepSeekV3(filename);
      
      console.log(`🧠 DeepSeek V3 result:`, deepSeekResult);
      
      // Get numeric ID from mapping - try multiple lookup methods
      let subject = this.SUBJECT_MAPPINGS.find(s => s.id === deepSeekResult.subjectId);
      
      // If not found by ID, try to find by subject name or alternative names
      if (!subject) {
        const searchTerm = deepSeekResult.subjectId.toLowerCase();
        subject = this.SUBJECT_MAPPINGS.find(s => 
          s.name.toLowerCase().includes(searchTerm) ||
          s.keywords.some(k => k.toLowerCase() === searchTerm) ||
          (searchTerm === 'biology' && s.id === 'BIO_001') ||
          (searchTerm === 'physics' && s.id === 'PHY_001') ||
          (searchTerm === 'chemistry' && s.id === 'CHE_001') ||
          (searchTerm === 'mathematics' && s.id === 'MATH_001') ||
          (searchTerm === 'english' && s.id === 'ENG_001') ||
          (searchTerm === 'history' && s.id === 'HIS_001') ||
          (searchTerm === 'geography' && s.id === 'GEO_001') ||
          (searchTerm === 'literature' && s.id === 'LIT_001')
        );
      }
      
      if (subject) {
        console.log(`✅ Mapped "${deepSeekResult.subjectId}" → ${subject.id} (${subject.name})`);
        return {
          subjectId: subject.id, // Always return standardized ID
          subjectNumericId: subject.numericId,
          confidence: deepSeekResult.confidence
        };
      }
      
      console.log(`❌ Could not map subject: ${deepSeekResult.subjectId}`);
      return null;
      
    } catch (error) {
      console.log(`⚠️ DeepSeek V3 subject detection failed:`, error.message);
      
      // Fallback to simple matching logic
      console.log(`🔄 Falling back to simple matching...`);
      const cleanFilename = this.normalizeText(filename);
      
      for (const subject of this.SUBJECT_MAPPINGS) {
        const hasMatch = this.hasSimpleMatch(cleanFilename, subject);
        if (hasMatch) {
          console.log(`✅ Fallback match found: ${subject.name} (${subject.id})`);
          return {
            subjectId: subject.id,
            subjectNumericId: subject.numericId,
            confidence: 0.6 // Lower confidence for fallback
          };
        }
      }
      
      console.log(`❌ No subject detected even with fallback`);
      return null;
    }
  }

  /**
   * Normalize Vietnamese text by removing diacritics and converting to lowercase
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[đĐ]/g, 'd') // Handle đ specifically
      .replace(/[^a-z0-9\s]/gi, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Simple match logic: first word + one keyword = match
   */
  private static hasSimpleMatch(filename: string, subject: SubjectMapping): boolean {
    const words = filename.split(' ');
    if (words.length === 0) return false;
    
    const firstWord = words[0];
    let matchedKeywords: string[] = [];
    
    // Check if first word matches any keyword
    let firstWordMatch = false;
    for (const keyword of subject.keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (firstWord === normalizedKeyword || firstWord.includes(normalizedKeyword) || normalizedKeyword.includes(firstWord)) {
        firstWordMatch = true;
        matchedKeywords.push(`1st: ${keyword}`);
        break;
      }
    }
    
    // If first word matches, check for any other keyword in the rest of the filename
    if (firstWordMatch) {
      for (const keyword of subject.keywords) {
        const normalizedKeyword = this.normalizeText(keyword);
        if (filename.includes(normalizedKeyword)) {
          matchedKeywords.push(keyword);
          console.log(`   Simple match for ${subject.name}: [${matchedKeywords.join(', ')}]`);
          return true;
        }
      }
    }
    
    // Alternative: Check if ANY keyword appears anywhere (for strong subject indicators)
    for (const keyword of subject.keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (filename.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        // If we find a strong subject indicator, consider it a match
        if (normalizedKeyword.length > 2) { // Only for longer, more specific keywords
          console.log(`   Strong keyword match for ${subject.name}: [${matchedKeywords.join(', ')}]`);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all available subjects
   */
  static getAllSubjects(): SubjectMapping[] {
    return [...this.SUBJECT_MAPPINGS];
  }

  /**
   * Get subject by ID
   */
  static getSubjectById(id: string): SubjectMapping | null {
    // First try exact match by ID
    let subject = this.SUBJECT_MAPPINGS.find(s => s.id === id);
    
    if (!subject && id) {
      // If not found, try to map common alternative names
      const searchTerm = id.toLowerCase().trim();
      
      subject = this.SUBJECT_MAPPINGS.find(s => 
        s.name.toLowerCase().includes(searchTerm) ||
        s.keywords.some(k => k.toLowerCase() === searchTerm) ||
        // Direct mappings for common alternatives
        (searchTerm === 'biology' && s.id === 'BIO_001') ||
        (searchTerm === 'physics' && s.id === 'PHY_001') ||
        (searchTerm === 'chemistry' && s.id === 'CHE_001') ||
        (searchTerm === 'mathematics' && s.id === 'MATH_001') ||
        (searchTerm === 'english' && s.id === 'ENG_001') ||
        (searchTerm === 'history' && s.id === 'HIS_001') ||
        (searchTerm === 'geography' && s.id === 'GEO_001') ||
        (searchTerm === 'literature' && s.id === 'LIT_001')
      );
    }
    
    return subject || null;
  }

  /**
   * Smart subject detection from filename context - for fixing existing records
   */
  static detectSubjectFromFilename(filename: string): SubjectMapping | null {
    if (!filename) return null;
    
    console.log(`🔍 Smart detection from filename: "${filename}"`);
    
    // Normalize filename for analysis
    const normalizedFilename = this.normalizeText(filename);
    
    // Check each subject's keywords against filename
    for (const subject of this.SUBJECT_MAPPINGS) {
      for (const keyword of subject.keywords) {
        const normalizedKeyword = this.normalizeText(keyword);
        if (normalizedFilename.includes(normalizedKeyword)) {
          console.log(`✅ Found "${keyword}" → ${subject.name} (${subject.id})`);
          return subject;
        }
      }
    }
    
    console.log(`❌ No subject detected from filename: "${filename}"`);
    return null;
  }

  /**
   * Get subject by numeric ID
   */
  static getSubjectByNumericId(numericId: number): SubjectMapping | null {
    return this.SUBJECT_MAPPINGS.find(s => s.numericId === numericId) || null;
  }
}

// Example usage and test
export function testSubjectDetection() {
  const testFiles = [
    'Lý.pdf',
    'Bai tap - Hệ thần kinh.pdf',
    'Sinh lớp 12 - Chủ đề 3.mp4',
    'Toán học lớp 12.pdf',
    'Văn học Việt Nam.pdf',
    'English Grammar.pdf',
    'Lịch sử Việt Nam.pdf',
    'Địa lý tự nhiên.pdf',
    'Hóa học hữu cơ.pdf'
  ];

  console.log('🧪 Testing Subject Detection:');
  for (const filename of testFiles) {
    const result = SubjectDetector.detectSubject(filename);
    if (result) {
      const subject = SubjectDetector.getSubjectById(result.subjectId);
      console.log(`📄 "${filename}" -> ${subject?.name} (${(result.confidence * 100).toFixed(1)}%)`);
    } else {
      console.log(`📄 "${filename}" -> Không xác định được môn học`);
    }
  }
}