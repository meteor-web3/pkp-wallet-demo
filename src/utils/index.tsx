import { ethers } from 'ethers';

function publicKeyToAddress(publicKey: string) {
	return ethers.utils.computeAddress(`0x${publicKey}`);
}

async function retry(func: any, maxRetries = 50) {
    while (maxRetries > 0) {
        try {
            const result = await func();
            return result;
        } catch (error) {
            maxRetries--;
            console.log(`>>>>>>>>retry count: ${50 - maxRetries}`)
            if (maxRetries === 0) {
                throw error;
            }
        }
    }
}

export {
    publicKeyToAddress,
    retry
}