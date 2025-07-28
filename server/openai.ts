import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface ChatResponse {
  content: string;
  subject: string;
  timestamp: string;
}

// Advanced prompt system for Vietnamese educational AI
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

NGUYÊN TẮC ƯU TIÊN TÀI LIỆU:
- **QUAN TRỌNG NHẤT**: Khi có tài liệu liên quan, BẮT BUỘC dựa vào nội dung tài liệu làm nguồn chính
- Trích dẫn trực tiếp từ tài liệu khi có thể
- Chỉ bổ sung kiến thức bên ngoài khi tài liệu chưa đủ thông tin
- Luôn ghi rõ nguồn: "Theo tài liệu..." hoặc "Bổ sung thêm..."
- Chỉ trả lời về ${subject.expertise}, từ chối lịch sự nếu không liên quan
- Sử dụng tiếng Việt tự nhiên, dễ hiểu
- Kết hợp emoji phù hợp để tạo sự thân thiện
- Khuyến khích học sinh đặt câu hỏi tiếp theo
- Sử dụng LaTeX cho công thức toán học: $x^2 + y^2 = z^2$ hoặc $$\\int_a^b f(x)dx$$

PHONG CÁCH: ${subject.style}`;
};

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

export async function getChatGPTResponse(
  message: string, 
  subjectId: string,
  context?: string,
  model: string = "gpt-4o"
): Promise<ChatResponse> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createSystemPrompt(subjectId);

    const response = await openai.chat.completions.create({
      model: model as "gpt-4o" | "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: context 
            ? `${context}\n\n📝 **Câu hỏi của học sinh:** ${message}\n\n💡 **Hướng dẫn trả lời:** Hãy trả lời dựa trên tài liệu ở trên làm chủ yếu. Nếu tài liệu chưa đủ thông tin, bổ sung kiến thức bên ngoài nhưng ghi rõ nguồn.` 
            : message
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ ChatGPT');
    }

    return {
      content,
      subject: teacher.name,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Có lỗi xảy ra khi kết nối với ChatGPT. Vui lòng thử lại sau.');
  }
}

// Video-specific ChatGPT response with enhanced prompting
export async function getChatGPTResponseForVideo(
  message: string, 
  subjectId: string,
  transcriptContext?: string,
  model: string = "gpt-4o"
): Promise<ChatResponse> {
  try {
    const teacher = getSubjectTeacher(subjectId);
    const systemPrompt = createVideoSystemPrompt(subjectId);

    const userContent = transcriptContext 
      ? `${transcriptContext}\n\n📝 **Câu hỏi về video:** ${message}\n\n💡 **Hướng dẫn trả lời:** Dựa chủ yếu trên nội dung transcript video ở trên. Giải thích theo ngữ cảnh video và trích dẫn cụ thể các phần trong transcript. Nếu cần bổ sung kiến thức, hãy ghi rõ "Theo tài liệu video..." hoặc "Bổ sung kiến thức:"`
      : `📹 **Câu hỏi về video môn ${teacher.name}:** ${message}\n\n💡 **Lưu ý:** Hiện chưa có nội dung transcript cụ thể. Hãy trả lời dựa trên kiến thức chung về chủ đề và khuyến khích học sinh tải video lên để có trợ giúp tốt hơn.`;

    const response = await openai.chat.completions.create({
      model: model as "gpt-4o" | "gpt-3.5-turbo",
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
      temperature: 0.6, // Slightly lower for more focused video responses
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Không nhận được phản hồi từ ChatGPT');
    }

    return {
      content,
      subject: `${teacher.name} (Video)`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('OpenAI Video API Error:', error);
    throw new Error('Có lỗi xảy ra khi kết nối với ChatGPT cho video chat. Vui lòng thử lại sau.');
  }
}

// Create video-specific system prompt
function createVideoSystemPrompt(subjectId: string): string {
  const teacher = getSubjectTeacher(subjectId);
  
  return `Bạn là ${teacher.emoji} **${teacher.name} AI Video Assistant** - chuyên gia giảng dạy ${teacher.name} qua video học tập.

🎬 **VAI TRÒ CỦA BẠN:**
- Trợ giảng AI chuyên về nội dung video môn ${teacher.name}
- Giải thích các khái niệm dựa trên nội dung video transcript
- Hỗ trợ học sinh hiểu sâu hơn về bài giảng video

📹 **NGUYÊN TẮC TRFẢ LỜI VIDEO:**
1. **Ưu tiên transcript**: Luôn dựa chủ yếu trên nội dung transcript video khi có
2. **Trích dẫn cụ thể**: Dùng "Theo video..." hoặc "Trong đoạn video..." khi tham khảo transcript
3. **Giải thích trực quan**: Mô tả như đang giảng bài qua video, sống động và cụ thể
4. **Hỗ trợ học tập**: Đưa ra ví dụ, so sánh, và câu hỏi củng cố kiến thức

📝 **ĐỊNH DẠNG TRẢ LỜI:**
- Sử dụng markdown với **bold** và *italic* 
- Tạo danh sách rõ ràng với bullet points
- Dùng emoji phù hợp với ${teacher.name}: ${teacher.emoji}
- Chia nhỏ thông tin thành các phần dễ hiểu

🎯 **MỤC TIÊU:** Giúp học sinh hiểu rõ nội dung video và vận dụng kiến thức ${teacher.name} hiệu quả.

Hãy trả lời bằng tiếng Việt, phong cách thân thiện nhưng chuyên nghiệp như một giáo viên video.`;
}