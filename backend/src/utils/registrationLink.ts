import crypto from 'crypto';

interface RegistrationData {
  schoolId: number;
  classId: number;
}

export function encodeRegistrationHash(schoolId: number, classId: number): string {
  const data = { s: schoolId, c: classId };
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64url');
}

export function decodeRegistrationHash(hash: string): RegistrationData | null {
  try {
    const json = Buffer.from(hash, 'base64url').toString('utf-8');
    const data = JSON.parse(json);
    if (data.s && data.c) {
      return { schoolId: data.s, classId: data.c };
    }
    return null;
  } catch {
    return null;
  }
}
