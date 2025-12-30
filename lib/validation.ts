/**
 * Input Validation & Sanitization Utilities
 *
 * Provides secure validation and sanitization functions to prevent
 * XSS, injection attacks, and other security vulnerabilities.
 */

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Comprehensive email validation
 *
 * Checks:
 * - RFC 5322 compliant format
 * - No dangerous characters
 * - Reasonable length limits
 * - Common disposable email domains (optional)
 */
export function validateEmail(email: string): {
  isValid: boolean
  error?: string
  sanitized?: string
} {
  // Basic checks
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' }
  }

  // Trim and lowercase
  const sanitized = email.trim().toLowerCase()

  // Length check (max 254 chars per RFC 5321)
  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email is too long' }
  }

  if (sanitized.length < 3) {
    return { isValid: false, error: 'Email is too short' }
  }

  // RFC 5322 compliant regex (simplified but robust)
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

  if (!emailRegex.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' }
  }

  // Check for dangerous characters
  const dangerousChars = /<|>|;|`|'|"|\\|{|}|\||&/g
  if (dangerousChars.test(sanitized)) {
    return { isValid: false, error: 'Email contains invalid characters' }
  }

  // Split into local and domain parts
  const [local, domain] = sanitized.split('@')

  // Local part validation (before @)
  if (local.length > 64) {
    return { isValid: false, error: 'Email local part is too long' }
  }

  // Domain part validation (after @)
  if (domain.length > 255) {
    return { isValid: false, error: 'Email domain is too long' }
  }

  // Check for valid TLD
  const tldRegex = /\.[a-z]{2,}$/i
  if (!tldRegex.test(domain)) {
    return { isValid: false, error: 'Email domain is invalid' }
  }

  // Optional: Check for disposable email domains (uncomment if needed)
  /*
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', '10minutemail.com',
    'guerrillamail.com', 'mailinator.com', 'trashmail.com'
  ]
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: 'Disposable email addresses are not allowed' }
  }
  */

  return { isValid: true, sanitized }
}

// ============================================================================
// TEXT SANITIZATION
// ============================================================================

/**
 * Sanitize text input to prevent XSS
 *
 * Removes:
 * - HTML tags
 * - Script tags
 * - Event handlers
 * - Dangerous characters
 */
export function sanitizeText(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let sanitized = text

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '')

  // Trim whitespace
  sanitized = sanitized.trim()

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitize text for PDF generation
 *
 * Extra strict - removes all special characters that could cause issues
 * in PDF rendering
 */
export function sanitizePDFText(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let sanitized = text

  // First apply general text sanitization
  sanitized = sanitizeText(sanitized, maxLength)

  // Remove non-printable characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  // Replace potentially problematic characters
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[{}]/g, '') // Remove curly braces
    .replace(/[\[\]]/g, '') // Remove square brackets

  return sanitized
}

// ============================================================================
// NUMBER VALIDATION
// ============================================================================

/**
 * Validate and sanitize numeric input
 */
export function validateNumber(
  value: any,
  options: {
    min?: number
    max?: number
    allowDecimal?: boolean
    allowNegative?: boolean
  } = {}
): {
  isValid: boolean
  value?: number
  error?: string
} {
  const {
    min,
    max,
    allowDecimal = true,
    allowNegative = false
  } = options

  // Convert to number
  const num = typeof value === 'number' ? value : parseFloat(value)

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Invalid number' }
  }

  // Check negative
  if (!allowNegative && num < 0) {
    return { isValid: false, error: 'Negative numbers not allowed' }
  }

  // Check decimal
  if (!allowDecimal && num % 1 !== 0) {
    return { isValid: false, error: 'Decimal numbers not allowed' }
  }

  // Check min
  if (min !== undefined && num < min) {
    return { isValid: false, error: `Number must be at least ${min}` }
  }

  // Check max
  if (max !== undefined && num > max) {
    return { isValid: false, error: `Number must be at most ${max}` }
  }

  return { isValid: true, value: num }
}

// ============================================================================
// STRING LENGTH VALIDATION
// ============================================================================

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  options: {
    min?: number
    max?: number
    fieldName?: string
  }
): {
  isValid: boolean
  error?: string
} {
  const { min = 0, max = 1000, fieldName = 'Input' } = options

  if (!value || typeof value !== 'string') {
    if (min > 0) {
      return { isValid: false, error: `${fieldName} is required` }
    }
    return { isValid: true }
  }

  const length = value.length

  if (length < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min} characters`
    }
  }

  if (length > max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${max} characters`
    }
  }

  return { isValid: true }
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate URL (for external links, images, etc.)
 */
export function validateURL(url: string): {
  isValid: boolean
  error?: string
} {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' }
  }

  // Only allow http and https protocols
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { isValid: false, error: 'URL must start with http:// or https://' }
  }

  try {
    const parsed = new URL(url)

    // Block javascript: protocol
    if (parsed.protocol === 'javascript:') {
      return { isValid: false, error: 'Invalid URL protocol' }
    }

    // Block data: protocol
    if (parsed.protocol === 'data:') {
      return { isValid: false, error: 'Data URLs not allowed' }
    }

    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' }
  }
}

// ============================================================================
// PHONE NUMBER VALIDATION
// ============================================================================

/**
 * Validate UK phone number
 */
export function validateUKPhone(phone: string): {
  isValid: boolean
  sanitized?: string
  error?: string
} {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' }
  }

  // Remove spaces, dashes, parentheses
  let sanitized = phone.replace(/[\s\-\(\)]/g, '')

  // Remove leading +44 or 0044
  sanitized = sanitized.replace(/^\+?44/, '0')

  // UK phone numbers are 10-11 digits starting with 0
  const ukPhoneRegex = /^0[1-9]\d{8,9}$/

  if (!ukPhoneRegex.test(sanitized)) {
    return {
      isValid: false,
      error: 'Invalid UK phone number format'
    }
  }

  return { isValid: true, sanitized }
}

// ============================================================================
// POSTCODE VALIDATION
// ============================================================================

/**
 * Validate UK postcode
 */
export function validateUKPostcode(postcode: string): {
  isValid: boolean
  sanitized?: string
  error?: string
} {
  if (!postcode || typeof postcode !== 'string') {
    return { isValid: false, error: 'Postcode is required' }
  }

  // Remove spaces and convert to uppercase
  let sanitized = postcode.replace(/\s/g, '').toUpperCase()

  // UK postcode regex (comprehensive)
  const postcodeRegex = /^([A-Z]{1,2}\d{1,2}[A-Z]?)\s?(\d[A-Z]{2})$/

  // Add space before last 3 characters if missing
  if (sanitized.length >= 5 && !sanitized.includes(' ')) {
    sanitized = sanitized.slice(0, -3) + ' ' + sanitized.slice(-3)
  }

  if (!postcodeRegex.test(sanitized)) {
    return {
      isValid: false,
      error: 'Invalid UK postcode format'
    }
  }

  return { isValid: true, sanitized }
}

// ============================================================================
// INVOICE DATA VALIDATION
// ============================================================================

/**
 * Validate invoice data before saving/generating PDF
 */
export function validateInvoiceData(invoice: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate job summary
  if (!invoice.job_summary || typeof invoice.job_summary !== 'string') {
    errors.push('Job summary is required')
  } else {
    const lengthCheck = validateLength(invoice.job_summary, {
      min: 5,
      max: 500,
      fieldName: 'Job summary'
    })
    if (!lengthCheck.isValid) {
      errors.push(lengthCheck.error!)
    }
  }

  // Validate labour hours if provided
  if (invoice.labour_hours !== null && invoice.labour_hours !== undefined) {
    const hoursCheck = validateNumber(invoice.labour_hours, {
      min: 0,
      max: 1000,
      allowDecimal: true,
      allowNegative: false
    })
    if (!hoursCheck.isValid) {
      errors.push('Invalid labour hours')
    }
  }

  // Validate labour rate if provided
  if (invoice.labour_rate !== null && invoice.labour_rate !== undefined) {
    const rateCheck = validateNumber(invoice.labour_rate, {
      min: 0,
      max: 10000,
      allowDecimal: true,
      allowNegative: false
    })
    if (!rateCheck.isValid) {
      errors.push('Invalid labour rate')
    }
  }

  // Validate materials
  if (invoice.materials && Array.isArray(invoice.materials)) {
    invoice.materials.forEach((material: any, index: number) => {
      if (!material.description) {
        errors.push(`Material ${index + 1}: Description is required`)
      }
      if (material.cost !== null && material.cost !== undefined) {
        const costCheck = validateNumber(material.cost, {
          min: 0,
          max: 1000000,
          allowDecimal: true,
          allowNegative: false
        })
        if (!costCheck.isValid) {
          errors.push(`Material ${index + 1}: Invalid cost`)
        }
      }
    })
  }

  // Validate notes if provided
  if (invoice.notes) {
    const notesCheck = validateLength(invoice.notes, {
      max: 1000,
      fieldName: 'Notes'
    })
    if (!notesCheck.isValid) {
      errors.push(notesCheck.error!)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
