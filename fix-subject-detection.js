// Script to fix subject detection for existing documents based on filename context
const { SubjectDetector } = require('./server/subject-detector.ts');
const { db } = require('./server/storage.ts');
const { documents } = require('./shared/schema.ts');

async function fixSubjectDetection() {
  console.log('🔧 Starting subject detection fix for existing documents...');
  
  try {
    // Get all documents with NULL subject info
    const documentsToFix = await db.select()
      .from(documents)
      .where(sql`subject_id IS NULL OR subject_numeric_id IS NULL`);
    
    console.log(`📊 Found ${documentsToFix.length} documents to fix`);
    
    for (const doc of documentsToFix) {
      console.log(`\n🔍 Processing: ${doc.fileName}`);
      
      // Use smart filename detection
      const detectedSubject = SubjectDetector.detectSubjectFromFilename(doc.fileName);
      
      if (detectedSubject) {
        // Update document with detected subject
        await db.update(documents)
          .set({ 
            subjectId: detectedSubject.id,
            subjectNumericId: detectedSubject.numericId
          })
          .where(eq(documents.id, doc.id));
          
        console.log(`✅ Updated Doc ${doc.id}: ${detectedSubject.name} (${detectedSubject.id})`);
      } else {
        console.log(`❌ No subject detected for: ${doc.fileName}`);
      }
    }
    
    console.log('\n✅ Subject detection fix completed!');
  } catch (error) {
    console.error('❌ Error fixing subject detection:', error);
  }
}

// Run the fix
fixSubjectDetection();