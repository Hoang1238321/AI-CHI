import OpenAI from "openai";

// DeepSeek API configuration using OpenAI-compatible interface
const deepseekR1 = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

const deepseekV3 = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

export interface ChatResponse {
  content: string;
  subject: string;
  timestamp: string;
  model?: string; // Track which model was used
}

export interface QueryComplexity {
  isComplex: boolean;
  reasons: string[];
  confidence: number;
}

// Advanced prompt system for Vietnamese educational AI (same as OpenAI)
const createSystemPrompt = (subjectId: string) => {
  const subject = getSubjectTeacher(subjectId);
  
  return `Bạn là ${subject.name}, một giáo viên ${subject.expertise} chuyên nghiệp tại Việt Nam. 

PHƯƠNG PHÁP BRAINSTORM VÀ TRẢ LỜI:
1. BRAINSTORM trước khi trả lời:
   - Phân tích câu hỏi có liên quan đến ${subject.expertise} không?
   - Xác định mức độ khó, kiến thức cần thiết
   - Lập kế hoạch trả lời phù hợp

2. CẤU TRÚC TRẢ LỜI CHUẨN (dành cho giải thích kiến thức):
   📚 **Lời chào & Giới thiệu**: Chào học sinh, giới thiệu chủ đề sẽ học
   🎯 **Nội dung chính**: Giải thích khái niệm, định lý, quy tắc cốt lõi
   💡 **Ví dụ minh họa**: Đưa ra ví dụ cụ thể, bài tập mẫu
   🔄 **Kết luận**: Tóm tắt điểm quan trọng
   🚀 **Mở rộng**: Đề xuất câu hỏi liên quan để học sâu hơn

3. CẤU TRÚC CHỮA BÀI TẬP (dành cho bài tập cụ thể):
   📝 **Phân tích đề**: Xác định dạng bài, yêu cầu
   📐 **Lời giải từng bước**: Hướng dẫn chi tiết, rõ ràng
   ✅ **Kiểm tra kết quả**: Đối chiếu, kiểm tra tính hợp lý
   💭 **Lưu ý**: Những điểm cần chú ý, sai lầm thường gặp

4. TẠO BẢNG BIỂU (BẮT BUỘC) khi học sinh nhắc đến:
   - "so sánh", "đặc điểm", "tính chất", "tạo bảng", "phân loại", "khác nhau", "giống nhau"
   - LUÔN tạo bảng markdown với format chuẩn:
   | Tiêu chí | [Đối tượng 1] | [Đối tượng 2] |
   |----------|---------------|---------------|
   | [Tiêu chí 1] | [Mô tả 1] | [Mô tả 2] |
   - Tối thiểu 3-5 hàng dữ liệu cho mỗi bảng

NGUYÊN TẮC ỨNG DỤNG TÀI LIỆU TỰ NHIÊN:
- **QUAN TRỌNG NHẤT**: Khi có tài liệu BÀI TẬP, COPY CHÍNH XÁC 100% PHƯƠNG PHÁP GIẢI:
  * BẮT CHƯỚC HOÀN TOÀN: từng bước giải, cấu trúc trình bày, cách tính toán, công thức cụ thể
  * GIỮ NGUYÊN: thứ tự các bước, tên gọi biến số, định dạng bảng biểu như trong tài liệu
  * CHỈ THAY ĐỔI: số liệu đầu vào để khớp với câu hỏi mới (20% → 25%, AB → CD, etc.)
  * TRÌNH BÀY như giáo viên đã thuộc lòng phương pháp này, KHÔNG nhắc tài liệu
  * NẾU có sẵn ví dụ tương tự, hãy THEO SÁT từng chi tiết trong cách giải đó
- Khi có tài liệu LÝ THUYẾT, trình bày kiến thức như hiểu biết bản thân
- **TUYỆT ĐỐI KHÔNG** nhắc đến: "Theo tài liệu", "Bài tập mẫu", "Dựa trên cách giải", "Từ tài liệu"
- Trả lời tự nhiên như một giáo viên giàu kinh nghiệm đang giảng bài
- Chỉ trả lời về ${subject.expertise}, từ chối lịch sự nếu không liên quan
- Sử dụng tiếng Việt tự nhiên, dễ hiểu
- Kết hợp emoji phù hợp để tạo sự thân thiện
- Khuyến khích học sinh đặt câu hỏi tiếp theo
- Sử dụng LaTeX cho công thức toán học: $x^2 + y^2 = z^2$ hoặc $$\\int_a^b f(x)dx$$

PHONG CÁCH: ${subject.style}`;
};

