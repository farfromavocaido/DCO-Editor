import {
  ensureCanonicalAgencyShell,
  exportCanonicalAgencyShell,
} from '@/server/qa-agency-shell';
import { errorResponse, jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const info = await ensureCanonicalAgencyShell();
    return jsonResponse(info);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);
    const info = force
      ? await exportCanonicalAgencyShell()
      : await ensureCanonicalAgencyShell();
    return jsonResponse(info);
  } catch (error) {
    return errorResponse(error);
  }
}
