
import { cashAddressToLockingBytecode, sha256, binToHex } from '@bitauth/libauth';

const address = 'bchtest:pv2hmkszxx5jthavxr7u625fug906mdl3tgcz653g0wk0a2sjkju283nkys3e';
const expectedScriptHash = 'b0313259982469eec4ca0a87a8fad80e4f0e054461ec1965a1577f1a9cf1d2ba';

function addressToScriptHash(address) {
    const lockResult = cashAddressToLockingBytecode(address);
    if (typeof lockResult === 'string') throw new Error(lockResult);

    const bytecode = lockResult.bytecode;
    const hash = sha256.hash(bytecode);
    const reversedHash = hash.reverse();
    return binToHex(reversedHash);
}

try {
    const calculated = addressToScriptHash(address);
    console.log('Calculated:', calculated);
    console.log('Expected:  ', expectedScriptHash);
    console.log('Match:     ', calculated === expectedScriptHash);
} catch (e) {
    console.error('Error:', e);
}
