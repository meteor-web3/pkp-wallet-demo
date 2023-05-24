import { ethers } from 'ethers';

function publicKeyToAddress(publicKey: string) {
	return ethers.utils.computeAddress(`0x${publicKey}`);
}

export {
    publicKeyToAddress
}