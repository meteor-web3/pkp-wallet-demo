import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as LitJsSdk_authHelpers from "@lit-protocol/auth-helpers";
import { AuthMethod, IRelayPKP } from "@lit-protocol/types";
import { BaseProvider, LitAuthClient } from "@lit-protocol/lit-auth-client";
import { LitAbility } from "@lit-protocol/auth-helpers";
import { CHRONICLE_RPC_URL, PUBKEY_ROUTER_CONTRACT_ADDRESS, RELAY_API_KEY } from "./constant";
import axios from "axios";
import { Contract, ethers } from "ethers";
import PubkeyRouterJson from '../contracts/PubkeyRouter.json'
import { ProviderType } from "../types";

// const REACT_APP_RELAY_API_URL = "https://relay-server-staging.herokuapp.com"

function getLitAuthClient(): LitAuthClient {
	const litAuthClient = new LitAuthClient({
		litRelayConfig: {
			// Request a Lit Relay Server API key here: https://forms.gle/RNZYtGYTY9BcD9MEA
			relayApiKey: RELAY_API_KEY,
		},
	});
	console.log("litAuthClient:", litAuthClient)

	// Initialize Google provider
	litAuthClient.initProvider(ProviderType.Google, {
		// The URL of your web app where users will be redirected after authentication
		redirectUri: 'http://localhost:3000',
	});

	return litAuthClient;
}

async function mintPkp(provider: BaseProvider, authMethod: AuthMethod): Promise<string> {
	const txHash = await provider.mintPKPThroughRelayer(authMethod);
	return txHash;
}

async function getRelayerPkps(provider: BaseProvider, authMethod: AuthMethod): Promise<IRelayPKP[]> {
	const relayerPkps: IRelayPKP[] = await provider.fetchPKPsThroughRelayer(authMethod);
	return relayerPkps;
}

async function getSessionSigs(provider: BaseProvider, authMethod: AuthMethod, pkpPublicKey: string) {
	const litResource = new LitJsSdk_authHelpers.LitAccessControlConditionResource(
		''
	);

	const sessionSigs = await provider.getSessionSigs({
		pkpPublicKey,
		authMethod,
		sessionSigsParams: {
			chain: 'mumbai',
			resourceAbilityRequests: [{
				resource: litResource,
				ability: LitAbility.AccessControlConditionDecryption
			}],
		},
	});
	return sessionSigs;
}

async function getLitNodeClient(): Promise<LitJsSdk.LitNodeClient> {
	const litNodeClient = new LitJsSdk.LitNodeClient({
		litNetwork: "serrano",
		debug: false
	});
	await litNodeClient.connect();

	return litNodeClient;
}

const getLitAuthSig = async () => {
	const controllerAuthSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'mumbai' });  // metamask or walletconnect
	console.log("controllerAuthSig:", controllerAuthSig)
	return controllerAuthSig
}

const getPkpPubkeysByAddress = async (address: string) => {
	const res = await axios.get(`https://explorer.litprotocol.com/api/get-pkps-by-address/${address}`);
	console.log(res);

	const pubkeyRouter = new Contract(
		PUBKEY_ROUTER_CONTRACT_ADDRESS,
		PubkeyRouterJson.abi,
		new ethers.providers.JsonRpcProvider(CHRONICLE_RPC_URL)
	);

	return await Promise.all(res.data.data.map(async (item: any) => {
		const pubKey = await pubkeyRouter.getPubkey(item.tokenID);
		console.log("pubKey=", pubKey);
		return pubKey;
	}))
}

export {
	getLitAuthClient,
	getLitNodeClient,
	getSessionSigs,
	mintPkp,
	getRelayerPkps,
	getLitAuthSig,
	getPkpPubkeysByAddress
}