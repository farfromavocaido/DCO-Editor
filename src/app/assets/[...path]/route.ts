import { serveAsset, errorResponse } from '@/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { path: segments } = await params;
    // URL prefix doubles as the on-disk campaign/assets/ directory name.
    return serveAsset(['assets', ...segments].join('/'));
  } catch (error) {
    const status = error instanceof Error && (error.message === 'not a file' || error.message.includes('ENOENT')) ? 404 : 500;
    return errorResponse(error, status);
  }
}
