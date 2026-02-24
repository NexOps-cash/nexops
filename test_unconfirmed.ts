import { ElectrumClient } from '@electrum-cash/network';
import { cashAddressToLockingBytecode, sha256, binToHex, instantiateSecp256k1, instantiateRipemd160, encodeCashAddress } from '@bitauth/libauth';
import { randomBytes } from 'crypto';

async function main() {
    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();

    // Generate fresh key
    const privateKey = randomBytes(32);
    const pubkey = secp256k1.derivePublicKeyCompressed(privateKey);
    if (typeof pubkey === 'string') throw new Error(pubkey);

    const pkh = ripemd160.hash(sha256.hash(pubkey));
    const addressData = encodeCashAddress('bchtest', 'p2pkh', pkh);
    const address = typeof addressData === 'string' ? addressData : addressData.address;
    console.log('[Test] Generated Address:', address);

    const lockResult = cashAddressToLockingBytecode(address);
    if (typeof lockResult === 'string') throw new Error(lockResult);

    const bytecode = lockResult.bytecode;
    const reversedHash = sha256.hash(bytecode).reverse();
    const scriptHash = binToHex(reversedHash);

    const client = new ElectrumClient('Nexops-Test', '1.4.1', 'chipnet.imaginary.cash');
    await client.connect();

    console.log('[Test] Triggering Faucet...');
    const fRes = await fetch('https://rest-unstable.mainnet.cash/faucet/get_testnet_bch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashaddr: address })
    });
    const fData = await fRes.json();
    console.log('[Test] Faucet Response:', fData);

    console.log('[Test] Polling UTXOs for 20 seconds...');
    for (let i = 0; i < 20; i++) {
        const listUnspent = await client.request('blockchain.scripthash.listunspent', scriptHash) as any[];
        console.log(`[Attempt ${i + 1}] List Unspent:`, listUnspent);

        if (listUnspent.length > 0) {
            console.log('UTXO Detetced!');
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await client.disconnect();
}

main().catch(console.error);
