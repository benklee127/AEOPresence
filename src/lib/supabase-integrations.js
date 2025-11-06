import { supabase } from './supabase-client.js';

/**
 * Upload a file to Supabase Storage
 * @param {Object} params - Upload parameters
 * @param {File} params.file - File object to upload
 * @param {string} params.bucket - Storage bucket name (default: 'company-logos')
 * @param {string} params.path - Optional path within bucket
 * @returns {Promise<Object>} Upload result with URL
 */
export async function UploadFile({ file, bucket = 'company-logos', path = '' }) {
  if (!file) {
    throw new Error(
      `[src/lib/supabase-integrations.js] UploadFile requires a file\n\n` +
      `📤 Expected: File object from input or drag-and-drop\n` +
      `   Received: ${typeof file}`
    );
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = path ? `${path}/${timestamp}-${sanitizedName}` : `${timestamp}-${sanitizedName}`;

  try {
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(
        `[src/lib/supabase-integrations.js] Failed to upload file to Supabase Storage\n\n` +
        `📤 Upload Details:\n` +
        `   • Bucket: ${bucket}\n` +
        `   • File name: ${fileName}\n` +
        `   • File size: ${file.size} bytes\n` +
        `   • File type: ${file.type}\n\n` +
        `❌ Supabase Storage Error:\n` +
        `   ${error.message}\n\n` +
        `💡 Possible causes:\n` +
        `   • Storage bucket "${bucket}" does not exist\n` +
        `   • File size exceeds bucket limit\n` +
        `   • Storage policies deny upload access\n` +
        `   • File type not allowed by bucket configuration\n` +
        `   • File already exists (upsert is false)\n\n` +
        `🔧 Troubleshooting:\n` +
        `   1. Create bucket in Supabase Dashboard: Storage → "${bucket}"\n` +
        `   2. Make bucket public: Bucket Settings → Public bucket: ON\n` +
        `   3. Check storage policies allow uploads\n` +
        `   4. Verify file size is within limits\n\n` +
        `Error Code: ${error.statusCode || 'unknown'}`
      );
    }

    // Get public URL for uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      url: publicUrl,
      path: data.path,
      fullPath: data.fullPath,
      id: data.id
    };

  } catch (error) {
    // Re-throw with context if not already formatted
    if (error.message.includes('[src/lib/supabase-integrations.js]')) {
      throw error;
    }

    throw new Error(
      `[src/lib/supabase-integrations.js] Unexpected error during file upload\n\n` +
      `📤 Upload Details:\n` +
      `   • Bucket: ${bucket}\n` +
      `   • File: ${file.name} (${file.size} bytes)\n\n` +
      `❌ Error:\n` +
      `   ${error.message}\n\n` +
      `🔧 Check browser console for more details`
    );
  }
}

/**
 * Upload a private file to Supabase Storage (requires authentication to access)
 * @param {Object} params - Upload parameters
 * @param {File} params.file - File object to upload
 * @param {string} params.bucket - Storage bucket name (default: 'private-files')
 * @param {string} params.path - Optional path within bucket
 * @returns {Promise<Object>} Upload result with signed URL
 */
export async function UploadPrivateFile({ file, bucket = 'private-files', path = '' }) {
  if (!file) {
    throw new Error(
      `[src/lib/supabase-integrations.js] UploadPrivateFile requires a file`
    );
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = path ? `${path}/${timestamp}-${sanitizedName}` : `${timestamp}-${sanitizedName}`;

  try {
    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Create signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 3600);

    if (signedUrlError) throw signedUrlError;

    return {
      url: signedUrlData.signedUrl,
      path: data.path,
      fullPath: data.fullPath,
      id: data.id
    };

  } catch (error) {
    throw new Error(
      `[src/lib/supabase-integrations.js] Failed to upload private file: ${error.message}`
    );
  }
}

/**
 * Create a signed URL for accessing a private file
 * @param {Object} params - Parameters
 * @param {string} params.bucket - Storage bucket name
 * @param {string} params.path - File path within bucket
 * @param {number} params.expiresIn - Expiration time in seconds (default: 3600)
 * @returns {Promise<string>} Signed URL
 */
export async function CreateFileSignedUrl({ bucket, path, expiresIn = 3600 }) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;

    return data.signedUrl;
  } catch (error) {
    throw new Error(
      `[src/lib/supabase-integrations.js] Failed to create signed URL: ${error.message}`
    );
  }
}