// Analyze query complexity to determine which model to use
export const analyzeQueryComplexity = (message: string): QueryComplexity => {
  const complexityIndicators = {
    // Mathematical complexity
    mathematical: [
      /phương trình.*bậc.*[3-9]/i, // higher degree equations
      /đạo hàm.*cấp.*[2-9]/i, // higher order derivatives
      /tích phân.*phức/i, // complex integrals
      /ma trận.*nghịch đảo/i, // matrix operations
      /hệ phương trình.*nhiều ẩn/i, // multiple variable systems
      /chứng minh.*quy nạp/i, // proof by induction
      /giới hạn.*vô cực/i, // limits to infinity
      /chuỗi.*hội tụ/i, // convergent series
    ],
    
    // Logical reasoning
    reasoning: [
      /tại sao.*vì sao.*như thế nào/i, // why/how questions
      /phân tích.*nguyên nhân/i, // cause analysis
      /so sánh.*đối chiếu.*khác biệt/i, // comparison analysis
      /chứng minh.*giải thích.*lý luận/i, // proof/explanation
      /đánh giá.*quan điểm/i, // evaluation
      /lập luận.*tranh luận/i, // argumentation
    ],
    
    // Problem solving
    problemSolving: [
      /bài toán.*phức tạp/i, // complex problems
      /nhiều bước.*nhiều giai đoạn/i, // multi-step solutions
      /kết hợp.*nhiều phương pháp/i, // multiple methods
      /ứng dụng.*thực tế.*thực tiễn/i, // real-world applications
      /thiết kế.*xây dựng.*tạo ra/i, // design/construction
    ],
    
    // Simple patterns (indicate V3 usage)
    simple: [
      /là gì\?/i, // what is questions
      /định nghĩa/i, // definitions
      /công thức.*đơn giản/i, // simple formulas
      /ví dụ.*cơ bản/i, // basic examples
      /tính.*đơn giản/i, // simple calculations
      /liệt kê/i, // listing
      /kể tên/i, // naming
    ]
  };

  const reasons: string[] = [];
  let complexityScore = 0;

  // Check for complex patterns
  for (const [category, patterns] of Object.entries(complexityIndicators)) {
    if (category === 'simple') continue;
    
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        reasons.push(`${category}: ${pattern.source}`);
        complexityScore += category === 'mathematical' ? 3 : 
                          category === 'reasoning' ? 2 : 1;
      }
    }
  }

  // Check for simple patterns
  const simpleMatches = complexityIndicators.simple.filter(pattern => pattern.test(message));
  if (simpleMatches.length > 0) {
    complexityScore -= simpleMatches.length * 2;
    reasons.push(`simple patterns detected: ${simpleMatches.length}`);
  }

  // Message length factor
  if (message.length > 200) {
    complexityScore += 1;
    reasons.push('long message');
  }

  // Question count factor
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount > 2) {
    complexityScore += 1;
    reasons.push('multiple questions');
  }

  const isComplex = complexityScore >= 2;
  const confidence = Math.min(0.9, Math.abs(complexityScore) * 0.2 + 0.5);

  return {
    isComplex,
    reasons,
    confidence
  };
};

// Generate instruction for vector self-evaluation
function generateVectorEvaluationPrompt(): string {
  return `💡 **HƯỚNG DẪN TỰ ĐÁNH GIÁ VECTOR:** 
TRƯỚC KHI TRẢ LỜI - BẠN PHẢI:

1. **ĐÁNH GIÁ CÁC VECTOR ĐƯỢC CUNG CẤP:**
   - Xem xét từng đoạn tài liệu trong context
   - Xác định đoạn nào thực sự liên quan NHẤT đến câu hỏi của học sinh
   - Chọn đoạn có độ liên quan cao nhất làm cơ sở chính cho câu trả lời

2. **XÁC ĐỊNH LOẠI VECTOR ĐƯỢC CHỌN:**
   - Nếu đoạn được chọn là BÀI TẬP/EXERCISE → trả lời theo phong cách bài tập (học phương pháp giải)
   - Nếu đoạn được chọn là LÝ THUYẾT thường → trả lời theo phong cách lý thuyết

3. **QUY TẮC TRẢ LỜI:**
   - DỰA VÀO: đoạn vector được đánh giá liên quan nhất
   - KHÔNG nhắc đến việc đánh giá vector hay tài liệu
   - Trả lời tự nhiên như giáo viên chuyên môn
   - Chỉ đánh dấu bài tập KHI vector được chọn thực sự là bài tập`;
}

