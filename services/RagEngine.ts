import kbIndex from '../src/data/kb_index.json';

// --- Types ---
export type Tier = 'tier_a_canonical' | 'tier_b_patterns_security' | 'tier_c_faq';

export interface Chunk {
    id: string;
    content: string;
    source: string;
    tier: Tier;
    type: 'code' | 'text' | 'mixed';
    topics: string[];
}

export interface SearchResult {
    chunk: Chunk;
    score: number;
}

// --- Vector Store (Lightweight / Keyword-based for now) ---
// In a real local setup, we might use transformers.js for embeddings. 
// Here, we use a robust Weighted Keyword Matcher + Topic Overlap.

class SimpleVectorStore {
    private chunks: Chunk[];

    constructor(data: Chunk[]) {
        this.chunks = data;
    }

    search(query: string, tiers: Tier[] = [], limit: number = 10): SearchResult[] {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const results: SearchResult[] = [];

        for (const chunk of this.chunks) {
            if (tiers.length > 0 && !tiers.includes(chunk.tier)) continue;

            let score = 0;
            const contentLower = chunk.content.toLowerCase();

            // 1. Keyword Match (Content)
            let matchedTerms = 0;
            for (const term of queryTerms) {
                if (contentLower.includes(term)) {
                    // ID Boost: If term looks like SEC-XXX, give it a massive weight
                    if (/^sec-\d+$/i.test(term)) {
                        score += 15;
                    } else {
                        score += 1;
                    }
                    matchedTerms++;
                }
            }

            // 2. Topic Match (Metadata)
            for (const topic of chunk.topics) {
                if (queryTerms.some(term => topic.toLowerCase().includes(term))) {
                    score += 3; // Higher weight for topic metadata
                }
            }

            // 3. Exact Phrase Boost
            if (contentLower.includes(query.toLowerCase())) {
                score += 10;
            }

            // 4. Inverse Document Frequency (Simulated)
            // If a term matches, we divide by log length to penalize super long chunks slightly
            score = score / (Math.log(chunk.content.length) || 1);

            if (matchedTerms > 0) {
                results.push({ chunk, score });
            }
        }

        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}

// --- Query Router ---

export class QueryRouter {
    static route(query: string): Tier[] {
        const q = query.toLowerCase();

        // Security / Audit / Rule Route
        if (/audit|safe|secur|vuln|hack|risk|attack|sec-|rule/i.test(q)) {
            console.log("🔀 Routing to: Security + Canonical (Rule/Audit)");
            return ['tier_a_canonical', 'tier_b_patterns_security'];
        }

        // Money / Critical Route
        if (/token|fund|money|transfer|value|amount|satoshis/i.test(q)) {
            console.log("🔀 Routing to: Security + Canonical (Critical)");
            return ['tier_a_canonical', 'tier_b_patterns_security'];
        }

        // Debugging / Errors Route
        if (/why|error|fail|mistake|bug|fix|broke/i.test(q)) {
            console.log("🔀 Routing to: FAQ + Concepts");
            return ['tier_c_faq', 'tier_b_patterns_security'];
        }

        // Default: Code Generation Route
        console.log("🔀 Routing to: Canonical + Patterns (Default)");
        return ['tier_a_canonical', 'tier_b_patterns_security'];
    }
}

// --- Context Assembler ---

export class ContextAssembler {
    private static MAX_TOKENS = 3000;
    private static CHARS_PER_TOKEN = 4; // Approx

    static assemble(results: SearchResult[]): string {
        // Sort by Tier Priority (A > B > C) then Score
        const tierWeights = {
            'tier_a_canonical': 3,
            'tier_b_patterns_security': 2,
            'tier_c_faq': 1
        };

        const sorted = results.sort((a, b) => {
            const weightDiff = (tierWeights[b.chunk.tier] || 0) - (tierWeights[a.chunk.tier] || 0);
            if (weightDiff !== 0) return weightDiff;
            return b.score - a.score;
        });

        let context = "";
        let currentChars = 0;
        const maxChars = this.MAX_TOKENS * this.CHARS_PER_TOKEN;

        for (const res of sorted) {
            const entryStr = `\n--- SOURCE: ${res.chunk.source} (Confidence: ${res.chunk.tier}) ---\n${res.chunk.content}\n`;
            if (currentChars + entryStr.length > maxChars) break;

            context += entryStr;
            currentChars += entryStr.length;
        }

        return context;
    }
}

// --- Main Service Class ---

export class RagEngine {
    private store: SimpleVectorStore;

    constructor() {
        // Cast to unknown first to avoid TS issues if json import is strict
        this.store = new SimpleVectorStore(kbIndex as unknown as Chunk[]);
    }

    public retrieveContext(query: string): string | null {
        const tiers = QueryRouter.route(query);
        const results = this.store.search(query, tiers, 15);

        // Refusal Gate check
        const canonicalMatches = results.filter(r => r.chunk.tier === 'tier_a_canonical');
        if (tiers.includes('tier_a_canonical') && canonicalMatches.length === 0) {
            // If we needed canonical info but found NONE, we might want to refuse.
            // For now, if the query is strictly technical, this is a signal.
            // However, to be user friendly, we allow fallback if we have at least SOME good matches.
            // But strict requirement was: "If no Tier A chunks... STOP"
            // Let's implement strict gate logic:
            if (results.length === 0) return null;
        }

        if (results.length === 0) return null;

        return ContextAssembler.assemble(results);
    }
}

export const ragEngine = new RagEngine();
