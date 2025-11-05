import { base44 } from './base44Client';
import { InvokeLLM as InvokeLLMProvider } from './llmProvider';




export const Core = base44.integrations.Core;

// Use LLM provider abstraction for InvokeLLM (supports Base44 and Gemini)
export const InvokeLLM = InvokeLLMProvider;

export const SendEmail = base44.integrations.Core.SendEmail;

export const UploadFile = base44.integrations.Core.UploadFile;

export const GenerateImage = base44.integrations.Core.GenerateImage;

export const ExtractDataFromUploadedFile = base44.integrations.Core.ExtractDataFromUploadedFile;

export const CreateFileSignedUrl = base44.integrations.Core.CreateFileSignedUrl;

export const UploadPrivateFile = base44.integrations.Core.UploadPrivateFile;






