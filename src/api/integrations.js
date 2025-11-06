import { InvokeLLM as InvokeLLMProvider } from './llmProvider';
import { UploadFile as UploadFileIntegration, UploadPrivateFile as UploadPrivateFileIntegration, CreateFileSignedUrl as CreateFileSignedUrlIntegration } from '../lib/supabase-integrations';

// LLM provider abstraction for InvokeLLM (Gemini API)
export const InvokeLLM = InvokeLLMProvider;

// Supabase Storage integrations
export const UploadFile = UploadFileIntegration;
export const UploadPrivateFile = UploadPrivateFileIntegration;
export const CreateFileSignedUrl = CreateFileSignedUrlIntegration;

// Placeholder integrations (not yet implemented - add when needed)
export const SendEmail = async (params) => {
  console.warn('SendEmail integration not yet implemented for Supabase');
  throw new Error('SendEmail integration not yet implemented. Please add to src/lib/supabase-integrations.js');
};

export const GenerateImage = async (params) => {
  console.warn('GenerateImage integration not yet implemented for Supabase');
  throw new Error('GenerateImage integration not yet implemented. Please add to src/lib/supabase-integrations.js');
};

export const ExtractDataFromUploadedFile = async (params) => {
  console.warn('ExtractDataFromUploadedFile integration not yet implemented for Supabase');
  throw new Error('ExtractDataFromUploadedFile integration not yet implemented. Please add to src/lib/supabase-integrations.js');
};

// Export Core object for backward compatibility (if any code uses Core.UploadFile, etc.)
export const Core = {
  UploadFile: UploadFileIntegration,
  UploadPrivateFile: UploadPrivateFileIntegration,
  CreateFileSignedUrl: CreateFileSignedUrlIntegration,
  SendEmail,
  GenerateImage,
  ExtractDataFromUploadedFile,
  InvokeLLM: InvokeLLMProvider,
};