// Fast V3 response for simple queries with vector evaluation
export async function getDeepSeekV3Response(
  message: string, 
  subjectId: string,
  context?: string,
  maxSimilarity?: number
): Promise<ChatResponse> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createSystemPrompt(subjectId);

    const response = await deepseekV3.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: context 
            ? `${context}\n\n📝 **Câu hỏi của học sinh:** ${message}\n\n${generateVectorEvaluationPrompt()}` 
            : message
        }
      ],
      max_tokens: 1200,
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ DeepSeek V3');
    }

    return {
      content,
      subject: teacher.name,
      timestamp: new Date().toISOString(),
      model: 'DeepSeek V3'
    };

  } catch (error) {
    console.error('DeepSeek V3 API Error:', error);
    throw new Error('Có lỗi xảy ra khi kết nối với DeepSeek V3. Vui lòng thử lại sau.');
  }
}

// Hybrid Chat System - automatically chooses between V3 (fast) and R1 (complex)
export async function getHybridDeepSeekResponse(
  message: string, 
  subjectId: string,
  context?: string,
  maxSimilarity?: number
): Promise<ChatResponse & { complexity: QueryComplexity }> {
  try {
    // Analyze query complexity
    const complexity = analyzeQueryComplexity(message);
    
    let response: ChatResponse;
    
    if (complexity.isComplex) {
      response = await getDeepSeekR1Response(message, subjectId, context, maxSimilarity);
      response.model = 'DeepSeek R1 (Complex)';
    } else {
      response = await getDeepSeekV3Response(message, subjectId, context, maxSimilarity);
      response.model = 'DeepSeek V3 (Simple)';
    }
    
    return {
      ...response,
      complexity
    };
    
  } catch (error) {
    console.error('Hybrid DeepSeek API Error:', error);
    
    // Fallback to V3 if R1 fails
    if (error.message.includes('R1')) {
      const fallbackResponse = await getDeepSeekV3Response(message, subjectId, context, maxSimilarity);
      fallbackResponse.model = 'DeepSeek V3 (Fallback)';
      
      return {
        ...fallbackResponse,
        complexity: analyzeQueryComplexity(message)
      };
    }
    
    throw new Error('Có lỗi xảy ra với hệ thống AI hybrid. Vui lòng thử lại sau.');
  }
}

// Subject-specific teacher personalities and expertise  
const getSubjectTeacher = (subjectId: string) => {
  const teachers = {
    'MATH_001': {
      name: 'Thầy Minh - Giáo viên Toán',
      expertise: 'Toán học (đại số, hình học, giải tích, xác suất thống kê)',
      style: 'Giải thích từng bước một cách logic, rõ ràng với nhiều ví dụ thực tế'
    },
    'LIT_001': {
      name: 'Cô Lan - Giáo viên Ngữ văn',
      expertise: 'Ngữ văn (văn học Việt Nam, phân tích tác phẩm, kỹ năng viết, ngữ pháp)',
      style: 'Kết hợp cảm xúc và phân tích, sử dụng nhiều câu chuyện minh họa'
    },
    'ENG_001': {
      name: 'Cô Linh - Giáo viên Tiếng Anh',
      expertise: 'Tiếng Anh (ngữ pháp, từ vựng, kỹ năng giao tiếp, luyện thi)',
      style: 'Học tương tác với ví dụ thực tế, giải thích bằng tiếng Việt dễ hiểu'
    },
    'HIS_001': {
      name: 'Thầy Tuấn - Giáo viên Lịch sử',
      expertise: 'Lịch sử (lịch sử Việt Nam, lịch sử thế giới, các sự kiện quan trọng)',
      style: 'Kể lịch sử như những câu chuyện thú vị, liên hệ quá khứ với hiện tại'
    },
    'GEO_001': {
      name: 'Cô Hường - Giáo viên Địa lý',
      expertise: 'Địa lý (địa lý tự nhiên, địa lý kinh tế, khí hậu, địa hình)',
      style: 'Sử dụng bản đồ, hình ảnh và so sánh để giúp học sinh hình dung rõ ràng'
    },
    'BIO_001': {
      name: 'Thầy Khang - Giáo viên Sinh học',
      expertise: 'Sinh học (sinh học tế bào, sinh học cơ thể, thực vật, động vật)',
      style: 'Giải thích bằng hiện tượng đời sống, kết hợp hình ảnh minh họa'
    },
    'PHY_001': {
      name: 'Thầy Hùng - Giáo viên Vật lý',
      expertise: 'Vật lý (cơ học, điện học, quang học, nhiệt học, vật lý hiện đại)',
      style: 'Bắt đầu từ hiện tượng thực tế, giải thích bằng lý thuyết và công thức'
    },
    'CHE_001': {
      name: 'Cô Mai - Giáo viên Hóa học',
      expertise: 'Hóa học (hóa vô cơ, hóa hữu cơ, hóa phân tích, phản ứng hóa học)',
      style: 'Kết hợp lý thuyết với thí nghiệm và ứng dụng trong đời sống'
    }
  };
  
  return teachers[subjectId] || teachers['MATH_001'];
};

