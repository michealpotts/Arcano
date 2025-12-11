import { keccak256 } from "js-sha3";

export async function getSignature(provider, account, dto) {
    if (!provider) throw new Error("No Gala wallet provider available");
    if (!account) throw new Error("No account provided");

    const payload = { dto };
    const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort()).replace(/\s/g, '');

    const payloadBytes = new TextEncoder().encode(sortedPayload);  

    const hashBytes = new Uint8Array(keccak256.array(payloadBytes));
    const hashHex = '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    let signature = await provider.request({
        method: 'personal_sign',
        params: [hashHex, account]
    });

    return signature;
}


