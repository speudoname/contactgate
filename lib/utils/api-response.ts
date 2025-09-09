import { NextResponse } from 'next/server'
import { SharedApiResponse, ERROR_CODES, ApiSuccess } from './shared-error-handler'

// Re-export shared types for backward compatibility
export type { ApiError, ApiSuccess } from './shared-error-handler'

/**
 * ContactGate API Response class - now uses shared error handler
 * Maintains backward compatibility while providing enhanced error handling
 */
export class ApiResponse {
  static success<T>(data: T, message?: string, pagination?: ApiSuccess['pagination']) {
    return SharedApiResponse.success(data, message, pagination)
  }

  static error(
    error: string, 
    status: number = 500, 
    details?: string, 
    code?: string
  ) {
    // Convert old format to new format
    const errorCode = code || (status === 401 ? ERROR_CODES.UNAUTHORIZED : 
                              status === 404 ? ERROR_CODES.NOT_FOUND :
                              status === 400 ? ERROR_CODES.INVALID_INPUT :
                              ERROR_CODES.INTERNAL_ERROR)
    
    return SharedApiResponse.error(errorCode, error, status, details)
  }

  static unauthorized(message: string = 'Unauthorized') {
    return SharedApiResponse.unauthorized(message)
  }

  static notFound(message: string = 'Resource not found') {
    return SharedApiResponse.notFound(message)
  }

  static badRequest(message: string = 'Bad request', details?: string) {
    return SharedApiResponse.badRequest(message, details)
  }

  static internalError(message: string = 'Internal server error', details?: string) {
    return SharedApiResponse.internalError(message, details)
  }

  static validationError(message: string, details?: string) {
    return SharedApiResponse.validationError(message, details)
  }

  // ContactGate specific methods
  static contactNotFound(contactId?: string) {
    return SharedApiResponse.contactNotFound(contactId)
  }

  static emailError(message: string = 'Email operation failed', details?: any) {
    return SharedApiResponse.emailError(message, details)
  }
}
