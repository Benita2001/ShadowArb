import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'trades-seed.json');
    const trades = JSON.parse(readFileSync(filePath, 'utf-8')) as Array<{ status: string }>;
    const latest = trades.find(t => t.status === 'REVEALED') ?? null;
    return Response.json(latest);
  } catch {
    return Response.json(null);
  }
}