// Q&A Chat using DeepSeek-R1 with vector evaluation
export async function getDeepSeekR1Response(
  message: string, 
  subjectId: string,
  context?: string,
  maxSimilarity?: number
): Promise<ChatResponse> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createSystemPrompt(subjectId);

    const response = await deepseekR1.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: context 
            ? `${context}\n\n📝 **Câu hỏi của học sinh:** ${message}\n\n${generateVectorEvaluationPrompt()}` 
            : message
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ DeepSeek R1');
    }

    return {
      content,
      subject: teacher.name,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('DeepSeek R1 API Error:', error);
    throw new Error('Có lỗi xảy ra khi kết nối với DeepSeek R1. Vui lòng thử lại sau.');
  }
}

// Video Chat using DeepSeek-R1 with vector evaluation
export async function getDeepSeekR1ResponseForVideo(
  message: string, 
  subjectId: string,
  transcriptContext?: string,
  maxSimilarity?: number
): Promise<ChatResponse> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createVideoSystemPrompt(subjectId);

    const userContent = transcriptContext 
      ? `${transcriptContext}\n\n📝 **Câu hỏi về video:** ${message}\n\n${generateVectorEvaluationPrompt()}`
      : `📹 **Câu hỏi về video môn ${teacher.name}:** ${message}\n\n💡 **Lưu ý:** Hiện chưa có nội dung transcript cụ thể. Hãy trả lời dựa trên kiến thức chung về chủ đề và khuyến khích học sinh tải video lên để có trợ giúp tốt hơp.`;

    const response = await deepseekR1.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: userContent
        }
      ],
      max_tokens: 1800,
      temperature: 0.6,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ DeepSeek R1');
    }

    return {
      content,
      subject: `${teacher.name} (Video)`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('DeepSeek R1 Video API Error:', error);
    throw new Error('Có lỗi xảy ra khi kết nối với DeepSeek R1 cho video chat. Vui lòng thử lại sau.');
  }
}

// Document Analysis using DeepSeek-R1
export async function analyzeDocumentWithDeepSeekR1(
  documentContent: string,
  subjectId: string
): Promise<{ summary: string; keyPoints: string[]; subject: string }> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    
    const systemPrompt = `Bạn là ${teacher.name}, chuyên gia phân tích tài liệu học tập.
    
NHIỆM VỤ: Phân tích tài liệu ${teacher.expertise} và tạo tóm tắt học tập.

ĐỊNH DẠNG PHẢN HỒI (JSON):
{
  "summary": "Tóm tắt nội dung chính của tài liệu",
  "keyPoints": ["Điểm chính 1", "Điểm chính 2", "Điểm chính 3"],
  "subject": "${teacher.name}"
}

YÊU CẦU:
- Tóm tắt ngắn gọn, dễ hiểu
- Trích xuất 3-5 điểm quan trọng nhất
- Sử dụng tiếng Việt tự nhiên
- Tập trung vào kiến thức có thể áp dụng`;

    const response = await deepseekR1.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Hãy phân tích tài liệu sau:\n\n${documentContent}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ DeepSeek R1');
    }

    return JSON.parse(content);

  } catch (error) {
    console.error('DeepSeek R1 Document Analysis Error:', error);
    throw new Error('Có lỗi xảy ra khi phân tích tài liệu với DeepSeek R1.');
  }
}

// Subject Detection using DeepSeek-V3


/**
 * Check if query is irrelevant/nonsensical
 */
