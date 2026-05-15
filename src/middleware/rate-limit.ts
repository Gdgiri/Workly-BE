import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter for audit endpoints
 * Prevents abuse of audit log queries
 * 
 * Limits:
 * - 100 requests per 15 minutes per IP
 * - Returns 429 status when limit exceeded
 */
export const auditRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Skip rate limiting for successful requests (only count errors)
    skipSuccessfulRequests: false,
    // Skip rate limiting for failed requests
    skipFailedRequests: false,
});

/**
 * Stricter rate limiter for sensitive operations
 * Used for operations that modify audit data (if any)
 * 
 * Limits:
 * - 20 requests per 15 minutes per IP
 */
export const strictAuditRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: {
        error: 'Too many requests for this operation, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter
 * Can be used for other endpoints as needed
 * 
 * Limits:
 * - 1000 requests per 15 minutes per IP
 */
export const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
