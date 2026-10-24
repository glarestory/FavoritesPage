import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PASSWORD_KEY_BYTES = 64
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 200
export const MAX_EMAIL_LENGTH = 254

export function normalizeEmail(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

export function validateCredentials(email, password) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return '이메일을 입력해 주세요.'
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
    return '올바른 이메일 주소를 입력해 주세요.'
  }

  if (typeof password !== 'string') return '비밀번호를 입력해 주세요.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`
  }

  return null
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, PASSWORD_KEY_BYTES)
  return {
    passwordHash: Buffer.from(derived).toString('hex'),
    passwordSalt: salt,
  }
}

export async function verifyPassword(password, passwordSalt, passwordHash) {
  if (typeof password !== 'string' || typeof passwordSalt !== 'string') return false

  let expected
  try {
    expected = Buffer.from(passwordHash, 'hex')
  } catch {
    return false
  }
  if (expected.length !== PASSWORD_KEY_BYTES) return false

  try {
    const derived = await scrypt(password, passwordSalt, PASSWORD_KEY_BYTES)
    return timingSafeEqual(expected, Buffer.from(derived))
  } catch {
    return false
  }
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}
