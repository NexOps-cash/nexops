import LocalWalletService from './services/localWalletService.ts';

async function test() {
    const wif = await LocalWalletService.generateBurnerWIF();
    const address = await LocalWalletService.getAddressFromWIF(wif);
    console.log("WIF:", wif);
    console.log("Address:", address);
}
test();
