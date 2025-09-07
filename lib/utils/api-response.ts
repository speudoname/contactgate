import { NextResponse } from 'next/server'

export interface ApiError {
  error: string
  message?: string
  details?: string
  code?: string
  timestamp?: string
}

export interface ApiSuccess<T = any> {
  data?: T
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export class ApiResponse {
  static success<T>(data: T, message?: string, pagination?: ApiSuccess['pagination']) {
    const response: ApiSuccess<T> = { data }
    
    if (message) response.message = message
    if (pagination) response.pagination = pagination
    
    return NextResponse.json(response)
  }

  static error(
    error: string, 
    status: number = 500, 
    details?: string, 
    code?: string
  ) {
    const response: ApiError = {
      error,
      timestamp: new Date().toISOString()
    }
    
    if (details) response.details = details
    if (code) response.code = code
    
    return NextResponse.json(response, { status })
  }

  static unauthorized(message: string = 'Unauthorized') {
    return this.error(message, 401)
  }

  static notFound(message: string = 'Resource not found') {
    return this.error(message, 404)
  }

  static badRequest(message: string = 'Bad request', details?: string) {
    return this.error(message, 400, details)
  }

  static internalError(message: string = 'Internal server error', details?: string) {
    return this.error(message, 500, details)
  }

  static validationError(message: string, details?: string) {
    return this.error(message, 422, details)
  }
}