export function isIrrelevantQuery(query: string): boolean {
  const trimmedQuery = query.trim().toLowerCase();
  
  // Check for very short nonsensical queries
  if (trimmedQuery.length <= 2) {
    return true;
  }
  
  // Check for patterns of irrelevant content
  const irrelevantPatterns = [
    /^[0-9]+$/, // Only numbers
    /^[a-z]$/, // Single letters
    /^[!@#$%^&*()_+=\-\[\]{}|\\:";'<>?,./]*$/, // Only special characters
    /^(a+|e+|i+|o+|u+|y+)$/i, // Repeated vowels
    /^(test|testing|123|abc|xyz|hello|hi|hey)$/i, // Common test words
    /^(ád|ưe|ơi|êu|ây|òi)$/i, // Vietnamese interjections
    /^(haha|hehe|lol|wow|ok|ko|kg|cm|mm)$/i, // Chat speak
  ];
  
  return irrelevantPatterns.some(pattern => pattern.test(trimmedQuery));
}



export async function detectSubjectWithDeepSeekV3(filename: string): Promise<{
  subjectId: string;
  confidence: number;
  subjectName: string;
}> {
  try {
    const systemPrompt = `Bạn là AI chuyên phân loại môn học từ tên file tiếng Việt.

DANH SÁCH MÔN HỌC:
- MATH_001: Toán học (từ khóa: toán, đại số, hình học, giải tích, tích phân, đạo hàm, phương trình)
- LIT_001: Ngữ văn (từ khóa: văn, văn học, thơ, truyện, tác phẩm, Nguyễn Du, Nam Cao)
- ENG_001: Tiếng Anh (từ khóa: english, anh, grammar, vocabulary, listening, speaking)
- HIS_001: Lịch sử (từ khóa: lịch sử, chiến tranh, cách mạng, triều đại, sự kiện lịch sử)
- GEO_001: Địa lý (từ khóa: địa lý, bản đồ, khí hậu, địa hình, dân số, kinh tế)
- BIO_001: Sinh học (từ khóa: sinh, sinh học, tế bào, ADN, gen, protein, thực vật, động vật, nhiễm sắc thể, đột biến)
- PHY_001: Vật lý (từ khóa: vật lý, cơ học, điện, quang, dao động, sóng)
- CHE_001: Hóa học (từ khóa: hóa, hóa học, phản ứng, axit, bazơ, hữu cơ, vô cơ)

ĐỊNH DẠNG PHẢN HỒI (JSON):
{
  "subjectId": "MATH_001",
  "confidence": 0.85,
  "subjectName": "Toán học"
}

Phân tích tên file và trả về môn học phù hợp nhất với độ tin cậy.`;

    const response = await deepseekV3.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Tên file: "${filename}"`
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ DeepSeek V3');
    }

    return JSON.parse(content);

  } catch (error) {
    console.error('DeepSeek V3 Subject Detection Error:', error);
    // Fallback to default
    return {
      subjectId: 'MATH_001',
      confidence: 0.1,
      subjectName: 'Toán học'
    };
  }
}

// Create video-specific system prompt
function createVideoSystemPrompt(subjectId: string): string {
  const teacher = getSubjectTeacher(subjectId);
  
  return `Bạn là **${teacher.name} AI Video Assistant** - chuyên gia giảng dạy ${teacher.expertise} qua video học tập.

🎬 **VAI TRÒ CỦA BẠN:**
- Trợ giảng AI chuyên về nội dung video môn ${teacher.expertise}
- Giải thích các khái niệm dựa trên nội dung video transcript
- Hỗ trợ học sinh hiểu sâu hơn về bài giảng video

📹 **NGUYÊN TẮC TRẢ LỜI VIDEO:**
1. **Ưu tiên transcript**: Luôn dựa chủ yếu trên nội dung transcript video khi có
2. **Trích dẫn cụ thể**: Dùng "Theo video..." hoặc "Trong đoạn video..." khi tham khảo transcript
3. **Giải thích trực quan**: Mô tả như đang giảng bài qua video, sống động và cụ thể
4. **Hỗ trợ học tập**: Đưa ra ví dụ, so sánh, và câu hỏi củng cố kiến thức

📝 **ĐỊNH DẠNG TRẢ LỜI:**
- Sử dụng markdown với **bold** và *italic* 
- Tạo danh sách rõ ràng với bullet points
- Dùng emoji phù hợp để tạo sự thân thiện
- Chia nhỏ thông tin thành các phần dễ hiểu

🎯 **MỤC TIÊU:** Giúp học sinh hiểu rõ nội dung video và vận dụng kiến thức ${teacher.expertise} hiệu quả.

Hãy trả lời bằng tiếng Việt, phong cách thân thiện nhưng chuyên nghiệp như một giáo viên video.`;
}