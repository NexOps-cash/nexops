import { encodePrivateKeyWif, decodePrivateKeyWif, sha256, instantiateSecp256k1, instantiateRipemd160, encodeCashAddress } from '@bitauth/libauth';
import crypto from 'crypto';

async function run() {
    const privateKey = new Uint8Array(32);
    crypto.webcrypto.getRandomValues(privateKey);
    const wif = encodePrivateKeyWif(privateKey, 'testnet');
    console.log("WIF:", wif);

    const decoded = decodePrivateKeyWif(wif);
    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();

    const pk = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
    const hash = ripemd160.hash(sha256.hash(pk));

    console.log("Hash:", hash);

    const address = encodeCashAddress({
        prefix: 'bchtest',
        type: 'p2pkh',
        payload: hash
    });
    console.log("Address:", address);
}
run().catch(console.error);
