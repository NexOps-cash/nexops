import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const MANIFEST_PATH = path.resolve('./kb_manifest.json');
const KB_ROOT = path.resolve('./BCH_Knowledge_Base-main');
const OUTPUT_FILE = path.resolve('./src/data/kb_index.json');

// --- Helpers ---

// Clean markdown content
function cleanContent(text) {
    return text.replace(/\r\n/g, '\n').trim();
}

// Naive topic extraction
function extractTopics(text) {
    const topics = new Set();
    const codeKeywords = ['contract', 'function', 'transaction', 'covenant', 'p2pkh', 'introspection', 'bytes', 'int', 'string', 'bool'];

    codeKeywords.forEach(kw => {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) topics.add(kw);
    });

    // Extract headers as topics
    const headers = text.match(/^#{1,6}\s+(.*)$/gm);
    if (headers) {
        headers.forEach(h => topics.add(h.replace(/^#{1,6}\s+/, '').trim()));
    }

    return Array.from(topics);
}

// --- Chunking Strategies ---

// 1. Code-Block Atomic (for Language & SDK)
function chunkAtomicCode(content, source, tier) {
    const chunks = [];
    const lines = content.split('\n');
    let buffer = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        buffer.push(line);

        const isHeader = /^#{1,2}\s/.test(line);
        const bufferSize = buffer.join('\n').length;

        if (!inCodeBlock) {
            if (bufferSize > 1500 || (isHeader && bufferSize > 200)) {
                const chunkContent = buffer.join('\n').trim();
                if (chunkContent.length > 50) {
                    chunks.push({
                        id: `${source}-${chunks.length}`,
                        content: chunkContent,
                        source,
                        tier,
                        type: chunkContent.includes('```') ? 'mixed' : 'text',
                        topics: extractTopics(chunkContent)
                    });
                }
                buffer = [];
                if (isHeader) {
                    buffer.push(line);
                }
            }
        }
    }

    if (buffer.length > 0) {
        const chunkContent = buffer.join('\n').trim();
        if (chunkContent.length > 50) {
            chunks.push({
                id: `${source}-${chunks.length}`,
                content: chunkContent,
                source,
                tier,
                type: chunkContent.includes('```') ? 'mixed' : 'text',
                topics: extractTopics(chunkContent)
            });
        }
    }

    return chunks;
}

// 2. FAQ Chunker
function chunkFAQ(content, source, tier) {
    if (source.endsWith('.json')) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data.map((item, idx) => ({
                    id: `${source}-${idx}`,
                    content: `Q: ${item.question || item.q}\nA: ${item.answer || item.a}`,
                    source,
                    tier,
                    type: 'text',
                    topics: extractTopics(item.question || '')
                }));
            }

            return Object.entries(data).map(([k, v], idx) => ({
                id: `${source}-${idx}`,
                content: `Topic: ${k}\nContent: ${JSON.stringify(v)}`,
                source,
                tier,
                type: 'text',
                topics: extractTopics(k)
            }));

        } catch (e) {
            console.warn(`Failed to parse JSON for ${source}, falling back to text chunking.`);
        }
    }

    return chunkAtomicCode(content, source, tier);
}

// --- Main Execution ---

async function main() {
    console.log("🚀 Starting KB Indexer...");

    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error(`❌ Manifest not found at ${MANIFEST_PATH}`);
        process.exit(1);
    }

    const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    let allChunks = [];

    for (const [tierName, config] of Object.entries(manifest)) {
        console.log(`\n📂 Processing Tier: ${tierName}`);

        for (const relPath of config.files) {
            const fullPath = path.join(KB_ROOT, relPath);
            if (!fs.existsSync(fullPath)) {
                console.warn(`  ⚠️ File not found: ${relPath}`);
                continue;
            }

            console.log(`  Processing: ${relPath}`);
            const content = fs.readFileSync(fullPath, 'utf-8');
            let chunks = [];

            if (tierName === 'tier_c_faq') {
                chunks = chunkFAQ(content, relPath, tierName);
            } else {
                chunks = chunkAtomicCode(content, relPath, tierName);
            }

            console.log(`    -> Generated ${chunks.length} chunks`);
            allChunks = allChunks.concat(chunks);
        }
    }

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2));
    console.log(`\n✅ Indexing Complete! Wrote ${allChunks.length} chunks to ${OUTPUT_FILE}`);
}

main();
