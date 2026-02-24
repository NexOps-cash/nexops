import { ElectrumClient } from '@electrum-cash/network';
import { cashAddressToLockingBytecode, sha256, binToHex } from '@bitauth/libauth';
async function main() {
    const address = 'bchtest:qz9ht07aau6864puv3rd7lrtg557rt5gqq07s2h09d';
    const lockResult = cashAddressToLockingBytecode(address);
    if (typeof lockResult === 'string')
        throw new Error(lockResult);
    const bytecode = lockResult.bytecode;
    const reversedHash = sha256.hash(bytecode).reverse();
    const scriptHash = binToHex(reversedHash);
    const client = new ElectrumClient('Nexops-Test', '1.4.1', 'testnet.imaginary.cash');
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
        const listUnspent = await client.request('blockchain.scripthash.listunspent', scriptHash);
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
