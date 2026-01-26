/**
 * Logo Upload Helper
 *
 * Handles uploading, validating, and managing user invoice logos
 * via Supabase Storage.
 *
 * NOTE: Logo upload is a paid feature (Pro/Trade only).
 * Plan access must be checked before calling uploadLogo/deleteLogo.
 */

import { supabase } from '@/lib/supabase'
import { canUseInvoiceBranding } from '@/lib/plan-access'

const BUCKET_NAME = 'invoice-logos'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_DIMENSION = 1024 // Max width/height in pixels

// Error message for free users attempting branding
export const BRANDING_PAYWALL_ERROR = 'Invoice branding is available on Pro and Trade plans'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
  blocked?: boolean // True if blocked by paywall
}

/**
 * Validates an image file before upload
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please use PNG, JPG, or WebP.',
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 2MB.',
    }
  }

  return { valid: true }
}

/**
 * Resizes an image if it exceeds max dimensions
 * Returns a blob with the resized image
 */
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Check if resize is needed
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file)
        return
      }

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        height = Math.round((height / width) * MAX_DIMENSION)
        width = MAX_DIMENSION
      } else {
        width = Math.round((width / height) * MAX_DIMENSION)
        height = MAX_DIMENSION
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to create canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create image blob'))
          }
        },
        file.type,
        0.9 // Quality for JPEG
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Uploads a logo file to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The user's ID (used as folder name)
 * @returns Upload result with URL or error
 *
 * NOTE: This function enforces paywall - free users cannot upload logos.
 */
export async function uploadLogo(file: File, userId: string): Promise<UploadResult> {
  // Check plan access first (server-side enforcement)
  const canBrand = await canUseInvoiceBranding(userId)
  if (!canBrand) {
    console.log('[LogoUpload] branding_save_attempt_blocked: free user', userId.slice(0, 8))
    return {
      success: false,
      error: BRANDING_PAYWALL_ERROR,
      blocked: true,
    }
  }

  // Validate file
  const validation = validateLogoFile(file)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  try {
    // Resize image if needed
    const processedBlob = await resizeImage(file)

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const fileName = `${userId}/logo-${timestamp}.${ext}`

    // Delete any existing logos for this user first
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`)
      await supabase.storage.from(BUCKET_NAME).remove(filesToDelete)
    }

    // Upload new logo
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, processedBlob, {
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      console.error('Logo upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload logo',
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return {
      success: true,
      url: urlData.publicUrl,
    }
  } catch (err) {
    console.error('Logo upload exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }
  }
}

/**
 * Deletes a user's logo from storage
 * @param userId - The user's ID
 *
 * NOTE: We allow deletion even for free users (they may have had Pro before).
 * This is intentional - we don't want to trap users with branding they can't remove.
 */
export async function deleteLogo(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // List all files in user's folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId)

    if (listError) {
      console.error('Error listing logos:', listError)
      return { success: false, error: 'Failed to find logo' }
    }

    if (!files || files.length === 0) {
      return { success: true } // No files to delete
    }

    // Delete all files in user's folder
    const filesToDelete = files.map((f) => `${userId}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete)

    if (deleteError) {
      console.error('Error deleting logo:', deleteError)
      return { success: false, error: 'Failed to delete logo' }
    }

    return { success: true }
  } catch (err) {
    console.error('Delete logo exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    }
  }
}
