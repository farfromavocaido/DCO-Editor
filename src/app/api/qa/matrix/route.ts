import { loadQaCopyMatrix } from '@/server/qa-matrix';
import { errorResponse, jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const matrix = loadQaCopyMatrix();
    return jsonResponse({
      sizes: matrix.sizes,
      durationS: matrix.durationS,
      intervalMs: matrix.intervalMs ?? 250,
      variants: matrix.variants,
      copySets: matrix.copySets,
      library: matrix.library,
      backgroundAssets: matrix.backgroundAssets,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
