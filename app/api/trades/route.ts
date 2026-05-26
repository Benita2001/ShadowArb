import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'trades-seed.json');
    const trades = JSON.parse(readFileSync(filePath, 'utf-8'));
    return Response.json(trades);
  } catch {
    return Response.json([]);
  }
}
