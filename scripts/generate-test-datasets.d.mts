export type TestExpectation = { sheet?: string; rows?: number; columns?: number; error?: string; warning?: string; identifierIssues?: number };
export type TestFixture = { name: string; data: Buffer; purpose: string; expectations: TestExpectation[] };
export function buildTestDatasets(): TestFixture[];
export function generateTestDatasets(output?: string): Promise<{ synthetic: boolean; limits: Record<string, number>; files: Array<Omit<TestFixture, 'data'> & { bytes: number; sha256: string }> }>;
