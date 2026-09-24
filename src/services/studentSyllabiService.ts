import { supabase } from '../lib/supabase';
import { ExtractedChapter, SubjectType } from '../types';

export interface StudentSyllabusRecord {
  id: string;
  studentId: string;
  classLevel: string;
  subject: string;
  fileName: string;
  filePath?: string;
  fileUrl?: string;
  processingStatus: 'uploaded' | 'processing' | 'processed' | 'failed';
  extractedData?: {
    chapters: ExtractedChapter[];
    rawText?: string;
  };
  uploadedAt: string;
  extractedAt?: string;
}

const LOCAL_STORAGE_KEY = 'gurumitra_student_syllabi';

function getLocalSyllabi(): Record<string, StudentSyllabusRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSyllabi(data: Record<string, StudentSyllabusRecord>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save syllabus to localStorage:', err);
  }
}

function buildRecordKey(studentId: string, classLevel: string, subject: string): string {
  return `${studentId}_${classLevel.toLowerCase().replace(/\s+/g, '_')}_${subject.toLowerCase()}`;
}

/**
 * Saves or updates a student syllabus record
 */
export async function saveStudentSyllabus(record: Omit<StudentSyllabusRecord, 'id' | 'uploadedAt'> & { id?: string }): Promise<StudentSyllabusRecord> {
  const fullRecord: StudentSyllabusRecord = {
    id: record.id || `syl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentId: record.studentId,
    classLevel: record.classLevel,
    subject: record.subject,
    fileName: record.fileName,
    filePath: record.filePath,
    fileUrl: record.fileUrl,
    processingStatus: record.processingStatus,
    extractedData: record.extractedData,
    uploadedAt: new Date().toISOString(),
    extractedAt: record.extractedAt
  };

  // Always update local cache for instant UI responsiveness and offline fallback
  const localData = getLocalSyllabi();
  const key = buildRecordKey(record.studentId, record.classLevel, record.subject);
  localData[key] = fullRecord;
  saveLocalSyllabi(localData);

  // If Supabase is connected, persist to remote database
  if (supabase) {
    try {
      const { error } = await supabase
        .from('student_syllabi')
        .upsert({
          student_id: record.studentId,
          class_level: record.classLevel,
          subject: record.subject,
          file_name: record.fileName,
          file_path: record.filePath,
          file_url: record.fileUrl,
          processing_status: record.processingStatus,
          extracted_data: record.extractedData || {},
          extracted_at: record.extractedAt
        }, {
          onConflict: 'student_id,class_level,subject'
        });

      if (error) {
        console.warn('Supabase student_syllabi upsert warning:', error.message);
      }
    } catch (err) {
      console.warn('Failed to sync student_syllabi to Supabase:', err);
    }
  }

  return fullRecord;
}

/**
 * Retrieves a stored syllabus for a student, class, and subject
 */
export async function getStudentSyllabus(
  studentId: string,
  classLevel: string,
  subject: string
): Promise<StudentSyllabusRecord | null> {
  // Check local cache first for sub-millisecond retrieval
  const key = buildRecordKey(studentId, classLevel, subject);
  const localData = getLocalSyllabi();
  if (localData[key]) {
    return localData[key];
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('student_syllabi')
        .select('*')
        .eq('student_id', studentId)
        .eq('class_level', classLevel)
        .eq('subject', subject)
        .single();

      if (data && !error) {
        const mapped: StudentSyllabusRecord = {
          id: data.id,
          studentId: data.student_id,
          classLevel: data.class_level,
          subject: data.subject,
          fileName: data.file_name,
          filePath: data.file_path,
          fileUrl: data.file_url,
          processingStatus: data.processing_status,
          extractedData: data.extracted_data,
          uploadedAt: data.uploaded_at,
          extractedAt: data.extracted_at
        };
        localData[key] = mapped;
        saveLocalSyllabi(localData);
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase getStudentSyllabus error:', err);
    }
  }

  return null;
}

/**
 * Uploads a syllabus PDF file to Supabase Storage if available
 */
export async function uploadSyllabusFile(
  studentId: string,
  classLevel: string,
  subject: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  const cleanClass = classLevel.toLowerCase().replace(/\s+/g, '-');
  const cleanSub = subject.toLowerCase().replace(/\s+/g, '-');
  const storagePath = `syllabus/${studentId}/${cleanClass}/${cleanSub}_${Date.now()}.pdf`;

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('learning-materials')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('learning-materials')
          .getPublicUrl(data.path);

        return {
          path: data.path,
          url: publicData.publicUrl || ''
        };
      }
    } catch (err) {
      console.warn('Supabase storage upload fallback:', err);
    }
  }

  return {
    path: storagePath,
    url: ''
  };
}
